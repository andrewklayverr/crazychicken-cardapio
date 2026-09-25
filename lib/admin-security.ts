import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
export { validatePassword } from "./password-rules";
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function scryptAsync(password: string, salt: string, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => scrypt(password, salt, length, options, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
}

export type AdminRole = "owner" | "manager" | "attendant";
export type AdminStatus = "invited" | "active" | "suspended";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 190);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * 1024 * 1024 }) as Buffer;
  return `scrypt$v2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  let salt = "";
  let expected = "";
  let options = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  if (parts[0] === "scrypt" && parts[1] === "v2" && parts.length === 7) {
    options = { N: Number(parts[2]), r: Number(parts[3]), p: Number(parts[4]), maxmem: 256 * 1024 * 1024 };
    salt = parts[5]; expected = parts[6];
  } else if (parts[0] === "scrypt" && parts.length === 3) {
    salt = parts[1]; expected = parts[2];
  } else return false;
  if (!salt || expected.length !== 128 || !Number.isInteger(options.N)) return false;
  const actual = await scryptAsync(password, salt, 64, options) as Buffer;
  const actualHex = actual.toString("hex");
  return actualHex.length === expected.length && timingSafeEqualText(actualHex, expected);
}

function timingSafeEqualText(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY ?? "";
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY precisa conter 32 bytes em hexadecimal ou base64.");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [, ivValue, tagValue, encryptedValue] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(value: string) {
  let bits = "";
  for (const character of value.replace(/=+$/, "").toUpperCase()) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) throw new Error("Segredo MFA inválido.");
    bits += index.toString(2).padStart(5, "0");
  }
  const output: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) output.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(output);
}

export function generateTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let index = 0; index < bits.length; index += 5) secret += base32Alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return secret;
}

export function totpUri(email: string, secret: string) {
  return `otpauth://totp/${encodeURIComponent(`Crazy Chicken:${email}`)}?secret=${secret}&issuer=Crazy%20Chicken&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, token: string) {
  if (!/^\d{6}$/.test(token)) return false;
  const key = base32Decode(secret);
  const current = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    const counter = Buffer.alloc(8); counter.writeBigInt64BE(BigInt(current + offset));
    const digest = createHmac("sha1", key).update(counter).digest();
    const position = digest[digest.length - 1] & 15;
    const value = ((digest[position] & 127) << 24) | ((digest[position + 1] & 255) << 16) | ((digest[position + 2] & 255) << 8) | (digest[position + 3] & 255);
    if (String(value % 1_000_000).padStart(6, "0") === token) return true;
  }
  return false;
}

export function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const value = randomBytes(5).toString("hex").toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}
