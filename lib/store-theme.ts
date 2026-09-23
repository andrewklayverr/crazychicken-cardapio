export type StoreAppearance = {
  accent: string;
  primary: string;
  background: string;
};

type Rgb = { r: number; g: number; b: number };

const fallback = { accent: "#ffc21b", primary: "#e32120", background: "#fff8e9" };
const hexPattern = /^#[0-9a-f]{6}$/i;

function normalizeHex(value: unknown, defaultValue: string) {
  const candidate = String(value ?? "").trim().toLowerCase();
  return hexPattern.test(candidate) ? candidate : defaultValue;
}

function toRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: Rgb) {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mix(first: string, second: string, secondWeight: number) {
  const a = toRgb(first);
  const b = toRgb(second);
  return toHex({
    r: a.r + (b.r - a.r) * secondWeight,
    g: a.g + (b.g - a.g) * secondWeight,
    b: a.b + (b.b - a.b) * secondWeight,
  });
}

function luminance(hex: string) {
  const channels = Object.values(toRgb(hex)).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function normalizeStoreAppearance<T extends StoreAppearance>(appearance: T): T {
  return {
    ...appearance,
    accent: normalizeHex(appearance.accent, fallback.accent),
    primary: normalizeHex(appearance.primary, fallback.primary),
    background: normalizeHex(appearance.background, fallback.background),
  };
}

export function getStoreThemeTokens(appearance: StoreAppearance) {
  const colors = normalizeStoreAppearance(appearance);
  const dark = luminance(colors.background) < 0.22;
  const text = dark ? "#fff8e9" : "#171411";
  const muted = dark ? "#c8bca7" : "#756c5c";
  const surface = dark ? mix(colors.background, "#ffffff", 0.07) : mix(colors.background, "#ffffff", 0.62);
  const surfaceAlt = dark ? mix(colors.background, "#ffffff", 0.13) : mix(colors.background, "#c8aa78", 0.16);
  const line = dark ? mix(colors.background, "#ffffff", 0.2) : mix(colors.background, "#6f5a3a", 0.22);

  return {
    "--store-bg": colors.background,
    "--store-surface": surface,
    "--store-surface-alt": surfaceAlt,
    "--store-text": text,
    "--store-muted": muted,
    "--store-line": line,
    "--store-accent": colors.accent,
    "--store-primary": colors.primary,
    "--store-on-primary": luminance(colors.primary) > 0.44 ? "#171411" : "#ffffff",
    "--store-strong": dark ? "#0c0c0c" : "#141414",
    "--store-header": dark ? mix(colors.background, "#ffffff", 0.035) : surface,
    "--yellow": colors.accent,
    "--red": colors.primary,
    "--cream": colors.background,
  } as const;
}
