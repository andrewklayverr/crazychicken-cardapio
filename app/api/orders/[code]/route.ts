import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { takeMemoryRateLimit } from "../../../../lib/memory-rate-limit";
import { getClientIp } from "../../../../lib/request-security";
import { publicPayment } from "../../../../lib/order-payment";

const digits = (value: string) => value.replace(/\D/g, "");

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    if (!takeMemoryRateLimit("orders:track", getClientIp(request), 30, 10 * 60 * 1000)) return Response.json({ error: "Muitas consultas. Aguarde alguns minutos." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const params = await context.params;
    const requestedCode = params.code.trim().toUpperCase().slice(0, 48);
    const numericId = /^#?(\d{1,10})$/.exec(requestedCode)?.[1];
    const phone = (new URL(request.url).searchParams.get("phone") ?? "").trim().slice(0, 30);
    if ((!numericId && !/^CC-[A-Z0-9-]+$/.test(requestedCode)) || digits(phone).length < 8) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const db = getDb();
    const [order] = numericId
      ? await db.select().from(orders).where(eq(orders.id, Number(numericId))).limit(1)
      : await db.select().from(orders).where(eq(orders.code, requestedCode)).limit(1);
    if (!order || digits(order.customerPhone) !== digits(phone)) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return Response.json({ order, items, payment: publicPayment(order, phone) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
  }
}
