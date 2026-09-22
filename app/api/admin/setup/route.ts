import { and, eq, isNull } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "../../../../db";
import { adminSessions, adminTokens, adminUsers } from "../../../../db/schema";
import { adminErrorResponse } from "../../../../lib/admin";
import { hashPassword, hashToken, normalizeEmail, validatePassword } from "../../../../lib/admin-security";
import { startAdminSession } from "../../../../lib/auth";
import { clearLoginFailures, isLoginBlocked, registerLoginFailure } from "../../../../lib/rate-limit";

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function POST(request: Request) {
  try {
    if (!validOrigin(request)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { code?: string; email?: string; name?: string; password?: string };
    const code = String(body.code ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isLoginBlocked("admin-setup", ip)) return Response.json({ error: "Não foi possível concluir a configuração." }, { status: 429 });
    const configuredCode = String(process.env.ADMIN_SETUP_CODE ?? "").trim();
    const expiresAt = Date.parse(String(process.env.ADMIN_SETUP_EXPIRES_AT ?? ""));
    const passwordError = validatePassword(String(body.password ?? ""));
    if (!configuredCode || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return Response.json({ error: "A configuração inicial não está disponível." }, { status: 404 });
    if (!code || !sameSecret(code, configuredCode) || !email.includes("@") || passwordError) {
      registerLoginFailure("admin-setup", ip);
      return Response.json({ error: passwordError ?? "Código de configuração ou dados inválidos." }, { status: 400 });
    }
    const db = getDb();
    const codeHash = hashToken(configuredCode);
    const [usedCode] = await db.select({ id: adminTokens.id }).from(adminTokens).where(and(eq(adminTokens.type, "setup"), eq(adminTokens.tokenHash, codeHash))).limit(1);
    if (usedCode) return Response.json({ error: "Este código de configuração já foi utilizado." }, { status: 410 });
    const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    const [activeOwner] = await db.select({ id: adminUsers.id }).from(adminUsers).where(and(eq(adminUsers.role, "owner"), eq(adminUsers.status, "active"))).limit(1);
    if (activeOwner && (!existing || existing.id !== activeOwner.id)) return Response.json({ error: "A configuração inicial já foi concluída." }, { status: 409 });
    const passwordHash = await hashPassword(String(body.password));
    let userId: number;
    if (existing) {
      if (existing.role !== "owner" || existing.status === "suspended") return Response.json({ error: "Esta conta não pode ser usada na configuração inicial." }, { status: 409 });
      userId = existing.id;
      await db.update(adminUsers).set({ name: String(body.name ?? "").trim().slice(0, 120) || email.split("@")[0], passwordHash, status: "active", failedLoginCount: 0, lockedUntil: null, updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, userId));
      await db.update(adminSessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(adminSessions.userId, userId), isNull(adminSessions.revokedAt)));
    } else {
      const result = await db.insert(adminUsers).values({ email, name: String(body.name ?? "").trim().slice(0, 120) || email.split("@")[0], role: "owner", status: "active", passwordHash });
      userId = Number(result[0].insertId);
    }
    await db.insert(adminTokens).values({ userId, type: "setup", tokenHash: codeHash, expiresAt: new Date(expiresAt).toISOString(), usedAt: new Date().toISOString() });
    clearLoginFailures("admin-setup", ip);
    await startAdminSession(userId, email);
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
