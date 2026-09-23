import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const maxBuckets = 5000;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Process-local abuse protection. Edge/WAF limits remain necessary for volumetric traffic. */
export function takeMemoryRateLimit(namespace: string, identity: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size >= maxBuckets) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size >= maxBuckets) buckets.delete(buckets.keys().next().value as string);
  }

  const key = digest(`${namespace}:${identity}`);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
