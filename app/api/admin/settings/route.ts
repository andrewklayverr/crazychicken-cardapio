import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { storeSettings } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { parseAppearance } from "../../../../lib/store";

export async function GET() {
  try { await requireAdmin(); const [settings] = await getDb().select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1); return Response.json({ settings: settings ? { ...settings, appearance: parseAppearance(settings.appearanceJson) } : null }); } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json() as Record<string, unknown>;
    const appearance = body.appearance && typeof body.appearance === "object" ? JSON.stringify(body.appearance) : undefined;
    const [settings] = await getDb().insert(storeSettings).values({ id: 1, ...(body.brandName !== undefined ? { brandName: String(body.brandName).slice(0, 80) } : {}), ...(body.logoKey !== undefined ? { logoKey: body.logoKey ? String(body.logoKey) : null } : {}), ...(body.whatsappNumber !== undefined ? { whatsappNumber: String(body.whatsappNumber).replace(/\D/g, "").slice(0, 15) } : {}), ...(body.address !== undefined ? { address: String(body.address).slice(0, 240) } : {}), ...(body.openingHours !== undefined ? { openingHours: String(body.openingHours).slice(0, 120) } : {}), ...(body.deliveryEnabled !== undefined ? { deliveryEnabled: Boolean(body.deliveryEnabled) } : {}), ...(body.pickupEnabled !== undefined ? { pickupEnabled: Boolean(body.pickupEnabled) } : {}), ...(body.minimumOrderCents !== undefined ? { minimumOrderCents: Number(body.minimumOrderCents) || 0 } : {}), ...(body.defaultDeliveryFeeCents !== undefined ? { defaultDeliveryFeeCents: Number(body.defaultDeliveryFeeCents) || 0 } : {}), ...(body.theme !== undefined ? { theme: String(body.theme).slice(0, 40) } : {}), ...(appearance !== undefined ? { appearanceJson: appearance } : {}), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: storeSettings.id, set: { ...(body.brandName !== undefined ? { brandName: String(body.brandName).slice(0, 80) } : {}), ...(body.logoKey !== undefined ? { logoKey: body.logoKey ? String(body.logoKey) : null } : {}), ...(body.whatsappNumber !== undefined ? { whatsappNumber: String(body.whatsappNumber).replace(/\D/g, "").slice(0, 15) } : {}), ...(body.address !== undefined ? { address: String(body.address).slice(0, 240) } : {}), ...(body.openingHours !== undefined ? { openingHours: String(body.openingHours).slice(0, 120) } : {}), ...(body.deliveryEnabled !== undefined ? { deliveryEnabled: Boolean(body.deliveryEnabled) } : {}), ...(body.pickupEnabled !== undefined ? { pickupEnabled: Boolean(body.pickupEnabled) } : {}), ...(body.minimumOrderCents !== undefined ? { minimumOrderCents: Number(body.minimumOrderCents) || 0 } : {}), ...(body.defaultDeliveryFeeCents !== undefined ? { defaultDeliveryFeeCents: Number(body.defaultDeliveryFeeCents) || 0 } : {}), ...(body.theme !== undefined ? { theme: String(body.theme).slice(0, 40) } : {}), ...(appearance !== undefined ? { appearanceJson: appearance } : {}), updatedAt: new Date().toISOString() } }).returning();
    await recordAudit({ user, action: "update", entity: "store_settings", entityId: 1 });
    return Response.json({ settings });
  } catch (error) { return adminErrorResponse(error); }
}
