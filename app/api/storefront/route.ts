import { getStorefront } from "../../../lib/store";

export async function GET() {
  const data = await getStorefront();
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
