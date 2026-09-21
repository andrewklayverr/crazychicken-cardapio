import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { adminSessions, adminTokens, adminUsers } from "../../../../../db/schema";
import { adminErrorResponse } from "../../../../../lib/admin";
import { hashPassword, hashToken, validatePassword } from "../../../../../lib/admin-security";
import { endAdminSession } from "../../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; password?: string };
    const tokenHash = hashToken(String(body.token ?? ""));
    const [token] = await getDb().select().from(adminTokens).where(and(eq(adminTokens.type, "password_reset"), eq(adminTokens.tokenHash, tokenHash), isNull(adminTokens.usedAt))).limit(1);
    if (!token || new Date(token.expiresAt).getTime() < Date.now()) return Response.json({ error: "Link inválido ou expirado." }, { status: 410 });
    const passwordError = validatePassword(String(body.password ?? "")); if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    await getDb().update(adminUsers).set({ passwordHash: await hashPassword(String(body.password)), status: "active", failedLoginCount: 0, lockedUntil: null, updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, token.userId));
    await getDb().update(adminTokens).set({ usedAt: new Date().toISOString() }).where(eq(adminTokens.id, token.id));
    await getDb().update(adminSessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(adminSessions.userId, token.userId), isNull(adminSessions.revokedAt)));
    await endAdminSession();
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
