import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { adminTokens, adminUsers } from "../../../../../db/schema";
import { adminErrorResponse } from "../../../../../lib/admin";
import { hashToken, normalizeEmail, randomToken } from "../../../../../lib/admin-security";
import { sendPasswordReset } from "../../../../../lib/email";
import { isRecoveryBlocked, registerRecoveryAttempt } from "../../../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { email?: string };
    const email = normalizeEmail(String(body.email ?? ""));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRecoveryBlocked(email, ip)) return Response.json({ ok: true });
    registerRecoveryAttempt(email, ip);
    const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (user?.status === "active") {
      const token = randomToken();
      await getDb().insert(adminTokens).values({ userId: user.id, type: "password_reset", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60000).toISOString() });
      await sendPasswordReset({ email, token });
    }
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
