import { getStorefront } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getStorefront();
  return Response.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
