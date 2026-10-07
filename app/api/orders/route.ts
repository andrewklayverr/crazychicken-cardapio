import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { deliveryZones, orders, orderItems, products, productOptions, storeSettings } from "../../../db/schema";
import { getStoreAvailability, parseWeeklySchedule } from "../../../lib/store-hours";
import { buildWhatsappUrl } from "../../../lib/whatsapp-order";
import { getClientIp, isTrustedRequestOrigin } from "../../../lib/request-security";
import { takeMemoryRateLimit } from "../../../lib/memory-rate-limit";
import { ensurePixCharge, publicPayment } from "../../../lib/order-payment";
import { MercadoPagoError } from "../../../lib/mercado-pago";

const MAX_ITEMS = 40;
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
const phoneDigits = (value: string) => value.replace(/\D/g, "");

function validateOptionGroups(allOptions: Array<{ id: number; groupName: string; required: boolean; selectionMode: string; minSelections: number; maxSelections: number }>, selectedIds: number[]) {
  const groups = new Map<string, typeof allOptions>();
  for (const option of allOptions) groups.set(option.groupName, [...(groups.get(option.groupName) ?? []), option]);
  for (const [groupName, options] of groups) {
    const first = options[0];
    const selectedCount = options.filter((option) => selectedIds.includes(option.id)).length;
    const min = Math.max(...options.map((option) => option.minSelections || 0), options.some((option) => option.required) ? 1 : 0);
    const max = Math.max(1, first.selectionMode === "multiple" ? first.maxSelections || options.length : 1);
    if (selectedCount < min || selectedCount > max) throw new Error(`Confira as opções de ${groupName}.`);
    continue;
    if (options.length < min || options.length > max) throw new Error(`Confira as opções de ${groupName}.`);
  }
}

