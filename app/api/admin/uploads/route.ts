import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";
import { saveUpload } from "../../../../lib/storage";
import { detectSafeImageType, safeUploadBaseName } from "../../../../lib/upload-security";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0 || file.size > 5_000_000) return Response.json({ error: "Envie uma imagem de até 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageType = detectSafeImageType(bytes);
    if (!imageType) return Response.json({ error: "O conteúdo precisa ser uma imagem PNG, JPG ou WEBP válida." }, { status: 400 });
    const key = `uploads/${crypto.randomUUID()}-${safeUploadBaseName(file.name)}.${imageType.extension}`;
    await saveUpload(key, bytes);
    await recordAudit({ user, action: "upload", entity: "asset", entityId: key, metadata: { contentType: imageType.mime, size: file.size } });
    return Response.json({ key, url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
