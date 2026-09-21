import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { categories, productOptions, products } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { centsFromValue } from "../../../../lib/store";

export async function GET() {
  try {
    await requireAdmin();
    const db = getDb();
    const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
    const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const options = await db.select().from(productOptions).orderBy(asc(productOptions.sortOrder));
    return Response.json({ products: rows, categories: cats, options });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const categoryId = Number(body.categoryId);
    if (!name || !Number.isInteger(categoryId)) return Response.json({ error: "Nome e categoria são obrigatórios." }, { status: 400 });
    const db = getDb();
    const [product] = await db.insert(products).values({ categoryId, name: name.slice(0, 100), description: String(body.description ?? "").slice(0, 300), priceCents: Number.isInteger(body.priceCents) ? Number(body.priceCents) : centsFromValue(body.price), imageKey: body.imageKey ? String(body.imageKey) : null, badge: body.badge ? String(body.badge).slice(0, 40) : null, available: body.available !== false, featured: body.featured === true, sortOrder: Number(body.sortOrder) || 0 }).returning();
    await recordAudit({ user, action: "create", entity: "product", entityId: product.id, metadata: { name: product.name } });
    return Response.json({ product }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
    const db = getDb();
    const [product] = await db.update(products).set({ ...(body.name !== undefined ? { name: String(body.name).trim().slice(0, 100) } : {}), ...(body.description !== undefined ? { description: String(body.description).slice(0, 300) } : {}), ...(body.categoryId !== undefined ? { categoryId: Number(body.categoryId) } : {}), ...(body.priceCents !== undefined || body.price !== undefined ? { priceCents: body.priceCents !== undefined ? Number(body.priceCents) : centsFromValue(body.price) } : {}), ...(body.imageKey !== undefined ? { imageKey: body.imageKey ? String(body.imageKey) : null } : {}), ...(body.badge !== undefined ? { badge: body.badge ? String(body.badge).slice(0, 40) : null } : {}), ...(body.available !== undefined ? { available: Boolean(body.available) } : {}), ...(body.featured !== undefined ? { featured: Boolean(body.featured) } : {}), ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}), updatedAt: new Date().toISOString() }).where(eq(products.id, id)).returning();
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    await recordAudit({ user, action: "update", entity: "product", entityId: id, metadata: { name: product.name } });
    return Response.json({ product });
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdmin();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
    const db = getDb();
    const [product] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    await recordAudit({ user, action: "delete", entity: "product", entityId: id, metadata: { name: product.name } });
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
