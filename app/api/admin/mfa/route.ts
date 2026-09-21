import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adminRecoveryCodes, adminSessions, adminUsers } from "../../../../db/schema";
import { adminErrorResponse, requireAdmin } from "../../../../lib/admin";
import { encryptSecret, generateRecoveryCodes, generateTotpSecret, hashToken, totpUri, verifyTotp } from "../../../../lib/admin-security";
import { validateAdminMutation } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(); await validateAdminMutation(request);
    const body = await request.json() as { action?: string; secret?: string; code?: string };
    if (body.action === "setup") {
      const secret = generateTotpSecret();
      return Response.json({ secret, uri: totpUri(user.email, secret) });
    }
    if (body.action !== "enable" || !body.secret || !verifyTotp(body.secret, String(body.code ?? ""))) return Response.json({ error: "Código MFA inválido." }, { status: 400 });
    await getDb().update(adminUsers).set({ mfaSecretEncrypted: encryptSecret(body.secret), mfaEnabledAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, user.id));
    const recoveryCodes = generateRecoveryCodes();
    for (const code of recoveryCodes) await getDb().insert(adminRecoveryCodes).values({ userId: user.id, codeHash: hashToken(code) });
    await getDb().update(adminSessions).set({ revokedAt: new Date().toISOString() }).where(eq(adminSessions.userId, user.id));
    return Response.json({ ok: true, recoveryCodes });
  } catch (error) { return adminErrorResponse(error); }
}
