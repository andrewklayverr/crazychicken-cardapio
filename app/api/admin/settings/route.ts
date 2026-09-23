import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../../db";
import { storeSettings } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";
import { parseAppearance } from "../../../../lib/store";
import { getStoreAvailability, normalizeOrderingMode, normalizeWeeklySchedule, parseWeeklySchedule } from "../../../../lib/store-hours";
import { isWhatsAppTemplate, normalizeWhatsAppTemplate } from "../../../../lib/whatsapp-order";

const hex = /^#[0-9a-f]{6}$/i;

function sanitizeAppearance(value: unknown, existingValue?: string | null) {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const current = parseAppearance(existingValue);
  return {
    ...current,
    heroTitle: String(source.heroTitle ?? current.heroTitle).trim().slice(0, 100),
    heroDescription: String(source.heroDescription ?? current.heroDescription).trim().slice(0, 240),
    accent: hex.test(String(source.accent ?? "")) ? String(source.accent).toLowerCase() : current.accent,
    primary: hex.test(String(source.primary ?? "")) ? String(source.primary).toLowerCase() : current.primary,
    background: hex.test(String(source.background ?? "")) ? String(source.background).toLowerCase() : current.background,
    fontScale: "normal",
    density: "comfortable",
    visibleSections: Array.isArray(source.visibleSections) ? source.visibleSections.map(String).slice(0, 10) : current.visibleSections,
  };
}

function publicSettings(settings: typeof storeSettings.$inferSelect) {
  const weeklySchedule = parseWeeklySchedule(settings.weeklyScheduleJson);
  const normalized = { ...settings, appearance: parseAppearance(settings.appearanceJson), weeklySchedule };
  return { ...normalized, availability: getStoreAvailability(normalized) };
}

export async function GET() {
  try { await requireAdmin(); const [settings] = await getDb().select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1); return Response.json({ settings: settings ? publicSettings(settings) : null }); } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const body = await request.json() as Record<string, unknown>;
    const db = getDb();
    const [existing] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    const normalizedAppearance = sanitizeAppearance(body.appearance, existing?.appearanceJson);
    const appearance = normalizedAppearance ? JSON.stringify(normalizedAppearance) : undefined;
    const orderingMode = body.orderingMode !== undefined ? normalizeOrderingMode(body.orderingMode) : undefined;
    const weeklySchedule = body.weeklySchedule !== undefined ? normalizeWeeklySchedule(body.weeklySchedule) : undefined;
    if (body.whatsappTemplate !== undefined && !isWhatsAppTemplate(body.whatsappTemplate)) return Response.json({ error: "Modelo de mensagem inválido." }, { status: 400 });
    const effectiveMode = orderingMode ?? normalizeOrderingMode(existing?.orderingMode);
    const effectiveSchedule = weeklySchedule ?? parseWeeklySchedule(existing?.weeklyScheduleJson);
    if (effectiveMode === "automatic" && !Object.values(effectiveSchedule).some((intervals) => intervals.length)) return Response.json({ error: "Configure pelo menos um horário para o modo automático." }, { status: 400 });
    const patch = {
      ...(body.brandName !== undefined ? { brandName: String(body.brandName).slice(0, 80) } : {}),
      ...(body.logoKey !== undefined ? { logoKey: body.logoKey ? String(body.logoKey) : null } : {}),
      ...(body.whatsappNumber !== undefined ? { whatsappNumber: String(body.whatsappNumber).replace(/\D/g, "").slice(0, 15) } : {}),
      ...(body.whatsappTemplate !== undefined ? { whatsappTemplate: normalizeWhatsAppTemplate(body.whatsappTemplate) } : {}),
      ...(body.address !== undefined ? { address: String(body.address).slice(0, 240) } : {}),
      ...(body.openingHours !== undefined ? { openingHours: String(body.openingHours).slice(0, 120) } : {}),
      ...(orderingMode !== undefined ? { orderingMode } : {}),
      ...(weeklySchedule !== undefined ? { weeklyScheduleJson: JSON.stringify(weeklySchedule) } : {}),
      ...(body.deliveryEnabled !== undefined ? { deliveryEnabled: Boolean(body.deliveryEnabled) } : {}),
      ...(body.pickupEnabled !== undefined ? { pickupEnabled: Boolean(body.pickupEnabled) } : {}),
      ...(body.minimumOrderCents !== undefined ? { minimumOrderCents: Math.max(0, Math.round(Number(body.minimumOrderCents) || 0)) } : {}),
      ...(body.defaultDeliveryFeeCents !== undefined ? { defaultDeliveryFeeCents: Math.max(0, Math.round(Number(body.defaultDeliveryFeeCents) || 0)) } : {}),
      ...(body.theme !== undefined ? { theme: String(body.theme).slice(0, 40) } : {}),
      ...(appearance !== undefined ? { appearanceJson: appearance } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (existing) await db.update(storeSettings).set(patch).where(eq(storeSettings.id, 1));
    else await db.insert(storeSettings).values({ id: 1, ...patch, appearanceJson: appearance ?? JSON.stringify({}) });
    const [settings] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
    if (!settings) return Response.json({ error: "Não foi possível salvar as configurações." }, { status: 500 });
    await recordAudit({ user, action: "update", entity: "store_settings", entityId: 1 });
    revalidatePath("/", "page");
    return Response.json({ settings: publicSettings(settings) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}
