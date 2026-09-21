import { createHash } from "node:crypto";

type Entry = { count: number; resetAt: number; blockedUntil: number };
const entries = new Map<string, Entry>();
const windowMs = 15 * 60 * 1000;

function key(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function isLoginBlocked(email: string, ip: string) {
  const now = Date.now();
  return [key(`email:${email}`), key(`ip:${ip}`)].some((entryKey) => {
    const entry = entries.get(entryKey);
    return Boolean(entry && entry.blockedUntil > now);
  });
}

export function registerLoginFailure(email: string, ip: string) {
  const now = Date.now();
  for (const value of [`email:${email}`, `ip:${ip}`]) {
    const entryKey = key(value); const previous = entries.get(entryKey);
    const entry = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + windowMs, blockedUntil: 0 } : previous;
    entry.count += 1;
    if (entry.count >= 5) entry.blockedUntil = now + windowMs;
    entries.set(entryKey, entry);
  }
}

export function clearLoginFailures(email: string, ip: string) {
  entries.delete(key(`email:${email}`)); entries.delete(key(`ip:${ip}`));
}

export function isRecoveryBlocked(email: string, ip: string) {
  return isLoginBlocked(`recovery:${email}`, `recovery:${ip}`);
}

export function registerRecoveryAttempt(email: string, ip: string) {
  registerLoginFailure(`recovery:${email}`, `recovery:${ip}`);
}
