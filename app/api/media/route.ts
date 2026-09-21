import { readUpload } from "../../../lib/storage";

const contentTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  try {
    const data = await readUpload(key);
    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    return new Response(data, { headers: { "Content-Type": contentTypes[extension] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Imagem não encontrada", { status: 404 });
  }
}
