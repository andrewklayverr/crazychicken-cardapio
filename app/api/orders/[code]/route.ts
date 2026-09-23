import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { takeMemoryRateLimit } from "../../../../lib/memory-rate-limit";
import { getClientIp } from "../../../../lib/request-security";

const digits = (value: string) => value.replace(/\D/g, "");

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    if (!takeMemoryRateLimit("orders:track", getClientIp(request), 30, 10 * 60 * 1000)) return Response.json({ error: "Muitas consultas. Aguarde alguns minutos." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    const params = await context.params;
    const code = params.code.trim().toUpperCase().slice(0, 48);
    const phone = (new URL(request.url).searchParams.get("phone") ?? "").trim().slice(0, 30);
    if (!/^CC-[A-Z0-9-]+$/.test(code) || digits(phone).length < 8) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const db = getDb();
    const [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.customerPhone, phone))).limit(1);
    if (!order) {
      const candidates = await db.select({ id: orders.id, customerPhone: orders.customerPhone }).from(orders).where(eq(orders.code, code)).limit(1);
      if (!candidates[0] || digits(candidates[0].customerPhone) !== digits(phone)) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
      const [matched] = await db.select().from(orders).where(eq(orders.id, candidates[0].id)).limit(1);
      if (!matched) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, matched.id));
      return Response.json({ order: matched, items }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return Response.json({ order, items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
  }
}
