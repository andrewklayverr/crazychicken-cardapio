import { startAdminSession, verifyAdminPassword } from "../../../../lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password || !verifyAdminPassword(email, password)) return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  await startAdminSession(email);
  return Response.json({ ok: true });
}
