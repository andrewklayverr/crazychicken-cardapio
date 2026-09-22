import { authenticateAdmin, startAdminSession, startLegacyAdminSession } from "../../../../lib/auth";
import { getPool } from "../../../../db";
import { takeAdminAttempt, RecoveryError } from "../../../../lib/admin-recovery";
import { hashToken } from "../../../../lib/admin-security";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { email?: string; password?: string; mfaCode?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!email || !password) return Response.json({ error: "E-mail ou senha invalidos." }, { status: 401 });
    await takeAdminAttempt(getPool(), email, ip, "login");
    const result = await authenticateAdmin(email, password, String(body.mfaCode ?? "").trim() || undefined);
    if (!result) return Response.json({ error: "E-mail ou senha invalidos." }, { status: 401 });
    if (result.mfaRequired) {
      return Response.json({ error: result.invalidMfa ? "Codigo de verificacao invalido." : "Informe o codigo do aplicativo autenticador.", code: "mfa_required" }, { status: 401 });
    }
    await getPool().execute("DELETE FROM admin_login_throttles WHERE key_hash IN (?, ?)", [hashToken(`email:${email}`), hashToken(`ip:${ip}`)]);
    if (result.legacy) await startLegacyAdminSession(email);
    else await startAdminSession(result.user.id, result.user.email);
    return Response.json({ ok: true, user: { name: result.user.displayName, email: result.user.email, role: result.user.role } });
  } catch (error) {
    if (error instanceof RecoveryError && error.status === 429) return Response.json({ error: "Muitas tentativas. Aguarde 15 minutos ou recupere seu acesso." }, { status: 429 });
    return Response.json({ error: "Não foi possível entrar agora. Tente novamente mais tarde." }, { status: 503 });
  }
}
