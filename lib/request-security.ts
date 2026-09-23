import { timingSafeEqual } from "node:crypto";

export class RequestSecurityError extends Error {
  readonly status = 403;

  constructor(message = "Requisição de origem inválida.") {
    super(message);
    this.name = "RequestSecurityError";
  }
}

function normalizeOrigin(value: string) {
  return new URL(value).origin.toLowerCase();
}

function configuredOrigin() {
  const value = process.env.APP_URL?.trim();
  if (!value) return null;
  try { return normalizeOrigin(value); } catch { return null; }
}

/**
 * Validates browser mutations against the canonical production origin.
 * Host and X-Forwarded-Host are intentionally not trusted when APP_URL exists.
 */
export function isTrustedRequestOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const supplied = request.headers.get("origin") ?? request.headers.get("referer");
  if (!supplied) return false;

  try {
    const actual = normalizeOrigin(supplied);
    const canonical = configuredOrigin();
    if (process.env.NODE_ENV === "production") return Boolean(canonical && actual === canonical);

    const requestOrigin = normalizeOrigin(request.url);
    return actual === requestOrigin || Boolean(canonical && actual === canonical);
  } catch {
    return false;
  }
}

export function requireTrustedRequestOrigin(request: Request) {
  if (!isTrustedRequestOrigin(request)) throw new RequestSecurityError();
}

/** Best-effort client address behind Hostinger/Cloudflare. Never use as identity. */
export function getClientIp(request: Request) {
  const candidate = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]
    ?? "unknown";
  const value = candidate.trim().slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(value) ? value : "unknown";
}

export function safeStringEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
