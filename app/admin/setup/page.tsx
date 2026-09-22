"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", email: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    const response = await fetch("/api/admin/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error ?? "Não foi possível configurar o acesso."); setLoading(false); return; }
    router.replace("/admin");
  }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><div className="brand-mark"><div className="brand-mark__icon">🐔</div><div className="brand-mark__copy"><strong>Crazy</strong><span>Chicken</span></div></div><span className="eyebrow">Primeiro acesso</span><h1>Configurar administrador</h1><p>Use o código único recebido na entrega do site.</p><label className="form-label">Código de configuração<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} autoComplete="one-time-code" /></label><label className="form-label">E-mail do responsável<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label><label className="form-label">Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></label><label className="form-label">Nova senha<input type="password" required minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Configurando..." : "Criar acesso"}</button><a href="/admin/login">Já tenho uma conta</a></form></main>;
}
