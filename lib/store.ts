import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { categories, productOptions, products, storeSettings } from "../db/schema";
import { fallbackCategories, fallbackProducts, fallbackSettings, type CatalogProduct } from "./catalog";

export function assetUrl(key: string | null | undefined) {
  if (!key) return "/hero-food.jpeg";
  if (key.startsWith("/")) return key;
  if (key.includes(".") && !key.includes("/")) return `/${key}`;
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function getStorefront() {
  try {
    const db = getDb();
    const [categoryRows, productRows, optionRows, settingRows] = await Promise.all([
      db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder)),
      db.select().from(products).where(eq(products.available, true)).orderBy(asc(products.sortOrder)),
      db.select().from(productOptions).where(eq(productOptions.active, true)).orderBy(asc(productOptions.sortOrder)),
      db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1),
    ]);
    if (!categoryRows.length || !productRows.length) throw new Error("catalog-not-seeded");
    const optionsByProduct = new Map<number, typeof optionRows>();
    for (const option of optionRows) {
      const current = optionsByProduct.get(option.productId) ?? [];
      current.push(option);
      optionsByProduct.set(option.productId, current);
    }
    const mappedProducts: CatalogProduct[] = productRows.map((product) => {
      const category = categoryRows.find((item) => item.id === product.categoryId);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        category: category?.name ?? "Outros",
        slug: String(product.id),
        imageKey: product.imageKey,
        badge: product.badge,
        available: product.available,
        featured: product.featured,
        options: (optionsByProduct.get(product.id) ?? []).map((option) => ({ id: option.id, groupName: option.groupName, label: option.label, priceDeltaCents: option.priceDeltaCents, required: option.required })),
      };
    });
    const setting = settingRows[0];
    return {
      categories: categoryRows,
      products: mappedProducts,
      settings: setting ? { ...fallbackSettings, ...setting, appearance: parseAppearance(setting.appearanceJson) } : fallbackSettings,
    };
  } catch {
    return { categories: fallbackCategories, products: fallbackProducts, settings: fallbackSettings };
  }
}

export function parseAppearance(value: string | null | undefined) {
  try {
    return { ...fallbackSettings.appearance, ...(value ? JSON.parse(value) : {}) };
  } catch {
    return fallbackSettings.appearance;
  }
}

export function centsFromValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

export function formatOrderCode(id: number) {
  return `CC-${String(id).padStart(4, "0")}`;
}
