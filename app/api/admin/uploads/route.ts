import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";
import { optimizeUploadedImage } from "../../../../lib/image-optimization";
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
    let optimizedBytes: Uint8Array;
    try {
      optimizedBytes = await optimizeUploadedImage(bytes);
    } catch (error) {
      console.warn("upload-image-optimization-failed", error instanceof Error ? error.message : "unknown-error");
      return Response.json({ error: "Não foi possível processar esta imagem. Tente exportá-la novamente como JPG, PNG ou WEBP." }, { status: 400 });
    }
    const outputType = { mime: "image/webp" as const, extension: "webp" as const };
    const key = `uploads/${crypto.randomUUID()}-${safeUploadBaseName(file.name)}.${outputType.extension}`;
    await saveUpload(key, optimizedBytes);
    await recordAudit({ user, action: "upload", entity: "asset", entityId: key, metadata: { contentType: outputType.mime, originalContentType: imageType.mime, size: file.size, storedSize: optimizedBytes.byteLength } });
    return Response.json({ key, url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}
