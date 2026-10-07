import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { orders } from "../../../../../../db/schema";
import { getClientIp } from "../../../../../../lib/request-security";
import { takeMemoryRateLimit } from "../../../../../../lib/memory-rate-limit";

const digits = (value: string) => value.replace(/\D/g, "");
const MAX_QR_IMAGE_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const noStore = { "Cache-Control": "private, no-store" };
  try {
    if (!takeMemoryRateLimit("orders:payment-qr", getClientIp(request), 20, 10 * 60 * 1000)) return Response.json({ error: "Muitas consultas." }, { status: 429, headers: noStore });
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase().slice(0, 48);
    const phone = (new URL(request.url).searchParams.get("phone") ?? "").trim().slice(0, 30);
    if (!/^CC-[A-Z0-9-]+$/.test(code) || digits(phone).length < 8) return Response.json({ error: "QR Code não encontrado." }, { status: 404, headers: noStore });
    const db = getDb();
    let [order] = await db.select().from(orders).where(and(eq(orders.code, code), eq(orders.customerPhone, phone))).limit(1);
    if (!order) {
      const [candidate] = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
      if (!candidate || digits(candidate.customerPhone) !== digits(phone)) return Response.json({ error: "QR Code não encontrado." }, { status: 404, headers: noStore });
      order = candidate;
    }
    if (order.paymentMethod !== "pix" || !order.pixQrCodeBase64 || order.pixQrCodeBase64.length > 2_800_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(order.pixQrCodeBase64)) return Response.json({ error: "QR Code não encontrado." }, { status: 404, headers: noStore });
    const image = Buffer.from(order.pixQrCodeBase64, "base64");
    if (!image.byteLength || image.byteLength > MAX_QR_IMAGE_BYTES) return Response.json({ error: "QR Code inválido." }, { status: 400, headers: noStore });
    const png = image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpeg = image[0] === 0xff && image[1] === 0xd8 && image[image.length - 2] === 0xff && image[image.length - 1] === 0xd9;
    if (!png && !jpeg) return Response.json({ error: "QR Code inválido." }, { status: 400, headers: noStore });
    return new Response(image, { headers: { ...noStore, "Content-Type": png ? "image/png" : "image/jpeg", "Content-Length": String(image.byteLength), "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Não foi possível carregar o QR Code." }, { status: 500, headers: noStore });
  }
}
