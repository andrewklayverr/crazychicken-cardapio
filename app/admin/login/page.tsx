"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível entrar.");
      router.replace("/admin");
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar."); setLoading(false); }
  }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><div className="brand-mark"><div className="brand-mark__icon">🐔</div><div className="brand-mark__copy"><strong>Crazy</strong><span>Chicken</span></div></div><span className="eyebrow">Painel protegido</span><h1>Entrar no admin</h1><p>Use um e-mail autorizado para gerenciar cardápio, pedidos e aparência.</p><label className="form-label">E-mail<input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="form-label">Senha<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar no painel"}</button><Link href="/">Voltar para a loja</Link></form></main>;
}
