"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "../../../components/brand-mark";

export default function AcceptInvitePage() {
  return <Suspense fallback={<main className="admin-login-page"><section className="admin-login-card"><BrandMark />Validando convite...</section></main>}><AcceptInviteForm /></Suspense>;
}

function AcceptInviteForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [form, setForm] = useState({ name: "", password: "", code: "" });
  const [recovery, setRecovery] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/admin/invitations?token=${encodeURIComponent(token)}`)
      .then((response) => response.ok ? response.json() as Promise<{ email: string; role: string }> : Promise.reject(new Error("Convite inválido ou expirado.")))
      .then(async (data) => {
        setInfo(data);
        if (data.role === "owner") {
          const setup = await fetch("/api/admin/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setup", token }) });
          const setupData = await setup.json() as { secret?: string; uri?: string };
          if (setup.ok && setupData.secret) { setSecret(setupData.secret); setUri(setupData.uri ?? ""); }
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Convite inválido."));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name: form.name, password: form.password, mfaSecret: secret, mfaCode: form.code }) });
    const data = await response.json() as { error?: string; recoveryCodes?: string[] };
    if (!response.ok) { setError(data.error ?? "Não foi possível ativar a conta."); setLoading(false); return; }
    setRecovery(data.recoveryCodes ?? []);
    setLoading(false);
  }

  if (recovery.length) return <main className="admin-login-page"><section className="admin-login-card"><BrandMark /><span className="eyebrow">Conta ativada</span><h1>Salve seus códigos</h1><p>Guarde estes códigos em local seguro. Cada um pode ser usado uma única vez para recuperar o MFA.</p><div className="recovery-codes">{recovery.map((code) => <code key={code}>{code}</code>)}</div><button className="primary-button" onClick={() => router.replace("/admin")}>Entrar no painel</button></section></main>;

  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><BrandMark /><span className="eyebrow">Convite Crazy Chicken</span><h1>Ative seu acesso</h1>{info ? <p>{info.email}<br />Função: {info.role === "owner" ? "proprietário" : info.role === "manager" ? "gerente" : "atendente"}</p> : <p>{error || "Validando convite..."}</p>}<label className="form-label">Seu nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="form-label">Nova senha<input type="password" minLength={12} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{info?.role === "owner" && <><p className="admin-help">No aplicativo autenticador, adicione a conta usando este código/chave:</p><code className="mfa-secret">{secret}</code><p className="admin-help">URI: {uri}</p><label className="form-label">Código de confirmação<input inputMode="numeric" required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label></>}{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={!info || loading}>{loading ? "Ativando..." : "Criar minha conta"}</button></form></main>;
}
