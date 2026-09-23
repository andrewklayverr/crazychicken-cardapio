import { getPublicStoreConfig } from "../../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPublicStoreConfig();
  return Response.json(config, {
    status: config.configurationError ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
