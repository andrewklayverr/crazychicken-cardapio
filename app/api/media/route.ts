import { readUpload, saveUpload } from "../../../lib/storage";
import { normalizeMediaWidth } from "../../../lib/media-images";
import sharp from "sharp";

const contentTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

function variantKey(key: string, width: number) {
  const relativeKey = key.replace(/^uploads\//, "").replace(/\.[^.]+$/, "");
  return `uploads/.variants/w${width}/${relativeKey}.webp`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const requestedWidth = url.searchParams.get("w");
  try {
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    let contentType = contentTypes[extension];
    if (!contentType) throw new Error("unsupported media");
    const width = normalizeMediaWidth(requestedWidth);
    if (requestedWidth && !width) {
      return new Response("Largura de imagem inválida", { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }

    let data: Uint8Array;
    if (width) {
      contentType = "image/webp";
      const cachedKey = variantKey(key, width);
      try {
        data = await readUpload(cachedKey);
      } catch {
        const original = await readUpload(key);
        data = new Uint8Array(await sharp(Buffer.from(original), { failOn: "error", limitInputPixels: 20_000_000 })
          .rotate()
          .resize({ width, fit: "inside", withoutEnlargement: true })
          .webp({ quality: width <= 480 ? 76 : 80, effort: 3, smartSubsample: true })
          .toBuffer());
        await saveUpload(cachedKey, data);
      }
    } else {
      data = await readUpload(key);
    }

    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    } });
  } catch {
    return new Response("Imagem não encontrada", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
