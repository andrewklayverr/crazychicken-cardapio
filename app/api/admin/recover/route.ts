import { getPool } from "../../../../db";
import { RecoveryError, recoverOwner, recoveryOrigin } from "../../../../lib/admin-recovery";
import { clearLoginFailures } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const reply = (data: object, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!recoveryOrigin(request, process.env.APP_URL)) return reply({ error: "Origem da requisição inválida." }, 403);
  try {
    const ip = getClientIp(request);
    const body = await request.json().catch(() => null);
    const email = await recoverOwner(getPool(), body, ip);
    clearLoginFailures(email, ip);
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof RecoveryError) return reply({ error: error.message }, error.status);
    console.error("[admin-recover] operation failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return reply({ error: "Não foi possível concluir a recuperação. Tente novamente mais tarde." }, 503);
  }
}
