import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { categories } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";

export async function GET() {
  try { await requireAdmin(); return Response.json({ categories: await getDb().select().from(categories).orderBy(asc(categories.sortOrder)) }); } catch (error) { return adminErrorResponse(error); }
}
export async function POST(request: Request) {
  try { const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request); const body = await request.json() as { name?: string; slug?: string; sortOrder?: number }; const name = body.name?.trim(); const slug = body.slug?.trim().toLowerCase(); if (!name || !slug) return Response.json({ error: "Nome e slug são obrigatórios." }, { status: 400 }); const db = getDb(); const result = await db.insert(categories).values({ name, slug, sortOrder: body.sortOrder ?? 0 }); const [category] = await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1); if (!category) return Response.json({ error: "Não foi possível criar a categoria." }, { status: 500 }); await recordAudit({ user, action: "create", entity: "category", entityId: category.id }); return Response.json({ category }, { status: 201 }); } catch (error) { return adminErrorResponse(error); }
}
export async function PATCH(request: Request) {
  try { const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request); const body = await request.json() as { id?: number; name?: string; slug?: string; sortOrder?: number; active?: boolean }; if (!body.id) return Response.json({ error: "Categoria inválida." }, { status: 400 }); const db = getDb(); await db.update(categories).set({ ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.slug !== undefined ? { slug: body.slug.trim().toLowerCase() } : {}), ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}), ...(body.active !== undefined ? { active: body.active } : {}) }).where(eq(categories.id, body.id)); const [category] = await db.select().from(categories).where(eq(categories.id, body.id)).limit(1); if (!category) return Response.json({ error: "Categoria não encontrada." }, { status: 404 }); await recordAudit({ user, action: "update", entity: "category", entityId: body.id }); return Response.json({ category }); } catch (error) { return adminErrorResponse(error); }
}
