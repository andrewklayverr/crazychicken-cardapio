import { and, eq, isNull } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { adminSessions, adminUsers } from "../db/schema";
import { normalizeEmail, hashToken, verifyPassword, verifyTotp } from "./admin-security";
import { isTrustedRequestOrigin } from "./request-security";

export type { ChatGPTUser } from "../app/chatgpt-auth";
export type AdminRole = "owner" | "manager" | "attendant";

export type AdminUser = ChatGPTUser & {
  id: number;
  role: AdminRole;
  status: "active" | "invited" | "suspended";
  mfaEnabledAt: string | null;
};

const cookieName = "crazy_chicken_admin";
const csrfCookieName = "crazy_chicken_csrf";
const sessionDays = 7;
const idleHours = 12;

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "change-this-secret-before-production";
}

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeLegacySession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + sessionDays * 86400000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeLegacySession(value: string) {
  try {
    const [payload, signature] = value.split(".");
    const expectedSignature = payload ? sign(payload) : "";
    if (!payload || !signature || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    return parsed.email && parsed.exp && parsed.exp >= Date.now() ? normalizeEmail(parsed.email) : null;
  } catch { return null; }
}

function fromDispatchUser(user: ChatGPTUser): AdminUser {
  return { ...user, id: 0, role: "owner", status: "active", mfaEnabledAt: null };
}

function fromRow(row: typeof adminUsers.$inferSelect): AdminUser {
  return { userId: `admin:${row.id}`, displayName: row.name, fullName: row.name, email: row.email, id: row.id, role: row.role as AdminRole, status: row.status as AdminUser["status"], mfaEnabledAt: row.mfaEnabledAt ?? null };
}

export async function findAdminUserByEmail(email: string) {
  const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

export async function findAdminUserById(id: number) {
  const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row ?? null;
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  const dispatchUser = await getChatGPTUser();
  if (dispatchUser) return fromDispatchUser(dispatchUser);
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const [session] = await getDb().select().from(adminSessions).where(and(eq(adminSessions.tokenHash, hashToken(token)), isNull(adminSessions.revokedAt))).limit(1);
    if (session && new Date(session.expiresAt).getTime() > Date.now() && new Date(session.idleExpiresAt).getTime() > Date.now()) {
      const [row] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, session.userId)).limit(1);
      if (row?.status === "active") {
        await getDb().update(adminSessions).set({ lastSeenAt: new Date().toISOString(), idleExpiresAt: new Date(Date.now() + idleHours * 3600000).toISOString() }).where(eq(adminSessions.tokenHash, session.tokenHash));
        return fromRow(row);
      }
    }
  } catch {
    // Permite a migração progressiva em instalações antigas sem as tabelas novas.
  }
  const legacyEmail = decodeLegacySession(token);
  if (!legacyEmail || !configuredAdminEmails().includes(legacyEmail)) return null;
  return { userId: `legacy:${legacyEmail}`, displayName: legacyEmail, fullName: null, email: legacyEmail, id: 0, role: "owner", status: "active", mfaEnabledAt: null };
}

