import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { deliveryZones, orders, orderItems, products, productOptions, storeSettings } from "../../../db/schema";

const MAX_ITEMS = 40;
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
const phoneDigits = (value: string) => value.replace(/\D/g, "");
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

function parseStoredOptions(value: string) {
  try {
    const parsed = JSON.parse(value) as { options?: string[] } | string[];
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.options) ? parsed.options : [];
  } catch {
    return [];
  }
}

function buildWhatsappUrl(order: typeof orders.$inferSelect, items: Array<typeof orderItems.$inferSelect>, whatsappNumber: string | null | undefined) {
  const phone = phoneDigits(whatsappNumber ?? "");
  if (!phone) return null;
  const lines = items.map((item) => {
    const options = parseStoredOptions(item.optionsJson);
    const suffix = [options.length ? ` (${options.join(", ")})` : "", item.itemNotes ? ` — Obs.: ${item.itemNotes}` : ""].join("");
    return `• ${item.quantity}x ${item.productName}${suffix} — ${money(item.unitPriceCents * item.quantity)}`;
  });
  const message = [
    `Olá! Quero confirmar o pedido ${order.code}.`,
    "",
    ...lines,
    "",
    `Cliente: ${order.customerName}`,
    `Telefone: ${order.customerPhone}`,
    order.fulfillmentType === "delivery" ? `Entrega: ${order.address ?? ""}${order.neighborhood ? ` — ${order.neighborhood}` : ""}` : "Retirada no balcão",
    order.notes ? `Observações: ${order.notes}` : "",
    `Subtotal: ${money(order.subtotalCents)}`,
    `Taxa de entrega: ${money(order.deliveryFeeCents)}`,
    `Total: ${money(order.totalCents)}`,
  ].filter(Boolean).join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

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
    const key = clientKey(request);
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetAt < now) attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    else if (current.count >= 10) return Response.json({ error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." }, { status: 429 });
    else current.count += 1;

    const payload = await request.json().catch(() => ({})) as {
      idempotencyKey?: string;
      customerName?: string;
      customerPhone?: string;
      fulfillmentType?: "pickup" | "delivery";
      address?: string;
      neighborhood?: string;
      notes?: string;
      items?: Array<{ productId?: number; quantity?: number; optionIds?: number[]; itemNotes?: string }>;
    };
    const idempotencyKey = text(payload.idempotencyKey, 80);
    const customerName = text(payload.customerName, 80);
    const customerPhone = text(payload.customerPhone, 30);
    const fulfillmentType = payload.fulfillmentType === "delivery" ? "delivery" : payload.fulfillmentType === "pickup" ? "pickup" : null;
    const address = text(payload.address, 240);
    const neighborhood = text(payload.neighborhood, 100);
    const notes = text(payload.notes, 300);
    const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_ITEMS) : [];
    if (!idempotencyKey || customerName.length < 2 || phoneDigits(customerPhone).length < 8 || !fulfillmentType || !items.length) return Response.json({ error: "Confira os dados do pedido." }, { status: 400 });
    if (fulfillmentType === "delivery" && !address) return Response.json({ error: "Informe o endereço de entrega." }, { status: 400 });

    const db = getDb();
    const settingsRows = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    const settings = settingsRows[0];
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) {
      const existingItems = await db.select().from(orderItems).where(eq(orderItems.orderId, existing[0].id));
      return Response.json({ order: existing[0], whatsappUrl: buildWhatsappUrl(existing[0], existingItems, settings?.whatsappNumber), duplicate: true });
    }

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
    const code = `CC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const result = await db.insert(orders).values({ code, status: "received", fulfillmentType, customerName, customerPhone, address: address || null, neighborhood: neighborhood || null, notes: notes || null, subtotalCents, deliveryFeeCents, totalCents, idempotencyKey });
    const [saved] = await db.select().from(orders).where(eq(orders.id, Number(result[0].insertId))).limit(1);
    if (!saved) throw new Error("Não foi possível salvar o pedido.");
    await db.insert(orderItems).values(rows.map((row) => ({ orderId: saved.id, productId: row.product.id, productName: row.product.name, quantity: row.quantity, unitPriceCents: row.unitPriceCents, optionsJson: JSON.stringify({ options: row.selectedOptions.map((option) => option.label) }), itemNotes: row.itemNotes || null })));
    const savedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, saved.id));
    return Response.json({ order: saved, whatsappUrl: buildWhatsappUrl(saved, savedItems, settings?.whatsappNumber) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar o pedido.";
    if (message.includes("opções") || message.includes("produto") || message.includes("bairro")) return Response.json({ error: message }, { status: 400 });
    return Response.json({ error: message.includes("no such table") ? "O catálogo ainda está sendo configurado. Tente novamente em instantes." : "Não foi possível registrar o pedido." }, { status: 500 });
  }
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
