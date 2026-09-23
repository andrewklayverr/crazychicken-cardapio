import { endAdminSession, validateAdminMutation } from "../../../../lib/auth";

export async function POST(request: Request) {
  await validateAdminMutation(request);
  await endAdminSession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
