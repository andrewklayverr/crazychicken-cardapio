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

type StoredSettings = typeof storeSettings.$inferSelect;

function normalizedSettings(setting: StoredSettings) {
  const weeklySchedule = parseWeeklySchedule(setting.weeklyScheduleJson);
  const normalized = {
    ...fallbackSettings,
    ...setting,
    whatsappNumber: setting.whatsappNumber ?? "",
    logoKey: setting.logoKey || fallbackSettings.logoKey,
    orderingMode: setting.orderingMode ?? "open",
    weeklySchedule,
    appearance: parseAppearance(setting.appearanceJson),
  };
  return { ...normalized, availability: getStoreAvailability(normalized) };
}

function unavailableSettings() {
  const safe = { ...fallbackSettings, orderingMode: "closed" as const };
  return { ...safe, updatedAt: null, availability: { isOpen: false, mode: "closed" as const, message: "Pedidos temporariamente indisponíveis" } };
}

export async function getPublicStoreConfig() {
  try {
    const [setting] = await getDb().select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    if (!setting) throw new Error("store-settings-not-found");
    const settings = normalizedSettings(setting);
    return { settings, availability: settings.availability, updatedAt: setting.updatedAt, configurationError: false };
  } catch (error) {
    console.error("storefront-settings-read-failed", error);
    const settings = unavailableSettings();
    return { settings, availability: settings.availability, updatedAt: null, configurationError: true };
  }
}

async function getCatalog() {
  const db = getDb();
  const [categoryRows, productRows, optionRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder)),
    db.select().from(products).where(eq(products.available, true)).orderBy(asc(products.sortOrder)),
    db.select().from(productOptions).where(eq(productOptions.active, true)).orderBy(asc(productOptions.sortOrder)),
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
  return { categories: categoryRows, products: mappedProducts };
}

async function getZones() {
  const rows = await getDb().select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.sortOrder));
  return rows.map((zone) => ({ id: zone.id, name: zone.name, feeCents: zone.feeCents }));
}

export async function getStorefront() {
  const [config, catalogResult, zonesResult] = await Promise.all([
    getPublicStoreConfig(),
    getCatalog().then((value) => ({ value, error: false as const })).catch((error) => {
      console.error("storefront-catalog-read-failed", error);
      return { value: { categories: fallbackCategories, products: fallbackProducts }, error: true as const };
    }),
    getZones().then((value) => ({ value, error: false as const })).catch((error) => {
      console.error("storefront-zones-read-failed", error);
      return { value: [], error: true as const };
    }),
  ]);
  return {
    ...catalogResult.value,
    settings: config.settings,
    deliveryZones: zonesResult.value,
    configurationError: config.configurationError,
    catalogError: catalogResult.error,
    zonesError: zonesResult.error,
  };
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
