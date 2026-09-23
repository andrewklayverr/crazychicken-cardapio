import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../../../../db";
import { AdminAuthError, adminErrorResponse } from "../../../../../lib/admin";
import { hashPassword, hashToken, validatePassword } from "../../../../../lib/admin-security";
import { endAdminSession } from "../../../../../lib/auth";
import { takeAdminAttempt } from "../../../../../lib/admin-recovery";
import { getClientIp, isTrustedRequestOrigin } from "../../../../../lib/request-security";

export async function POST(request: Request) {
  try {
    if (!isTrustedRequestOrigin(request)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { token?: string; password?: string };
    const rawToken = String(body.token ?? "").trim();
    const tokenHash = hashToken(rawToken);
    const pool = getPool();
    const clientIp = getClientIp(request);
    await takeAdminAttempt(pool, tokenHash, clientIp, "password-reset");
    const password = String(body.password ?? "");
    const passwordError = validatePassword(password); if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT t.id AS token_id, t.user_id, u.email, u.status FROM admin_tokens t INNER JOIN admin_users u ON u.id = t.user_id WHERE t.type = 'password_reset' AND t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP() FOR UPDATE", [tokenHash]);
      const token = rows[0];
      if (!token || token.status !== "active") throw new AdminAuthError("Link inválido ou expirado.", 410);
      const [consumed] = await connection.execute<ResultSetHeader>("UPDATE admin_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [token.token_id]);
      if (consumed.affectedRows !== 1) throw new AdminAuthError("Link inválido ou expirado.", 410);
      await connection.execute("UPDATE admin_users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'active'", [passwordHash, token.user_id]);
      await connection.execute("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [token.user_id]);
      await connection.execute("DELETE FROM admin_login_throttles WHERE key_hash IN (?, ?)", [hashToken(`email:${token.email}`), hashToken(`ip:${clientIp}`)]);
      await connection.execute("INSERT INTO audit_log (actor_user_id, actor_email, action, entity, entity_id, metadata_json) VALUES (?, ?, 'password_reset', 'admin_users', ?, '{}')", [`admin:${token.user_id}`, token.email, String(token.user_id)]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await endAdminSession();
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
