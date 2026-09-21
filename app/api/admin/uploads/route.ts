import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { saveUpload } from "../../../../lib/storage";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5_000_000) return Response.json({ error: "Envie uma imagem de até 5 MB." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "Formato permitido: PNG, JPG, WEBP ou SVG." }, { status: 400 });
    const cleanName = file.name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase() || "imagem";
    const key = `uploads/${crypto.randomUUID()}-${cleanName}`;
    await saveUpload(key, new Uint8Array(await file.arrayBuffer()));
    await recordAudit({ user, action: "upload", entity: "asset", entityId: key, metadata: { contentType: file.type, size: file.size } });
    return Response.json({ key, url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
