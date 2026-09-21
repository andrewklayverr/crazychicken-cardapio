import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";

export type { ChatGPTUser } from "../app/chatgpt-auth";

const cookieName = "crazy_chicken_admin";
const sessionDays = 7;

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "change-this-secret-before-production";
}

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + sessionDays * 86400000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value: string) {
  const [payload, signature] = value.split(".");
  const expectedSignature = payload ? sign(payload) : "";
  if (!payload || !signature || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
  if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
  return parsed.email.toLowerCase();
}

export async function getCurrentUser(): Promise<ChatGPTUser | null> {
  const dispatchUser = await getChatGPTUser();
  if (dispatchUser) return dispatchUser;
  const token = (await cookies()).get(cookieName)?.value;
  const email = token ? decodeSession(token) : null;
  return email ? { userId: `hostinger:${email}`, displayName: email, email, fullName: null } : null;
}

export function verifyAdminPassword(email: string, password: string) {
  if (!configuredAdminEmails().includes(email.trim().toLowerCase())) return false;
  const encodedHash = process.env.ADMIN_PASSWORD_HASH;
  if (encodedHash?.startsWith("scrypt$")) {
    const [, salt, expected] = encodedHash.split("$");
    const actual = scryptSync(password, salt, 64).toString("hex");
    return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }
  const configuredPassword = process.env.ADMIN_PASSWORD;
  return Boolean(configuredPassword && password.length === configuredPassword.length && timingSafeEqual(Buffer.from(password), Buffer.from(configuredPassword)));
}

export async function startAdminSession(email: string) {
  (await cookies()).set(cookieName, encodeSession(email.trim().toLowerCase()), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionDays * 86400 });
}

export async function endAdminSession() {
  (await cookies()).set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}
