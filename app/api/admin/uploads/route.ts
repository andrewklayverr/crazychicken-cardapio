import { env } from "cloudflare:workers";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    if (!env.BUCKET) return Response.json({ error: "Armazenamento de imagens não configurado." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5_000_000) return Response.json({ error: "Envie uma imagem de até 5 MB." }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "O arquivo precisa ser uma imagem." }, { status: 400 });
    const key = `uploads/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase()}`;
    await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    await recordAudit({ user, action: "upload", entity: "asset", entityId: key, metadata: { contentType: file.type, size: file.size } });
    return Response.json({ key, url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
