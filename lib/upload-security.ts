export type SafeImageType = { mime: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" };

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectSafeImageType(bytes: Uint8Array): SafeImageType | null {
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 12
    && new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export function safeUploadBaseName(value: string) {
  const withoutExtension = value.replace(/\.[^.]*$/, "");
  return withoutExtension.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "imagem";
}
