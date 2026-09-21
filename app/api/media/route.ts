import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !env.BUCKET) return new Response("Imagem não encontrada", { status: 404 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Imagem não encontrada", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
}
