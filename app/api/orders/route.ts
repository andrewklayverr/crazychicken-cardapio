import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { deliveryZones, orders, orderItems, products, productOptions, storeSettings } from "../../../db/schema";

const MAX_ITEMS = 40;
const text = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

export async function POST(request: Request) {
  try {
    const key = clientKey(request);
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetAt < now) attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    else if (current.count >= 10) return Response.json({ error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." }, { status: 429 });
    else current.count += 1;
    const payload = await request.json() as {
      idempotencyKey?: string;
      customerName?: string;
      customerPhone?: string;
      fulfillmentType?: "pickup" | "delivery";
      address?: string;
      neighborhood?: string;
      notes?: string;
      items?: Array<{ productId?: number; quantity?: number; optionIds?: number[] }>;
    };
    const idempotencyKey = text(payload.idempotencyKey, 80);
    const customerName = text(payload.customerName, 80);
    const customerPhone = text(payload.customerPhone, 30);
    const fulfillmentType = payload.fulfillmentType === "delivery" ? "delivery" : payload.fulfillmentType === "pickup" ? "pickup" : null;
    const address = text(payload.address, 240);
    const neighborhood = text(payload.neighborhood, 80);
    const notes = text(payload.notes, 300);
    const items = Array.isArray(payload.items) ? payload.items.slice(0, MAX_ITEMS) : [];
    if (!idempotencyKey || customerName.length < 2 || customerPhone.length < 8 || !fulfillmentType || !items.length) return Response.json({ error: "Confira os dados do pedido." }, { status: 400 });
    if (fulfillmentType === "delivery" && !address) return Response.json({ error: "Informe o endereço de entrega." }, { status: 400 });

    const db = getDb();
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) return Response.json({ order: existing[0], duplicate: true });

    const productIds = [...new Set(items.map((item) => Number(item.productId)).filter(Number.isInteger))];
    const productRows = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.available, true)));
    const optionIds = [...new Set(items.flatMap((item) => Array.isArray(item.optionIds) ? item.optionIds : []).map(Number).filter(Number.isInteger))];
    const optionRows = optionIds.length ? await db.select().from(productOptions).where(and(inArray(productOptions.id, optionIds), eq(productOptions.active, true))) : [];
    const settingsRows = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    const settings = settingsRows[0];
    if (!productRows.length || productRows.length !== productIds.length) return Response.json({ error: "Um dos produtos não está mais disponível." }, { status: 409 });

    const rows = items.map((item) => {
      const product = productRows.find((row) => row.id === Number(item.productId));
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      const selectedOptions = optionRows.filter((option) => (item.optionIds ?? []).includes(option.id) && option.productId === product?.id);
      const optionDelta = selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0);
      return { product, quantity, selectedOptions, unitPriceCents: (product?.priceCents ?? 0) + optionDelta };
    });
    const subtotalCents = rows.reduce((sum, row) => sum + row.unitPriceCents * row.quantity, 0);
    const minimumOrderCents = settings?.minimumOrderCents ?? 0;
    if (minimumOrderCents > 0 && subtotalCents < minimumOrderCents) return Response.json({ error: `O pedido mínimo é ${money(minimumOrderCents)}.` }, { status: 400 });
    const zones = fulfillmentType === "delivery" ? await db.select().from(deliveryZones).where(eq(deliveryZones.active, true)) : [];
    const zone = zones.find((item) => item.name.trim().toLocaleLowerCase("pt-BR") === neighborhood.toLocaleLowerCase("pt-BR"));
    const deliveryFeeCents = fulfillmentType === "delivery" ? (zone?.feeCents ?? settings?.defaultDeliveryFeeCents ?? 0) : 0;
    const totalCents = subtotalCents + deliveryFeeCents;
    const code = `CC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const result = await db.insert(orders).values({ code, status: "received", fulfillmentType, customerName, customerPhone, address: address || null, neighborhood: neighborhood || null, notes: notes || null, subtotalCents, deliveryFeeCents, totalCents, idempotencyKey });
    const [saved] = await db.select().from(orders).where(eq(orders.id, Number(result[0].insertId))).limit(1);
    if (!saved) throw new Error("Não foi possível salvar o pedido.");
    await db.insert(orderItems).values(rows.map((row) => ({ orderId: saved.id, productId: row.product!.id, productName: row.product!.name, quantity: row.quantity, unitPriceCents: row.unitPriceCents, optionsJson: JSON.stringify(row.selectedOptions.map((option) => option.label)) })));
    return Response.json({ order: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar o pedido.";
    return Response.json({ error: message.includes("no such table") ? "O catálogo ainda está sendo configurado. Tente novamente em instantes." : "Não foi possível registrar o pedido." }, { status: 500 });
  }
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
