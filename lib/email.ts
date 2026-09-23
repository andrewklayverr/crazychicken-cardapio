function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Configure RESEND_API_KEY e EMAIL_FROM na Hostinger.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) throw new Error("Não foi possível enviar o e-mail de acesso.");
}

function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("Configure APP_URL na Hostinger.");
  const parsed = new URL(value);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") throw new Error("APP_URL precisa usar HTTPS em produção.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("APP_URL inválida.");
  return parsed.origin;
}

export async function sendAdminInvite(input: { email: string; role: string; token: string; name?: string }) {
  const url = `${appUrl()}/admin/accept-invite?token=${encodeURIComponent(input.token)}`;
  await sendEmail(input.email, "Seu acesso ao painel Crazy Chicken", `<p>Você recebeu acesso ao painel administrativo da Crazy Chicken.</p><p>Função: <strong>${escapeHtml(input.role)}</strong></p><p><a href="${url}">Criar minha conta</a></p><p>Este link expira em 24 horas e só pode ser usado uma vez.</p>`);
}

export async function sendPasswordReset(input: { email: string; token: string }) {
  const url = `${appUrl()}/admin/reset?token=${encodeURIComponent(input.token)}`;
  await sendEmail(input.email, "Recuperação de acesso Crazy Chicken", `<p>Recebemos uma solicitação para trocar sua senha.</p><p><a href="${url}">Redefinir minha senha</a></p><p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>`);
}