export async function POST(request: Request) {
  try {
    if (!isTrustedRequestOrigin(request)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
    if (!takeMemoryRateLimit("orders:create", getClientIp(request), 10, 10 * 60 * 1000)) return Response.json({ error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." }, { status: 429 });

    const payload = await request.json().catch(() => ({})) as {
      idempotencyKey?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      fulfillmentType?: "pickup" | "delivery";
      paymentMethod?: "pix" | "pay_on_fulfillment";
      address?: string;
      neighborhood?: string;
      notes?: string;
      items?: Array<{ productId?: number; quantity?: number; optionIds?: number[]; itemNotes?: string }>;
    };
    const idempotencyKey = text(payload.idempotencyKey, 80);
    const customerName = text(payload.customerName, 80);
    const customerPhone = text(payload.customerPhone, 30);
    const customerEmail = text(payload.customerEmail, 190).toLowerCase();
    const fulfillmentType = payload.fulfillmentType === "delivery" ? "delivery" : payload.fulfillmentType === "pickup" ? "pickup" : null;
    const paymentMethod = payload.paymentMethod === "pix" ? "pix" : "pay_on_fulfillment";
    const address = text(payload.address, 240);
    const neighborhood = text(payload.neighborhood, 100);
    const notes = text(payload.notes, 300);
    const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_ITEMS) : [];
    if (!idempotencyKey || customerName.length < 2 || phoneDigits(customerPhone).length < 8 || !fulfillmentType || !items.length) return Response.json({ error: "Confira os dados do pedido." }, { status: 400 });
    if (fulfillmentType === "delivery" && !address) return Response.json({ error: "Informe o endereço de entrega." }, { status: 400 });
    if (paymentMethod === "pix" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return Response.json({ error: "Informe um e-mail válido para gerar o PIX." }, { status: 400 });

    const db = getDb();
    const settingsRows = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    const settings = settingsRows[0];
    if (!settings) return Response.json({ error: "Pedidos temporariamente indisponíveis." }, { status: 503 });
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) {
      let existingOrder = existing[0];
      if (paymentMethod === "pay_on_fulfillment" && existingOrder.paymentMethod === "pix" && ["creating", "failed"].includes(existingOrder.paymentStatus)) {
        await db.update(orders).set({ paymentMethod, paymentStatus: "not_requested", paymentUpdatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") }).where(eq(orders.id, existingOrder.id));
        [existingOrder] = await db.select().from(orders).where(eq(orders.id, existingOrder.id)).limit(1);
      }
      if (paymentMethod === "pix" && existingOrder.paymentMethod === "pix" && ["creating", "failed"].includes(existingOrder.paymentStatus) && customerEmail && customerEmail !== existingOrder.customerEmail) {
        await db.update(orders).set({ customerEmail }).where(eq(orders.id, existingOrder.id));
        [existingOrder] = await db.select().from(orders).where(eq(orders.id, existingOrder.id)).limit(1);
      }
      if (existingOrder.paymentMethod === "pix" && ["creating", "failed"].includes(existingOrder.paymentStatus)) existingOrder = await ensurePixCharge(existingOrder);
      const existingItems = await db.select().from(orderItems).where(eq(orderItems.orderId, existingOrder.id));
      const whatsappUrl = existingOrder.paymentMethod === "pix" && existingOrder.paymentStatus !== "paid" ? null : buildWhatsappUrl(existingOrder, existingItems, settings?.whatsappNumber, settings?.whatsappTemplate as "complete" | "compact" | "quick");
      return Response.json({ order: existingOrder, payment: publicPayment(existingOrder, existingOrder.customerPhone), whatsappUrl, duplicate: true });
    }
    const availability = getStoreAvailability({ orderingMode: settings.orderingMode, weeklySchedule: parseWeeklySchedule(settings.weeklyScheduleJson) });
    if (!availability.isOpen) return Response.json({ error: availability.message }, { status: 409 });

    const productIds = [...new Set(items.map((item) => Number(item.productId)).filter(Number.isInteger))];
    const productRows = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.available, true)));
    const optionRows = productIds.length ? await db.select().from(productOptions).where(and(inArray(productOptions.productId, productIds), eq(productOptions.active, true))) : [];
    if (!productRows.length || productRows.length !== productIds.length) return Response.json({ error: "Um dos produtos não está mais disponível." }, { status: 409 });

    const rows = items.map((item) => {
      const product = productRows.find((row) => row.id === Number(item.productId));
      if (!product) throw new Error("Um dos produtos não está mais disponível.");
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      const requestedOptionIds = [...new Set((Array.isArray(item.optionIds) ? item.optionIds : []).map(Number).filter(Number.isInteger))];
      const selectedOptions = optionRows.filter((option) => requestedOptionIds.includes(option.id) && option.productId === product.id);
      if (selectedOptions.length !== requestedOptionIds.length) throw new Error("Uma das opções selecionadas não está disponível.");
      validateOptionGroups(optionRows.filter((option) => option.productId === product.id), requestedOptionIds);
      const optionDelta = selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0);
      return { product, quantity, selectedOptions, itemNotes: text(item.itemNotes, 220), unitPriceCents: product.priceCents + optionDelta };
    });
    const subtotalCents = rows.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0);
    const minimumOrderCents = settings?.minimumOrderCents ?? 0;
    if (minimumOrderCents > 0 && subtotalCents < minimumOrderCents) return Response.json({ error: `O pedido mínimo é ${money(minimumOrderCents)}.` }, { status: 400 });

    const zones = fulfillmentType === "delivery" ? await db.select().from(deliveryZones).where(eq(deliveryZones.active, true)) : [];
    const zone = zones.find((item) => normalize(item.name) === normalize(neighborhood));
    if (fulfillmentType === "delivery" && zones.length > 0 && !zone) return Response.json({ error: "Selecione um bairro de entrega válido." }, { status: 400 });
    const deliveryFeeCents = fulfillmentType === "delivery" ? (zone?.feeCents ?? settings?.defaultDeliveryFeeCents ?? 0) : 0;
    const totalCents = subtotalCents + deliveryFeeCents;
    const code = `CC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const result = await db.insert(orders).values({ code, status: "received", fulfillmentType, customerName, customerPhone, customerEmail: customerEmail || null, address: address || null, neighborhood: neighborhood || null, notes: notes || null, subtotalCents, deliveryFeeCents, totalCents, paymentMethod, paymentStatus: paymentMethod === "pix" ? "creating" : "not_requested", idempotencyKey });
    const [saved] = await db.select().from(orders).where(eq(orders.id, Number(result[0].insertId))).limit(1);
    if (!saved) throw new Error("Não foi possível salvar o pedido.");
    await db.insert(orderItems).values(rows.map((row) => ({ orderId: saved.id, productId: row.product.id, productName: row.product.name, quantity: row.quantity, unitPriceCents: row.unitPriceCents, optionsJson: JSON.stringify({ options: row.selectedOptions.map((option) => option.label) }), itemNotes: row.itemNotes || null })));
    const savedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, saved.id));
    let completedOrder = saved;
    if (paymentMethod === "pix") {
      try {
        completedOrder = await ensurePixCharge(saved);
      } catch (error) {
        const message = error instanceof MercadoPagoError ? error.message : "O pedido foi salvo, mas não foi possível gerar o PIX. Tente novamente ou escolha pagar ao receber.";
        return Response.json({ error: message, order: saved }, { status: error instanceof MercadoPagoError ? error.status : 502 });
      }
    }
    const whatsappUrl = completedOrder.paymentMethod === "pix" && completedOrder.paymentStatus !== "paid" ? null : buildWhatsappUrl(completedOrder, savedItems, settings?.whatsappNumber, settings?.whatsappTemplate as "complete" | "compact" | "quick");
    return Response.json({ order: completedOrder, payment: publicPayment(completedOrder, customerPhone), whatsappUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof MercadoPagoError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Não foi possível registrar o pedido.";
    if (message.includes("opções") || message.includes("produto") || message.includes("bairro")) return Response.json({ error: message }, { status: 400 });
    return Response.json({ error: message.includes("no such table") ? "O catálogo ainda está sendo configurado. Tente novamente em instantes." : "Não foi possível registrar o pedido." }, { status: 500 });
  }
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
