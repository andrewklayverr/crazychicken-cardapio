import { getCurrentUser } from "../../../../lib/auth";
import { adminErrorResponse } from "../../../../lib/admin";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ user: null }, { status: 401 });
    return Response.json({ user: { id: user.id, name: user.displayName, email: user.email, role: user.role, mfaEnabled: Boolean(user.mfaEnabledAt) } });
  } catch (error) { return adminErrorResponse(error); }
}
