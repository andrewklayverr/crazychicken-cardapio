import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { orders } from "../../../../../db/schema";
import { applyMercadoPagoOrder } from "../../../../../lib/order-payment";
import { getMercadoPagoOrder, mercadoPagoWebhookSecret, validateMercadoPagoWebhookSignature } from "../../../../../lib/mercado-pago";

const MAX_WEBHOOK_BYTES = 64 * 1024;

type WebhookPayload = {
  action?: string;
  type?: string;
  data?: { id?: string };
};

export async function POST(request: Request) {
  const secret = mercadoPagoWebhookSecret();
  if (!secret) return Response.json({ error: "Webhook não configurado." }, { status: 503 });

  const requestUrl = new URL(request.url);
  const dataId = (requestUrl.searchParams.get("data.id") ?? "").trim();
  const xRequestId = request.headers.get("x-request-id") ?? "";
  const xSignature = request.headers.get("x-signature") ?? "";
  if (!validateMercadoPagoWebhookSignature({ xSignature, xRequestId, dataId, secret })) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload muito grande." }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload muito grande." }, { status: 413 });

  let payload: WebhookPayload;
  try { payload = JSON.parse(raw) as WebhookPayload; } catch { return Response.json({ error: "Payload inválido." }, { status: 400 }); }
  const bodyDataId = typeof payload.data?.id === "string" ? payload.data.id.trim() : "";
  if (!bodyDataId || bodyDataId.toLowerCase() !== dataId.toLowerCase()) return Response.json({ error: "Cobrança inválida." }, { status: 400 });
  if (!["order", "orders"].includes(String(payload.type).toLowerCase())) return new Response(null, { status: 204 });

  const providerOrder = await getMercadoPagoOrder(dataId);
  if (!providerOrder.id || providerOrder.id.toLowerCase() !== dataId.toLowerCase()) return Response.json({ error: "Cobrança inválida." }, { status: 409 });

  const db = getDb();
  let [order] = await db.select().from(orders).where(eq(orders.mercadoPagoOrderId, providerOrder.id)).limit(1);
  if (!order && providerOrder.external_reference && /^CC-[A-Z0-9-]+$/.test(providerOrder.external_reference)) {
    [order] = await db.select().from(orders).where(eq(orders.code, providerOrder.external_reference)).limit(1);
  }
  if (!order) return Response.json({ ok: true });

  await applyMercadoPagoOrder(order, providerOrder);
  return Response.json({ ok: true });
}
