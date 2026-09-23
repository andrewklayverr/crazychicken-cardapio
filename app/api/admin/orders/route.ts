import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";

const validStatuses = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const search = new URL(request.url).searchParams;
    const id = Number(search.get("id"));
    if (Number.isInteger(id) && id > 0) {
      const [order] = await getDb().select().from(orders).where(eq(orders.id, id)).limit(1);
      if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
      const items = await getDb().select().from(orderItems).where(eq(orderItems.orderId, id));
      return Response.json({ order, items });
    }
    const status = search.get("status");
    const from = search.get("from");
    const to = search.get("to");
    const filters: SQL[] = [];
    if (status && validStatuses.includes(status)) filters.push(eq(orders.status, status));
    if (from) filters.push(gte(orders.createdAt, from.slice(0, 19).replace("T", " ")));
    if (to) filters.push(lte(orders.createdAt, to.slice(0, 19).replace("T", " ")));
    const where = filters.length ? and(...filters) : undefined;
    const rows = await getDb().select().from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id));
    return Response.json({ orders: rows });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const user = await requireAdmin(); await validateAdminMutation(request); const body = await request.json() as { id?: number; status?: string }; if (!body.id || !body.status || !validStatuses.includes(body.status)) return Response.json({ error: "Status inválido." }, { status: 400 }); const db = getDb(); await db.update(orders).set({ status: body.status, updatedAt: new Date().toISOString() }).where(eq(orders.id, body.id)); const [order] = await db.select().from(orders).where(eq(orders.id, body.id)).limit(1); if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 }); await recordAudit({ user, action: "status_change", entity: "order", entityId: body.id, metadata: { status: body.status } }); return Response.json({ order }); } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); const body = await request.json() as { id?: number }; if (!body.id) return Response.json({ error: "Pedido inválido." }, { status: 400 }); const [order] = await getDb().select().from(orders).where(eq(orders.id, body.id)).limit(1); const items = order ? await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id)) : []; if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 }); return Response.json({ order, items }); } catch (error) { return adminErrorResponse(error); }
}
