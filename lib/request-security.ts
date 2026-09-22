function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function hostsFromHeader(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => normalizeHost(item))
    .filter(Boolean);
}

/** Checks the browser Origin while accounting for Hostinger's reverse proxy. */
export function isTrustedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = normalizeHost(new URL(origin).host);
    const allowedHosts = new Set<string>([
      normalizeHost(new URL(request.url).host),
      ...hostsFromHeader(request.headers.get("host")),
      ...hostsFromHeader(request.headers.get("x-forwarded-host")),
    ]);

    const configuredUrl = process.env.APP_URL?.trim();
    if (configuredUrl) allowedHosts.add(normalizeHost(new URL(configuredUrl).host));

    return allowedHosts.has(originHost);
  } catch {
    return false;
  }
}
