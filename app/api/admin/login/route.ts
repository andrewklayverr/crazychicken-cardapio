import { authenticateAdmin, startAdminSession, startLegacyAdminSession } from "../../../../lib/auth";
import { isLoginBlocked, registerLoginFailure, clearLoginFailures } from "../../../../lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string; mfaCode?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!email || !password || isLoginBlocked(email, ip)) return Response.json({ error: "E-mail ou senha invalidos." }, { status: 401 });
  const result = await authenticateAdmin(email, password, String(body.mfaCode ?? "").trim() || undefined);
  if (!result) { registerLoginFailure(email, ip); return Response.json({ error: "E-mail ou senha invalidos." }, { status: 401 }); }
  if (result.mfaRequired) {
    if (result.invalidMfa) registerLoginFailure(email, ip);
    return Response.json({ error: result.invalidMfa ? "Codigo de verificacao invalido." : "Informe o codigo do aplicativo autenticador.", code: "mfa_required" }, { status: 401 });
  }
  clearLoginFailures(email, ip);
  if (result.legacy) await startLegacyAdminSession(email);
  else await startAdminSession(result.user.id, result.user.email);
  return Response.json({ ok: true, user: { name: result.user.displayName, email: result.user.email, role: result.user.role } });
}
