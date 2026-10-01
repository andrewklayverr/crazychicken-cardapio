import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { validateAdminMutation } from "../../../../lib/auth";
import { optimizeUploadedImage } from "../../../../lib/image-optimization";
import { saveUpload, uploadExists } from "../../../../lib/storage";
import { detectSafeImageType, safeUploadBaseName } from "../../../../lib/upload-security";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(["owner", "manager"]); await validateAdminMutation(request);
    const form = await request.formData();
    const file = form.get("file");
    const scope = form.get("scope");
    if (!(file instanceof File) || file.size <= 0 || file.size > 5_000_000) return Response.json({ error: "Envie uma imagem de até 5 MB." }, { status: 400 });
    if (scope !== null && scope !== "products") return Response.json({ error: "Destino de upload inválido." }, { status: 400 });
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
    const folder = scope === "products" ? "produtos/" : "";
    const key = `uploads/${folder}${crypto.randomUUID()}-${safeUploadBaseName(file.name)}.${outputType.extension}`;
    await saveUpload(key, optimizedBytes);
    if (!(await uploadExists(key))) throw new Error("A imagem foi processada, mas não pôde ser confirmada no armazenamento.");
    await recordAudit({ user, action: "upload", entity: "asset", entityId: key, metadata: { contentType: outputType.mime, originalContentType: imageType.mime, size: file.size, storedSize: optimizedBytes.byteLength } });
    return Response.json({ key, url: `/api/media?key=${encodeURIComponent(key)}`, verified: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}
