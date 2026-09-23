import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, getPool } from "../../../../../db";
import { adminTokens, adminUsers } from "../../../../../db/schema";
import { adminErrorResponse } from "../../../../../lib/admin";
import { hashToken, normalizeEmail, randomToken } from "../../../../../lib/admin-security";
import { sendPasswordReset } from "../../../../../lib/email";
import { RecoveryError, takeAdminAttempt } from "../../../../../lib/admin-recovery";
import { getClientIp, isTrustedRequestOrigin } from "../../../../../lib/request-security";

export async function POST(request: Request) {
  try {
    if (!isTrustedRequestOrigin(request)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { email?: string };
    const email = normalizeEmail(String(body.email ?? ""));
    const ip = getClientIp(request);
    await takeAdminAttempt(getPool(), email || "invalid", ip, "password-reset-request");
    const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (user?.status === "active") {
      const token = randomToken();
      await getDb().update(adminTokens).set({ usedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(adminTokens.userId, user.id), eq(adminTokens.type, "password_reset"), isNull(adminTokens.usedAt)));
      await getDb().insert(adminTokens).values({ userId: user.id, type: "password_reset", tokenHash: hashToken(token), expiresAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)` });
      await sendPasswordReset({ email, token });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RecoveryError && error.status === 429) return Response.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });
    return adminErrorResponse(error);
  }
}
