"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "../../../components/brand-mark";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }) });
      const data = await response.json() as { error?: string; code?: string };
      if (!response.ok) {
        if (data.code === "mfa_required") setNeedsMfa(true);
        throw new Error(data.error ?? "Não foi possível entrar.");
      }
      router.replace("/admin");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><BrandMark /><span className="eyebrow">Painel protegido</span><h1>Entrar no admin</h1><p>Use seu acesso individual para gerenciar a loja.</p><label className="form-label">E-mail<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="form-label">Senha<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{needsMfa && <label className="form-label">Código do autenticador<input inputMode="numeric" pattern="[0-9A-Za-z-]{6,14}" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="123456 ou código de recuperação" /></label>}{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar no painel"}</button><Link href="/admin/forgot">Esqueci minha senha</Link><Link href="/admin/recover">Recuperar com código da hospedagem</Link><Link href="/">Voltar para a loja</Link></form></main>;
}
