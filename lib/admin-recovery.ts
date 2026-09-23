import { timingSafeEqual } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { hashPassword, hashToken, normalizeEmail, validatePassword } from "./admin-security";

export class RecoveryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function recoveryConfig(env: NodeJS.ProcessEnv, now = Date.now()) {
  const email = normalizeEmail(env.ADMIN_RECOVERY_EMAIL ?? "");
  const code = (env.ADMIN_RECOVERY_CODE ?? "").trim();
  const expires = Date.parse(env.ADMIN_RECOVERY_EXPIRES_AT ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[A-Za-z0-9_-]{43}$/.test(code) || Buffer.from(code, "base64url").length !== 32 || !Number.isFinite(expires) || expires <= now || expires > now + 86400000) {
    throw new RecoveryError(404, "Recuperação temporária indisponível. Confira a configuração e a validade na hospedagem.");
  }
  return { email, code, expires };
}

export function recoveryOrigin(request: Request, appUrl: string | undefined) {
  try {
    const expected = new URL(appUrl ?? "");
    const supplied = request.headers.get("origin") ?? request.headers.get("referer");
    if (!supplied || request.headers.get("sec-fetch-site") === "cross-site") return false;
    return expected.protocol === "https:" && new URL(supplied).origin === expected.origin;
  } catch { return false; }
}

// A separate committed transaction counts even invalid attempts, across workers.
export async function takeAdminAttempt(pool: Pool, email: string, ip: string, scope = "owner-recovery") {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const prefix = scope === "login" ? "" : `${scope}:`;
    const keys = [hashToken(`${prefix}email:${email}`), hashToken(`${prefix}ip:${ip}`)].sort();
    for (const key of keys) {
      await connection.execute("INSERT INTO admin_login_throttles (key_hash, attempts, window_started_at) VALUES (?, 0, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE key_hash = VALUES(key_hash)", [key]);
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT attempts, (window_started_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)) AS recent FROM admin_login_throttles WHERE key_hash = ? FOR UPDATE", [key]);
      if (rows[0].recent && rows[0].attempts >= 5) throw new RecoveryError(429, "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
      await connection.execute("UPDATE admin_login_throttles SET attempts = ?, window_started_at = IF(?, window_started_at, UTC_TIMESTAMP()) WHERE key_hash = ?", [rows[0].recent ? rows[0].attempts + 1 : 1, Boolean(rows[0].recent), key]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function recoverOwner(pool: Pool, body: unknown, ip: string, env: NodeJS.ProcessEnv = process.env) {
  const config = recoveryConfig(env);
  await takeAdminAttempt(pool, config.email, ip);
  const input = body as Record<string, unknown> | null;
  const email = typeof input?.email === "string" ? normalizeEmail(input.email) : "";
  const code = typeof input?.code === "string" ? input.code.trim() : "";
  if (email !== config.email || !timingSafeEqual(Buffer.from(hashToken(code)), Buffer.from(hashToken(config.code)))) {
    throw new RecoveryError(400, "Código ou dados inválidos.");
  }
  const password = typeof input?.password === "string" ? input.password : "";
  const passwordError = validatePassword(password);
  if (passwordError) throw new RecoveryError(400, passwordError);
  if (password !== input?.confirmPassword) throw new RecoveryError(400, "As senhas não coincidem.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<RowDataPacket[]>("SELECT id, role, status FROM admin_users WHERE email = ? FOR UPDATE", [email]);
    const user = users[0];
    if (!user || user.role !== "owner" || user.status !== "active") throw new RecoveryError(400, "Código ou dados inválidos.");
    const codeHash = hashToken(config.code);
    const [tokens] = await connection.execute<RowDataPacket[]>("SELECT id FROM admin_tokens WHERE token_hash = ? FOR UPDATE", [codeHash]);
    if (tokens.length) throw new RecoveryError(410, "Código já utilizado. Solicite um novo código na hospedagem.");
    // All effects, including consumption and audit, commit together.
    await connection.execute("INSERT INTO admin_tokens (user_id, type, token_hash, expires_at, used_at) VALUES (?, 'owner_recovery', ?, ?, UTC_TIMESTAMP())", [user.id, codeHash, new Date(config.expires).toISOString().slice(0, 19).replace("T", " ")]);
    const passwordHash = await hashPassword(password);
    if (Date.now() >= config.expires) throw new RecoveryError(410, "Código expirado.");
    await connection.execute("UPDATE admin_users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP() WHERE id = ?", [passwordHash, user.id]);
    await connection.execute("UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [user.id]);
    await connection.execute("UPDATE admin_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL AND type IN ('password_reset', 'owner_recovery', 'setup')", [user.id]);
    await connection.execute("DELETE FROM admin_login_throttles WHERE key_hash IN (?, ?)", [hashToken(`email:${email}`), hashToken(`ip:${ip}`)]);
    await connection.execute("INSERT INTO audit_log (actor_user_id, actor_email, action, entity, entity_id, metadata_json) VALUES (?, ?, 'owner_password_recovered', 'admin_users', ?, ?)", [`admin:${user.id}`, email, String(user.id), JSON.stringify({ method: "hosting_code" })]);
    await connection.commit();
    return email;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
