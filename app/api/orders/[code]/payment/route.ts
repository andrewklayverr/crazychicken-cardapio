import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { orderItems, orders, storeSettings } from "../../../../../db/schema";
import { getClientIp } from "../../../../../lib/request-security";
import { takeMemoryRateLimit } from "../../../../../lib/memory-rate-limit";
import { publicPayment, syncPixCharge } from "../../../../../lib/order-payment";
import { buildWhatsappUrl } from "../../../../../lib/whatsapp-order";

const digits = (value: string) => value.replace(/\D/g, "");

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    if (!takeMemoryRateLimit("orders:payment", getClientIp(request), 60, 10 * 60 * 1000)) return Response.json({ error: "Muitas consultas. Aguarde alguns minutos." }, { status: 429, headers: noStore });
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase().slice(0, 48);
    const phone = (new URL(request.url).searchParams.get("phone") ?? "").trim().slice(0, 30);
    if (!/^CC-[A-Z0-9-]+$/.test(code) || digits(phone).length < 8) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: noStore });
    const db = getDb();
    let [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.customerPhone, phone))).limit(1);
    if (!order) {
      const [candidate] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
      if (!candidate || digits(candidate.customerPhone) !== digits(phone)) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: noStore });
      order = candidate;
    }
    let syncUnavailable = false;
    if (order.paymentMethod === "pix" && order.paymentStatus !== "paid") {
      try { order = await syncPixCharge(order); } catch { syncUnavailable = true; }
    }
    const [settings] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    const items = order.paymentStatus === "paid" ? await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) : [];
    const whatsappUrl = order.paymentMethod === "pix" && order.paymentStatus === "paid" ? buildWhatsappUrl(order, items, settings?.whatsappNumber, settings?.whatsappTemplate as "complete" | "compact" | "quick") : null;
    return Response.json({ payment: publicPayment(order, phone), whatsappUrl, syncUnavailable }, { headers: noStore });
  } catch {
    return Response.json({ error: "Não foi possível consultar o pagamento." }, { status: 500, headers: noStore });
  }
}
