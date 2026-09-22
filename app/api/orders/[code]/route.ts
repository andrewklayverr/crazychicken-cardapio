import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";

const digits = (value: string) => value.replace(/\D/g, "");

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const phone = new URL(request.url).searchParams.get("phone") ?? "";
    const db = getDb();
    const [order] = await db.select().from(orders).where(and(eq(orders.code, code.trim()), eq(orders.customerPhone, phone.trim()))).limit(1);
    if (!order) {
      const candidates = await db.select({ id: orders.id, customerPhone: orders.customerPhone }).from(orders).where(eq(orders.code, code.trim())).limit(1);
      if (!candidates[0] || digits(candidates[0].customerPhone) !== digits(phone)) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
      const [matched] = await db.select().from(orders).where(eq(orders.id, candidates[0].id)).limit(1);
      if (!matched) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, matched.id));
      return Response.json({ order: matched, items });
    }
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return Response.json({ order, items });
  } catch {
    return Response.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
  }
}
