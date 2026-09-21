import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adminRecoveryCodes, adminTokens, adminUsers } from "../../../../db/schema";
import { adminErrorResponse } from "../../../../lib/admin";
import { encryptSecret, generateRecoveryCodes, generateTotpSecret, hashPassword, hashToken, normalizeEmail, totpUri, validatePassword, verifyTotp } from "../../../../lib/admin-security";
import { startAdminSession } from "../../../../lib/auth";

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("token") ?? "";
    const [token] = await getDb().select({ userId: adminTokens.userId, expiresAt: adminTokens.expiresAt }).from(adminTokens).where(and(eq(adminTokens.type, "invite"), eq(adminTokens.tokenHash, hashToken(raw)), isNull(adminTokens.usedAt))).limit(1);
    if (!token || new Date(token.expiresAt).getTime() < Date.now()) return Response.json({ error: "Convite inválido ou expirado." }, { status: 410 });
    const [user] = await getDb().select({ email: adminUsers.email, role: adminUsers.role }).from(adminUsers).where(eq(adminUsers.id, token.userId)).limit(1);
    return user ? Response.json({ email: user.email, role: user.role }) : Response.json({ error: "Convite inválido." }, { status: 410 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; name?: string; password?: string; mfaSecret?: string; mfaCode?: string };
    const raw = String(body.token ?? "");
    const [token] = await getDb().select().from(adminTokens).where(and(eq(adminTokens.type, "invite"), eq(adminTokens.tokenHash, hashToken(raw)), isNull(adminTokens.usedAt))).limit(1);
    if (!token || new Date(token.expiresAt).getTime() < Date.now()) return Response.json({ error: "Convite inválido ou expirado." }, { status: 410 });
    const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, token.userId)).limit(1);
    if (!user || user.status !== "invited") return Response.json({ error: "Este convite já foi utilizado." }, { status: 409 });
    if ((body as { action?: string }).action === "setup") {
      const secret = generateTotpSecret();
      return Response.json({ secret, uri: totpUri(user.email, secret), role: user.role });
    }
    const passwordError = validatePassword(String(body.password ?? "")); if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const mfaSecret = String(body.mfaSecret ?? "").trim(); const mfaCode = String(body.mfaCode ?? "").trim();
    if (user.role === "owner" && (!mfaSecret || !verifyTotp(mfaSecret, mfaCode))) return Response.json({ error: "O proprietário precisa confirmar o código MFA." }, { status: 400 });
    const passwordHash = await hashPassword(String(body.password));
    await getDb().update(adminUsers).set({ name: String(body.name ?? "").trim().slice(0, 120) || normalizeEmail(user.email), passwordHash, status: "active", ...(user.role === "owner" ? { mfaSecretEncrypted: encryptSecret(mfaSecret), mfaEnabledAt: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, user.id));
    await getDb().update(adminTokens).set({ usedAt: new Date().toISOString() }).where(eq(adminTokens.id, token.id));
    const recoveryCodes = user.role === "owner" ? generateRecoveryCodes() : [];
    for (const code of recoveryCodes) await getDb().insert(adminRecoveryCodes).values({ userId: user.id, codeHash: hashToken(code) });
    await startAdminSession(user.id, user.email);
    return Response.json({ ok: true, recoveryCodes });
  } catch (error) { return adminErrorResponse(error); }
}
