"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotAdminPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); await fetch("/api/admin/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); setSent(true); setLoading(false); }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}><span className="eyebrow">Recuperação segura</span><h1>Redefinir senha</h1>{sent ? <><p>Se o e-mail estiver cadastrado, enviaremos um link de recuperação.</p><Link href="/admin/login">Voltar para o login</Link></> : <><p>Informe o e-mail da sua conta administrativa.</p><label className="form-label">E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="primary-button" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</button><Link href="/admin/login">Voltar para o login</Link></>}</form></main>;
}
