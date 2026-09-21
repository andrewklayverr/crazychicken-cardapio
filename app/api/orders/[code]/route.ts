import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
    if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return Response.json({ order, items });
  } catch {
    return Response.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
  }
}
