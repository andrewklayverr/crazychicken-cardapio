import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { categories, productOptions, products } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";
import { centsFromValue } from "../../../../lib/store";

type OptionInput = {
  groupName?: unknown;
  label?: unknown;
  priceDeltaCents?: unknown;
  required?: unknown;
  selectionMode?: unknown;
  minSelections?: unknown;
  maxSelections?: unknown;
};

function normalizeOptions(value: unknown, productId: number) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 50).map((raw, index) => {
    const option = (raw ?? {}) as OptionInput;
    const groupName = String(option.groupName ?? "").trim().slice(0, 100);
    const label = String(option.label ?? "").trim().slice(0, 120);
    if (!groupName || !label) throw new Error("Grupo e nome da opção são obrigatórios.");
    const selectionMode = option.selectionMode === "multiple" ? "multiple" : "single";
    const required = option.required === true;
    const rawPrice = option.priceDeltaCents;
    const rawPriceNumber = Number(rawPrice);
    const priceDeltaCents = Number.isInteger(rawPriceNumber) ? rawPriceNumber : centsFromValue(rawPrice);
    const maxSelections = selectionMode === "single" ? 1 : Math.max(1, Math.min(20, Number(option.maxSelections) || 5));
    const minSelections = Math.max(0, Math.min(maxSelections, Number(option.minSelections) || (required ? 1 : 0)));
    return { productId, groupName, label, priceDeltaCents: Number.isFinite(priceDeltaCents) ? priceDeltaCents : 0, required, selectionMode, minSelections, maxSelections, active: true, sortOrder: index };
  });
}

async function replaceOptions(db: ReturnType<typeof getDb>, productId: number, value: unknown) {
  const normalized = normalizeOptions(value, productId);
  if (normalized === null) return;
  await db.delete(productOptions).where(eq(productOptions.productId, productId));
  if (normalized.length) await db.insert(productOptions).values(normalized);
}

export async function GET() {
  try {
    await requireAdmin();
    const db = getDb();
    const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
    const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const options = await db.select().from(productOptions).orderBy(asc(productOptions.sortOrder), asc(productOptions.id));
    return Response.json({
      products: rows.map((product) => ({ ...product, options: options.filter((option) => option.productId === product.id) })),
      categories: cats,
      options,
    });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const categoryId = Number(body.categoryId);
    if (!name || !Number.isInteger(categoryId)) return Response.json({ error: "Nome e categoria são obrigatórios." }, { status: 400 });
    const db = getDb();
    const result = await db.insert(products).values({ categoryId, name: name.slice(0, 100), description: String(body.description ?? "").slice(0, 300), priceCents: Number.isInteger(body.priceCents) ? Number(body.priceCents) : centsFromValue(body.price), imageKey: body.imageKey ? String(body.imageKey) : null, badge: body.badge ? String(body.badge).slice(0, 40) : null, available: body.available !== false, featured: body.featured === true, sortOrder: Number(body.sortOrder) || 0 });
    const [product] = await db.select().from(products).where(eq(products.id, Number(result[0].insertId))).limit(1);
    if (!product) return Response.json({ error: "Não foi possível criar o produto." }, { status: 500 });
    await replaceOptions(db, product.id, body.options);
    const savedOptions = await db.select().from(productOptions).where(eq(productOptions.productId, product.id)).orderBy(asc(productOptions.sortOrder), asc(productOptions.id));
    await recordAudit({ user, action: "create", entity: "product", entityId: product.id, metadata: { name: product.name } });
    return Response.json({ product: { ...product, options: savedOptions } }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
    const db = getDb();
    await db.update(products).set({ ...(body.name !== undefined ? { name: String(body.name).trim().slice(0, 100) } : {}), ...(body.description !== undefined ? { description: String(body.description).slice(0, 300) } : {}), ...(body.categoryId !== undefined ? { categoryId: Number(body.categoryId) } : {}), ...(body.priceCents !== undefined || body.price !== undefined ? { priceCents: body.priceCents !== undefined ? Number(body.priceCents) : centsFromValue(body.price) } : {}), ...(body.imageKey !== undefined ? { imageKey: body.imageKey ? String(body.imageKey) : null } : {}), ...(body.badge !== undefined ? { badge: body.badge ? String(body.badge).slice(0, 40) : null } : {}), ...(body.available !== undefined ? { available: Boolean(body.available) } : {}), ...(body.featured !== undefined ? { featured: Boolean(body.featured) } : {}), ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}), updatedAt: new Date().toISOString() }).where(eq(products.id, id));
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    await replaceOptions(db, product.id, body.options);
    const savedOptions = await db.select().from(productOptions).where(eq(productOptions.productId, product.id)).orderBy(asc(productOptions.sortOrder), asc(productOptions.id));
    await recordAudit({ user, action: "update", entity: "product", entityId: id, metadata: { name: product.name } });
    return Response.json({ product: { ...product, options: savedOptions } });
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "Produto inválido." }, { status: 400 });
    const db = getDb();
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    await db.delete(productOptions).where(eq(productOptions.productId, id));
    await db.delete(products).where(eq(products.id, id));
    await recordAudit({ user, action: "delete", entity: "product", entityId: id, metadata: { name: product.name } });
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
