"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../../../components/brand-mark";

export default function RecoverAdminPage() {
  const [form, setForm] = useState({ email: "", code: "", password: "", confirmPassword: "" });
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (form.password !== form.confirmPassword) { setError("As senhas não coincidem."); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) { setError(data?.error ?? "Não foi possível concluir a recuperação."); return; }
      setForm({ email: "", code: "", password: "", confirmPassword: "" });
      setDone(true);
    } catch { setError("Não foi possível conectar. Confira sua conexão e tente novamente."); }
    finally { setLoading(false); submitting.current = false; }
  }
  return <main className="admin-login-page"><form className="admin-login-card" onSubmit={submit}>
    <BrandMark /><span className="eyebrow">Recuperação do proprietário</span>
    <h1>{done ? "Senha atualizada" : "Recuperar acesso"}</h1>
    {done ? <><p role="status">Sua senha foi atualizada e as sessões anteriores foram encerradas. Entre com sua nova senha.</p><Link className="primary-button" href="/admin/login">Ir para o login</Link></> : <>
      <p>Use o código temporário fornecido pelo responsável pela hospedagem e escolha sua nova senha.</p>
      <label className="form-label">E-mail<input type="email" required maxLength={190} autoComplete="username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="form-label">Código temporário<input type="password" required maxLength={128} autoComplete="off" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></label>
      <label className="form-label">Nova senha<input type={visible ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      <label className="form-label">Confirmar senha<input type={visible ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} /></label>
      <button type="button" className="secondary-button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Ocultar senhas" : "Mostrar senhas"}</button>
      <p>Use de 12 a 128 caracteres. Esta será a senha para entrar no painel.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" className="primary-button" disabled={loading}>{loading ? "Atualizando…" : "Salvar nova senha"}</button>
      <Link href="/admin/login">Voltar para o login</Link>
    </>}
  </form></main>;
}
