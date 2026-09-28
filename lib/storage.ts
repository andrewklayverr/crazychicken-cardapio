import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function resolveUploadRoot(cwd = process.cwd(), configured = process.env.UPLOAD_DIR) {
  const requested = configured?.trim();
  if (requested && path.isAbsolute(requested)) return path.resolve(requested);

  const normalizedCwd = cwd.replace(/\\/g, "/");
  const hostingerBuild = normalizedCwd.match(/^(.*\/domains\/[^/]+)\/hbuilds(?:\/|$)/i);
  if (hostingerBuild?.[1]) return path.resolve(hostingerBuild[1], "uploads");

  return path.resolve(cwd, requested || path.join("public", "uploads"));
}

const uploadRoot = resolveUploadRoot();
const legacyUploadRoot = path.resolve(process.cwd(), "public", "uploads");

function safeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || !/^uploads\/[a-z0-9._/-]+$/i.test(normalized)) throw new Error("Arquivo inválido.");
  return normalized;
}

export function publicAssetUrl(key: string | null | undefined) {
  if (!key) return "/hero-food.jpeg";
  if (key.startsWith("/") || key.includes(".") && !key.includes("/")) return `/${key.replace(/^\//, "")}`;
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export async function saveUpload(key: string, data: Uint8Array) {
  const cleanKey = safeKey(key);
  const target = path.join(uploadRoot, cleanKey.replace(/^uploads[\\/]/, ""));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return cleanKey;
}

export async function readUpload(key: string) {
  const cleanKey = safeKey(key);
  const target = path.join(uploadRoot, cleanKey.replace(/^uploads[\\/]/, ""));
  try {
    return await readFile(target);
  } catch (error) {
    if (uploadRoot === legacyUploadRoot) throw error;
    const legacyTarget = path.join(legacyUploadRoot, cleanKey.replace(/^uploads[\\/]/, ""));
    return readFile(legacyTarget);
  }
}
