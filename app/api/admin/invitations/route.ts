import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb, getPool } from "../../../../db";
import { adminTokens, adminUsers } from "../../../../db/schema";
import { AdminAuthError, adminErrorResponse } from "../../../../lib/admin";
import { encryptSecret, generateRecoveryCodes, generateTotpSecret, hashPassword, hashToken, normalizeEmail, totpUri, validatePassword, verifyTotp } from "../../../../lib/admin-security";
import { startAdminSession } from "../../../../lib/auth";
import { takeAdminAttempt } from "../../../../lib/admin-recovery";
import { getClientIp, isTrustedRequestOrigin } from "../../../../lib/request-security";

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("token") ?? "";
    const [token] = await getDb().select({ userId: adminTokens.userId }).from(adminTokens).where(and(eq(adminTokens.type, "invite"), eq(adminTokens.tokenHash, hashToken(raw)), isNull(adminTokens.usedAt), gt(adminTokens.expiresAt, sql`CURRENT_TIMESTAMP`))).limit(1);
    if (!token) return Response.json({ error: "Convite inválido ou expirado." }, { status: 410 });
    const [user] = await getDb().select({ email: adminUsers.email, role: adminUsers.role }).from(adminUsers).where(eq(adminUsers.id, token.userId)).limit(1);
    return user ? Response.json({ email: user.email, role: user.role }) : Response.json({ error: "Convite inválido." }, { status: 410 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (!isTrustedRequestOrigin(request)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { token?: string; name?: string; password?: string; mfaSecret?: string; mfaCode?: string; action?: string };
    const raw = String(body.token ?? "").trim();
    const tokenHash = hashToken(raw);
    const pool = getPool();
    await takeAdminAttempt(pool, tokenHash, getClientIp(request), "invite-accept");
    const [token] = await getDb().select().from(adminTokens).where(and(eq(adminTokens.type, "invite"), eq(adminTokens.tokenHash, hashToken(raw)), isNull(adminTokens.usedAt), gt(adminTokens.expiresAt, sql`CURRENT_TIMESTAMP`))).limit(1);
    if (!token) return Response.json({ error: "Convite inválido ou expirado." }, { status: 410 });
    const [user] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, token.userId)).limit(1);
    if (!user || user.status !== "invited") return Response.json({ error: "Este convite já foi utilizado." }, { status: 409 });
    if (body.action === "setup") {
      const secret = generateTotpSecret();
      return Response.json({ secret, uri: totpUri(user.email, secret), role: user.role });
    }
    const passwordError = validatePassword(String(body.password ?? "")); if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const mfaSecret = String(body.mfaSecret ?? "").trim(); const mfaCode = String(body.mfaCode ?? "").trim();
    if (user.role === "owner" && (!mfaSecret || !verifyTotp(mfaSecret, mfaCode))) return Response.json({ error: "O proprietário precisa confirmar o código MFA." }, { status: 400 });
    const passwordHash = await hashPassword(String(body.password));
    const encryptedMfa = user.role === "owner" ? encryptSecret(mfaSecret) : null;
    const recoveryCodes = user.role === "owner" ? generateRecoveryCodes() : [];
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT t.id AS token_id, t.user_id, u.email, u.role, u.status FROM admin_tokens t INNER JOIN admin_users u ON u.id = t.user_id WHERE t.type = 'invite' AND t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP() FOR UPDATE", [tokenHash]);
      const locked = rows[0];
      if (!locked || locked.status !== "invited" || locked.user_id !== user.id) throw new AdminAuthError("Convite inválido, expirado ou já utilizado.", 410);
      const [consumed] = await connection.execute<ResultSetHeader>("UPDATE admin_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [locked.token_id]);
      if (consumed.affectedRows !== 1) throw new AdminAuthError("Este convite já foi utilizado.", 409);
      await connection.execute("UPDATE admin_users SET name = ?, password_hash = ?, status = 'active', mfa_secret_encrypted = ?, mfa_enabled_at = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'invited'", [String(body.name ?? "").trim().slice(0, 120) || normalizeEmail(user.email), passwordHash, encryptedMfa, encryptedMfa ? new Date() : null, user.id]);
      for (const code of recoveryCodes) await connection.execute("INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES (?, ?)", [user.id, hashToken(code)]);
      await connection.execute("INSERT INTO audit_log (actor_user_id, actor_email, action, entity, entity_id, metadata_json) VALUES (?, ?, 'invite_accepted', 'admin_users', ?, ?)", [`admin:${user.id}`, user.email, String(user.id), JSON.stringify({ role: user.role })]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await startAdminSession(user.id, user.email);
    return Response.json({ ok: true, recoveryCodes });
  } catch (error) { return adminErrorResponse(error); }
}
