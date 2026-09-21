import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { deliveryZones } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";

export async function GET() {
  try { await requireAdmin(); return Response.json({ zones: await getDb().select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name)) }); } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try { const user = await requireAdmin(); const body = await request.json() as Record<string, unknown>; const name = String(body.name ?? "").trim().slice(0, 80); const feeCents = Math.max(0, Math.round(Number(body.feeCents ?? 0))); if (!name) return Response.json({ error: "Informe o bairro." }, { status: 400 }); const db = getDb(); const result = await db.insert(deliveryZones).values({ name, feeCents, active: body.active !== false, sortOrder: Number(body.sortOrder) || 0 }); const [zone] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, Number(result[0].insertId))).limit(1); if (!zone) return Response.json({ error: "Não foi possível criar o bairro." }, { status: 500 }); await recordAudit({ user, action: "create", entity: "delivery_zone", entityId: zone.id, metadata: { name } }); return Response.json({ zone }, { status: 201 }); } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try { const user = await requireAdmin(); const body = await request.json() as Record<string, unknown>; const id = Number(body.id); if (!Number.isInteger(id)) return Response.json({ error: "Bairro inválido." }, { status: 400 }); const db = getDb(); await db.update(deliveryZones).set({ ...(body.name !== undefined ? { name: String(body.name).trim().slice(0, 80) } : {}), ...(body.feeCents !== undefined ? { feeCents: Math.max(0, Math.round(Number(body.feeCents))) } : {}), ...(body.active !== undefined ? { active: Boolean(body.active) } : {}), ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}) }).where(eq(deliveryZones.id, id)); const [zone] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id)).limit(1); if (!zone) return Response.json({ error: "Bairro não encontrado." }, { status: 404 }); await recordAudit({ user, action: "update", entity: "delivery_zone", entityId: id }); return Response.json({ zone }); } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try { const user = await requireAdmin(); const id = Number(new URL(request.url).searchParams.get("id")); if (!Number.isInteger(id)) return Response.json({ error: "Bairro inválido." }, { status: 400 }); const db = getDb(); const [zone] = await db.select().from(deliveryZones).where(eq(deliveryZones.id, id)).limit(1); if (!zone) return Response.json({ error: "Bairro não encontrado." }, { status: 404 }); await db.delete(deliveryZones).where(eq(deliveryZones.id, id)); await recordAudit({ user, action: "delete", entity: "delivery_zone", entityId: id }); return Response.json({ ok: true }); } catch (error) { return adminErrorResponse(error); }
}
