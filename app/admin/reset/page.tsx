"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetAdminPasswordPage() { return <Suspense fallback={<main className="admin-login-page"><section className="admin-login-card">Validando link...</section></main>}><ResetAdminPasswordForm /></Suspense>; }

function ResetAdminPasswordForm() {
  const token = useSearchParams().get("token") ?? ""; const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); const response = await fetch("/api/admin/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }); const data = await response.json() as { error?: string }; if (!response.ok) { setError(data.error ?? "Link inválido."); setLoading(false); return; } router.replace("/admin/login"); }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><span className="eyebrow">Recuperação segura</span><h1>Nova senha</h1><p>Use pelo menos 12 caracteres.</p><label className="form-label">Nova senha<input type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button></form></main>;
}
