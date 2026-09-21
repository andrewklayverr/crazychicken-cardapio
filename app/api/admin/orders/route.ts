import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";

const validStatuses = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

export async function GET(request: Request) {
  try { await requireAdmin(); const status = new URL(request.url).searchParams.get("status"); const where = status && validStatuses.includes(status) ? eq(orders.status, status) : undefined; const rows = await getDb().select().from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id)); return Response.json({ orders: rows }); } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const user = await requireAdmin(); const body = await request.json() as { id?: number; status?: string }; if (!body.id || !body.status || !validStatuses.includes(body.status)) return Response.json({ error: "Status inválido." }, { status: 400 }); const [order] = await getDb().update(orders).set({ status: body.status, updatedAt: new Date().toISOString() }).where(eq(orders.id, body.id)).returning(); if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 }); await recordAudit({ user, action: "status_change", entity: "order", entityId: body.id, metadata: { status: body.status } }); return Response.json({ order }); } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try { await requireAdmin(); const body = await request.json() as { id?: number }; if (!body.id) return Response.json({ error: "Pedido inválido." }, { status: 400 }); const [order] = await getDb().select().from(orders).where(eq(orders.id, body.id)).limit(1); const items = order ? await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id)) : []; if (!order) return Response.json({ error: "Pedido não encontrado." }, { status: 404 }); return Response.json({ order, items }); } catch (error) { return adminErrorResponse(error); }
}
