import assert from "node:assert/strict";
import { detectSafeImageType, safeUploadBaseName } from "../lib/upload-security.ts";
import { isTrustedRequestOrigin, safeStringEqual } from "../lib/request-security.ts";
import { takeMemoryRateLimit } from "../lib/memory-rate-limit.ts";

const previousAppUrl = process.env.APP_URL;
const previousNodeEnv = process.env.NODE_ENV;
process.env.APP_URL = "https://crazychiken.com.br";
process.env.NODE_ENV = "production";

assert.equal(isTrustedRequestOrigin(new Request("https://internal-host/api/admin/settings", { headers: { origin: "https://crazychiken.com.br" } })), true);
assert.equal(isTrustedRequestOrigin(new Request("https://crazychiken.com.br/api/admin/settings", { headers: { origin: "https://evil.example", "x-forwarded-host": "evil.example" } })), false);
assert.equal(isTrustedRequestOrigin(new Request("https://crazychiken.com.br/api/admin/settings")), false);
assert.equal(isTrustedRequestOrigin(new Request("https://crazychiken.com.br/api/admin/settings", { headers: { origin: "https://crazychiken.com.br", "sec-fetch-site": "cross-site" } })), false);
assert.equal(safeStringEqual("token", "token"), true);
assert.equal(safeStringEqual("token", "other"), false);

assert.deepEqual(detectSafeImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { mime: "image/png", extension: "png" });
assert.deepEqual(detectSafeImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), { mime: "image/jpeg", extension: "jpg" });
assert.deepEqual(detectSafeImageType(new TextEncoder().encode("RIFF0000WEBP")), { mime: "image/webp", extension: "webp" });
assert.equal(detectSafeImageType(new TextEncoder().encode("<svg><script>alert(1)</script></svg>")), null);
assert.equal(safeUploadBaseName("../../Foto perigosa.SVG"), "foto-perigosa");
assert.equal(takeMemoryRateLimit("test", "address", 2, 60_000, 1000), true);
assert.equal(takeMemoryRateLimit("test", "address", 2, 60_000, 1001), true);
assert.equal(takeMemoryRateLimit("test", "address", 2, 60_000, 1002), false);
assert.equal(takeMemoryRateLimit("test", "address", 2, 60_000, 61_001), true);

if (previousAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = previousAppUrl;
if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;

console.log("Controles de origem, comparação segura e uploads validados.");