export async function authenticateAdmin(emailValue: string, password: string, mfaCode?: string) {
  const email = normalizeEmail(emailValue);
  let row: typeof adminUsers.$inferSelect | null = null;
  try { row = await findAdminUserByEmail(email); } catch { /* legacy fallback below */ }
  if (row) {
    if (row.status !== "active" || (row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()) || !row.passwordHash) return null;
    if (!await verifyPassword(password, row.passwordHash)) {
      await getDb().update(adminUsers).set({ failedLoginCount: row.failedLoginCount + 1, lockedUntil: row.failedLoginCount >= 4 ? new Date(Date.now() + 15 * 60000).toISOString() : null }).where(eq(adminUsers.id, row.id));
      return null;
    }
    if (row.mfaEnabledAt && (!mfaCode || !row.mfaSecretEncrypted)) return { user: fromRow(row), mfaRequired: true, legacy: false };
    if (row.mfaEnabledAt) {
      const { decryptSecret } = await import("./admin-security");
      if (!verifyTotp(decryptSecret(row.mfaSecretEncrypted!), mfaCode!) && !await consumeRecoveryCode(row.id, mfaCode!)) return { user: fromRow(row), mfaRequired: true, invalidMfa: true, legacy: false };
    }
    await getDb().update(adminUsers).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() }).where(eq(adminUsers.id, row.id));
    return { user: fromRow(row), mfaRequired: false, legacy: false };
  }
  if (!configuredAdminEmails().includes(email)) return null;
  const encodedHash = process.env.ADMIN_PASSWORD_HASH;
  let valid = false;
  if (encodedHash?.startsWith("scrypt$")) {
    const [, salt, expected] = encodedHash.split("$");
    const { scryptSync } = await import("node:crypto");
    const actual = scryptSync(password, salt, 64).toString("hex");
    valid = actual.length === expected?.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } else {
    const configuredPassword = process.env.ADMIN_PASSWORD;
    valid = Boolean(configuredPassword && password.length === configuredPassword.length && timingSafeEqual(Buffer.from(password), Buffer.from(configuredPassword)));
  }
  if (!valid) return null;
  try {
    const existing = await findAdminUserByEmail(email);
    if (existing) return null;
    if (encodedHash) {
      const result = await getDb().insert(adminUsers).values({ email, name: email.split("@")[0], role: "owner", status: "active", passwordHash: encodedHash });
      const migrated = await findAdminUserById(Number(result[0].insertId));
      if (migrated) return { user: fromRow(migrated), mfaRequired: false, legacy: false };
    }
  } catch {
    // Instalações antigas continuam funcionando até que a migração do banco seja executada.
  }
  return { user: { userId: `legacy:${email}`, displayName: email, fullName: null, email, id: 0, role: "owner" as const, status: "active" as const, mfaEnabledAt: null }, mfaRequired: false, legacy: true };
}

async function consumeRecoveryCode(userId: number, code: string) {
  const { adminRecoveryCodes } = await import("../db/schema");
  const normalized = code.trim().toUpperCase();
  const [match] = await getDb().select().from(adminRecoveryCodes).where(and(eq(adminRecoveryCodes.userId, userId), eq(adminRecoveryCodes.codeHash, hashToken(normalized)), isNull(adminRecoveryCodes.usedAt))).limit(1);
  if (!match) return false;
  await getDb().update(adminRecoveryCodes).set({ usedAt: new Date().toISOString() }).where(eq(adminRecoveryCodes.id, match.id));
  return true;
}

export async function startAdminSession(userId: number, email: string) {
  const rawToken = (await import("node:crypto")).randomBytes(32).toString("base64url");
  const rawCsrf = (await import("node:crypto")).randomBytes(32).toString("base64url");
  const now = Date.now();
  await getDb().insert(adminSessions).values({ tokenHash: hashToken(rawToken), userId, csrfTokenHash: hashToken(rawCsrf), expiresAt: new Date(now + sessionDays * 86400000).toISOString(), idleExpiresAt: new Date(now + idleHours * 3600000).toISOString() });
  const store = await cookies();
  store.set(cookieName, rawToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionDays * 86400 });
  store.set(csrfCookieName, rawCsrf, { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionDays * 86400 });
  return { email };
}

export async function startLegacyAdminSession(email: string) {
  (await cookies()).set(cookieName, encodeLegacySession(normalizeEmail(email)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionDays * 86400 });
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) { try { await getDb().update(adminSessions).set({ revokedAt: new Date().toISOString() }).where(eq(adminSessions.tokenHash, hashToken(token))); } catch { /* legacy cookie */ } }
  store.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  store.set(csrfCookieName, "", { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function validateAdminMutation(request: Request) {
  const origin = isTrustedRequestOrigin(request) ? null : request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) throw new Error("Origem da requisição inválida.");
  const csrf = request.headers.get("x-csrf-token");
  const token = (await cookies()).get(cookieName)?.value;
  const csrfCookie = (await cookies()).get(csrfCookieName)?.value;
  if (!csrf || !csrfCookie || csrf !== csrfCookie || !token) throw new Error("Token de segurança inválido.");
  const [session] = await getDb().select({ csrfTokenHash: adminSessions.csrfTokenHash }).from(adminSessions).where(and(eq(adminSessions.tokenHash, hashToken(token)), isNull(adminSessions.revokedAt))).limit(1);
  if (!session || session.csrfTokenHash !== hashToken(csrf)) throw new Error("Token de segurança inválido.");
}
