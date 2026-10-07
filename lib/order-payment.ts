import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { createMercadoPagoOrder, getMercadoPagoOrder, mapMercadoPagoStatus, mercadoPagoIdempotencyKey, mercadoPagoPayment, mercadoPagoPixExpiresInSeconds, validateMercadoPagoOrder, type MercadoPagoOrder } from "./mercado-pago";

type Order = typeof orders.$inferSelect;

const mysqlTimestamp = (value: string | Date = new Date()) => {
  const parsed = new Date(value);
  return (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString().slice(0, 19).replace("T", " ");
};

function safePaymentLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowed = url.protocol === "https:" && (["mercadopago.com", "mercadopago.com.br"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)));
    return allowed ? url.toString().slice(0, 500) : null;
  } catch { return null; }
}

function safeQrCodeBase64(value: string | undefined) {
  if (!value || value.length > 2_800_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  return value;
}

function chargePatch(providerOrder: MercadoPagoOrder, order: Order, created = false) {
  const payment = mercadoPagoPayment(providerOrder);
  const status = mapMercadoPagoStatus(providerOrder);
  const method = payment?.payment_method;
  const paidAt = status === "paid" ? order.pixPaidAt ?? mysqlTimestamp() : order.pixPaidAt;
  return {
    paymentStatus: order.paymentStatus === "paid" ? "paid" : status,
    mercadoPagoOrderId: providerOrder.id ?? order.mercadoPagoOrderId,
    mercadoPagoPaymentId: payment?.id?.slice(0, 120) ?? order.mercadoPagoPaymentId,
    pixBrCode: method?.qr_code ?? order.pixBrCode,
    pixQrCodeBase64: safeQrCodeBase64(method?.qr_code_base64) ?? order.pixQrCodeBase64,
    pixPaymentLinkUrl: safePaymentLink(method?.ticket_url) ?? order.pixPaymentLinkUrl,
    pixExpiresAt: created && !order.pixExpiresAt ? mysqlTimestamp(new Date(Date.now() + mercadoPagoPixExpiresInSeconds() * 1000)) : order.pixExpiresAt,
    pixPaidAt: paidAt,
    paymentUpdatedAt: mysqlTimestamp(),
  };
}

export async function ensurePixCharge(order: Order) {
  if (order.paymentMethod !== "pix") return order;
  if (order.pixBrCode && order.mercadoPagoOrderId && ["pending", "paid"].includes(order.paymentStatus)) return order;
  if (!order.customerEmail) throw new Error("Informe um e-mail válido para gerar o PIX.");
  const db = getDb();
  await db.update(orders).set({ paymentStatus: "creating", paymentUpdatedAt: mysqlTimestamp() }).where(eq(orders.id, order.id));
  try {
    const providerOrder = order.mercadoPagoOrderId
      ? validateMercadoPagoOrder(await getMercadoPagoOrder(order.mercadoPagoOrderId), { orderId: order.mercadoPagoOrderId, externalReference: order.code, valueCents: order.totalCents })
      : await createMercadoPagoOrder({ externalReference: order.code, valueCents: order.totalCents, payerEmail: order.customerEmail, idempotencyKey: mercadoPagoIdempotencyKey(order.idempotencyKey, order.code) });
    await db.update(orders).set(chargePatch(providerOrder, order, !order.mercadoPagoOrderId)).where(eq(orders.id, order.id));
  } catch (error) {
    await db.update(orders).set({ paymentStatus: "failed", paymentUpdatedAt: mysqlTimestamp() }).where(eq(orders.id, order.id));
    throw error;
  }
  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
  return updated ?? order;
}

export async function syncPixCharge(order: Order) {
  if (order.paymentMethod !== "pix" || !order.mercadoPagoOrderId || order.paymentStatus === "paid") return order;
  const providerOrder = validateMercadoPagoOrder(await getMercadoPagoOrder(order.mercadoPagoOrderId), { orderId: order.mercadoPagoOrderId, externalReference: order.code, valueCents: order.totalCents });
  await getDb().update(orders).set(chargePatch(providerOrder, order)).where(eq(orders.id, order.id));
  const [updated] = await getDb().select().from(orders).where(eq(orders.id, order.id)).limit(1);
  return updated ?? order;
}

export function publicPayment(order: Order, phone: string) {
  if (order.paymentMethod !== "pix") return { method: "pay_on_fulfillment" as const, status: "not_requested" as const };
  return {
    method: "pix" as const,
    status: order.paymentStatus,
    brCode: order.pixBrCode,
    paymentLinkUrl: order.pixPaymentLinkUrl,
    expiresAt: order.pixExpiresAt,
    paidAt: order.pixPaidAt,
    qrCodeUrl: order.pixQrCodeBase64 ? `/api/orders/${encodeURIComponent(order.code)}/payment/qr?phone=${encodeURIComponent(phone)}` : null,
  };
}

export async function applyMercadoPagoOrder(order: Order, providerOrder: MercadoPagoOrder) {
  const verified = validateMercadoPagoOrder(providerOrder, { orderId: order.mercadoPagoOrderId ?? providerOrder.id, externalReference: order.code, valueCents: order.totalCents });
  await getDb().update(orders).set(chargePatch(verified, order)).where(eq(orders.id, order.id));
  const [updated] = await getDb().select().from(orders).where(eq(orders.id, order.id)).limit(1);
  return updated ?? order;
}
