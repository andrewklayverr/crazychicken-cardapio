"use client";

import { useEffect, useState } from "react";

type Member = { id: number; email: string; name: string; role: string; status: string; mfaEnabledAt?: string | null };

function request(input: RequestInfo | URL, init: RequestInit = {}) {
  const cookie = document.cookie.split("; ").find((item) => item.startsWith("crazy_chicken_csrf="));
  const csrf = cookie?.slice("crazy_chicken_csrf=".length);
  return fetch(input, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}) } });
}

export function AdminTeamPanel({ currentUser }: { currentUser: { id: number; name: string; email: string } }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("attendant");
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const load = async () => { const response = await request("/api/admin/users"); if (response.ok) setMembers((await response.json() as { users: Member[] }).users); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  const invite = async () => { const response = await request("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) }); setMessage(response.ok ? "Convite enviado." : "Não foi possível enviar o convite."); if (response.ok) { setEmail(""); await load(); } };
  const toggle = async (member: Member) => { const status = member.status === "suspended" ? "active" : "suspended"; const response = await request("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, status }) }); if (response.ok) await load(); };
  const setupMfa = async () => { const response = await request("/api/admin/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setup" }) }); if (!response.ok) { setMessage("Não foi possível iniciar o MFA."); return; } const data = await response.json() as { secret: string; uri: string }; setSecret(data.secret); setUri(data.uri); };
  const enableMfa = async () => { const response = await request("/api/admin/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enable", secret, code }) }); const data = await response.json() as { recoveryCodes?: string[]; error?: string }; if (!response.ok) { setMessage(data.error ?? "Código MFA inválido."); return; } setRecoveryCodes(data.recoveryCodes ?? []); setSecret(""); setUri(""); setCode(""); setMessage("MFA ativado."); };
  return <main className="admin-main"><header className="admin-header"><div><span className="eyebrow">Proprietário</span><h1>Equipe e acessos</h1></div><a className="admin-store-link" href="/admin">Voltar ao painel</a></header><section className="admin-card page-card"><p>Convide cada pessoa com um e-mail próprio. O link expira em 24 horas.</p><div className="form-two-col"><label className="form-label">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pessoa@empresa.com.br" /></label><label className="form-label">Função<select value={role} onChange={(event) => setRole(event.target.value)}><option value="attendant">Atendente</option><option value="manager">Gerente</option></select></label></div><button className="primary-button" disabled={!email.includes("@")} onClick={invite}>Enviar convite</button>{message && <p className="admin-notice">{message}</p>}<div className="admin-products-list">{members.map((member) => <div className="admin-product-row" key={member.id}><div><strong>{member.name}</strong><span>{member.email} · {member.role === "owner" ? "proprietário" : member.role === "manager" ? "gerente" : "atendente"}</span></div><b>{member.status === "active" ? "Ativo" : member.status === "suspended" ? "Suspenso" : "Convidado"}</b>{member.id !== currentUser.id && <button className="secondary-button" onClick={() => toggle(member)}>{member.status === "suspended" ? "Reativar" : "Suspender"}</button>}</div>)}</div></section><section className="admin-card page-card"><span className="eyebrow">Proteção da conta</span><h2>Autenticação em dois fatores</h2>{recoveryCodes.length ? <><p>Guarde estes códigos; cada um pode ser usado uma vez:</p><div className="recovery-codes">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div></> : secret ? <><p>Adicione esta chave ao aplicativo autenticador e informe o código gerado.</p><code className="mfa-secret">{secret}</code><p className="admin-help">URI: {uri}</p><input className="form-label" inputMode="numeric" placeholder="Código de 6 dígitos" value={code} onChange={(event) => setCode(event.target.value)} /><button className="primary-button" onClick={enableMfa}>Confirmar MFA</button></> : <><p>O MFA é obrigatório para o proprietário.</p><button className="secondary-button" onClick={setupMfa}>Iniciar configuração</button></>}</section></main>;
}
