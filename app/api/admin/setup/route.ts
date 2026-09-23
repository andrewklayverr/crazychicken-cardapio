import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getPool } from "../../../../db";
import { hashPassword, hashToken, normalizeEmail, validatePassword } from "../../../../lib/admin-security";
import { startAdminSession } from "../../../../lib/auth";
import { RecoveryError, recoveryOrigin, takeAdminAttempt } from "../../../../lib/admin-recovery";
import { timingSafeEqual } from "node:crypto";
import { getClientIp } from "../../../../lib/request-security";

export async function POST(request: Request) {
  if (!recoveryOrigin(request, process.env.APP_URL)) return Response.json({ error: "Requisição inválida." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(String(body?.email ?? ""));
    const configuredCode = String(process.env.ADMIN_SETUP_CODE ?? "").trim();
    const expiresAt = Date.parse(process.env.ADMIN_SETUP_EXPIRES_AT ?? "");
    if (!configuredCode || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new RecoveryError(404, "A configuração inicial não está disponível.");
    const pool = getPool();
    const ip = getClientIp(request);
    await takeAdminAttempt(pool, "initial-owner", ip, "setup");
    const code = String(body?.code ?? "").trim();
    if (!timingSafeEqual(Buffer.from(hashToken(code)), Buffer.from(hashToken(configuredCode))) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RecoveryError(400, "Código ou dados inválidos.");
    const password = String(body?.password ?? "");
    const problem = validatePassword(password);
    if (problem) throw new RecoveryError(400, problem);
    const connection = await pool.getConnection();
    let userId: number;
    try {
      await connection.beginTransaction();
      // Persistent singleton lock serializes first-owner creation, even with an empty users table.
      const lockKey = hashToken("initial-owner-lock");
      await connection.execute("INSERT INTO admin_login_throttles (key_hash, attempts, window_started_at) VALUES (?, 0, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash)", [lockKey]);
      await connection.execute<RowDataPacket[]>("SELECT key_hash FROM admin_login_throttles WHERE key_hash = ? FOR UPDATE", [lockKey]);
      const [users] = await connection.execute<RowDataPacket[]>("SELECT id FROM admin_users LIMIT 1 FOR UPDATE");
      if (users.length) throw new RecoveryError(409, "Já existe uma conta administrativa. Use o login ou a recuperação do proprietário.");
      const [tokens] = await connection.execute<RowDataPacket[]>("SELECT id FROM admin_tokens WHERE token_hash = ? FOR UPDATE", [hashToken(configuredCode)]);
      if (tokens.length) throw new RecoveryError(410, "Código já utilizado.");
      const passwordHash = await hashPassword(password);
      const [result] = await connection.execute<ResultSetHeader>("INSERT INTO admin_users (email, name, role, status, password_hash) VALUES (?, ?, 'owner', 'active', ?)", [email, String(body?.name ?? "").trim().slice(0, 120) || email.split("@")[0], passwordHash]);
      userId = result.insertId;
      await connection.execute("INSERT INTO admin_tokens (user_id, type, token_hash, expires_at, used_at) VALUES (?, 'setup', ?, ?, UTC_TIMESTAMP())", [userId, hashToken(configuredCode), new Date(expiresAt).toISOString().slice(0, 19).replace("T", " ")]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    await startAdminSession(userId, email);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RecoveryError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Não foi possível configurar o acesso. Tente novamente mais tarde." }, { status: 503 });
  }
}
