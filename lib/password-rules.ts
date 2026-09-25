export type PasswordChecks = {
  minLength: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
};

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasNumber: /\p{N}/u.test(password),
    hasSpecial: /[^\p{L}\p{N}\s]/u.test(password),
  };
}

export function validatePassword(password: string) {
  const checks = getPasswordChecks(password);
  if (!checks.minLength) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!checks.hasNumber) return "A senha precisa ter pelo menos um número.";
  if (!checks.hasSpecial) return "A senha precisa ter pelo menos um símbolo, como !, @ ou #.";
  if (password.length > 128) return "A senha não pode ter mais de 128 caracteres.";
  return null;
}
