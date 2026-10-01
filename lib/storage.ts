import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export function resolveUploadRoot(cwd = process.cwd(), configured = process.env.UPLOAD_DIR) {
  const requested = configured?.trim();
  if (requested && path.isAbsolute(requested)) return path.resolve(requested);

  const normalizedCwd = cwd.replace(/\\/g, "/");
  const hostingerBuild = normalizedCwd.match(/^(.*\/domains\/[^/]+)\/hbuilds(?:\/|$)/i);
  if (hostingerBuild?.[1]) return path.resolve(hostingerBuild[1], "uploads");

  return path.resolve(cwd, requested || path.join("public", "uploads"));
}

function safeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^uploads\/[a-z0-9._/-]+$/i.test(normalized)) throw new Error("Arquivo inválido.");
  return normalized;
}

function uploadTarget(root: string, key: string) {
  return path.join(root, safeKey(key).replace(/^uploads[\\/]/, ""));
}

function assertPersistentProductionRoot(root: string) {
  if (process.env.NODE_ENV !== "production") return;
  const normalized = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const temporaryBuildPath = /\/(?:hbuilds|\.next)(?:\/|$)/i.test(normalized) || /\/source\/repository(?:\/|$)/i.test(normalized);
  const publicUploadPath = /\/public\/uploads(?:\/|$)/i.test(normalized);
  if (temporaryBuildPath || publicUploadPath) throw new Error("UPLOAD_DIR precisa apontar para a pasta persistente do domínio, fora da implantação.");
}

export function publicAssetUrl(key: string | null | undefined) {
  if (!key) return "/hero-food.jpeg";
  if (key.startsWith("/") || key.includes(".") && !key.includes("/")) return `/${key.replace(/^\//, "")}`;
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function saveUpload(key: string, data: Uint8Array, root = resolveUploadRoot()) {
  const cleanKey = safeKey(key);
  assertPersistentProductionRoot(root);
  const target = uploadTarget(root, cleanKey);
  const temporaryTarget = `${target}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(temporaryTarget, data, { flag: "wx" });
    const stored = await readFile(temporaryTarget);
    const expected = Buffer.from(data);
    if (stored.byteLength !== expected.byteLength || !timingSafeEqual(stored, expected)) throw new Error("A imagem não foi gravada integralmente.");
    await rename(temporaryTarget, target);
    const finalFile = await stat(target);
    if (!finalFile.isFile() || finalFile.size !== expected.byteLength) throw new Error("A imagem não pôde ser confirmada no armazenamento.");
    return cleanKey;
  } catch (error) {
    await rm(temporaryTarget, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readUpload(key: string, root = resolveUploadRoot(), legacyRoot = path.resolve(process.cwd(), "public", "uploads")) {
  const cleanKey = safeKey(key);
  const target = uploadTarget(root, cleanKey);
  try {
    return await readFile(target);
  } catch (error) {
    if (root === legacyRoot) throw error;
    const legacyTarget = uploadTarget(legacyRoot, cleanKey);
    return readFile(legacyTarget);
  }
}

export async function uploadExists(key: string, root = resolveUploadRoot()) {
  try {
    return (await readUpload(key, root)).byteLength > 0;
  } catch {
    return false;
  }
}
