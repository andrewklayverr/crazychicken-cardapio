import { endAdminSession, validateAdminMutation } from "../../../../lib/auth";
import { adminErrorResponse } from "../../../../lib/admin";

export async function POST(request: Request) {
  try {
    await validateAdminMutation(request);
    await endAdminSession();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
