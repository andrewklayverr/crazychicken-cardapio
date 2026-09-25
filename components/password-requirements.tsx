"use client";

import { getPasswordChecks } from "../lib/password-rules";

export function PasswordRequirements({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const complete = checks.minLength && checks.hasNumber && checks.hasSpecial;
  const items = [
    [checks.minLength, "Pelo menos 8 caracteres"],
    [checks.hasNumber, "Pelo menos um número"],
    [checks.hasSpecial, "Pelo menos um símbolo (!, @, #...)"],
  ] as const;

  return <div>
    <ul className="password-requirements" aria-label="Regras da senha">
      {items.map(([valid, label]) => <li className={valid ? "is-valid" : ""} key={label}><span aria-hidden="true">{valid ? "✓" : "○"}</span>{label}</li>)}
    </ul>
    {password.length > 0 && !complete && <p className="password-requirements__error" role="status">A senha ainda não atende a todas as regras.</p>}
  </div>;
}
