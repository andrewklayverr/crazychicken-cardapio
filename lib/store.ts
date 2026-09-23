import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { categories, deliveryZones, productOptions, products, storeSettings } from "../db/schema";
import { fallbackCategories, fallbackProducts, fallbackSettings, type CatalogProduct } from "./catalog";
import { getStoreAvailability, parseWeeklySchedule } from "./store-hours";

export function assetUrl(key: string | null | undefined) {
  if (!key) return "/hero-food.jpeg";
  if (key.startsWith("/")) return key;
  if (key.includes(".") && !key.includes("/")) return `/${key}`;
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function getStorefront() {
  try {
    const db = getDb();
    const [categoryRows, productRows, optionRows, settingRows, zoneRows] = await Promise.all([
      db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder)),
      db.select().from(products).where(eq(products.available, true)).orderBy(asc(products.sortOrder)),
      db.select().from(productOptions).where(eq(productOptions.active, true)).orderBy(asc(productOptions.sortOrder)),
      db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1),
      db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder)),
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
        options: (optionsByProduct.get(product.id) ?? []).map((option) => ({ id: option.id, groupName: option.groupName, label: option.label, priceDeltaCents: option.priceDeltaCents, required: option.required, selectionMode: option.selectionMode as "single" | "multiple", minSelections: option.minSelections, maxSelections: option.maxSelections })),
      };
    });
    const setting = settingRows[0];
    return {
      categories: categoryRows,
      products: mappedProducts,
      settings: setting ? (() => { const weeklySchedule = parseWeeklySchedule(setting.weeklyScheduleJson); const normalized = { ...fallbackSettings, ...setting, whatsappNumber: setting.whatsappNumber ?? "", logoKey: setting.logoKey || fallbackSettings.logoKey, orderingMode: setting.orderingMode ?? "open", weeklySchedule, appearance: parseAppearance(setting.appearanceJson) }; return { ...normalized, availability: getStoreAvailability(normalized) }; })() : { ...fallbackSettings, availability: getStoreAvailability(fallbackSettings) },
      deliveryZones: zoneRows.map((zone) => ({ id: zone.id, name: zone.name, feeCents: zone.feeCents })),
    };
  } catch {
    return { categories: fallbackCategories, products: fallbackProducts, settings: { ...fallbackSettings, availability: getStoreAvailability(fallbackSettings) }, deliveryZones: [] };
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
