export const MEDIA_WIDTHS = [96, 160, 240, 320, 480, 640, 768, 960, 1280, 1600, 1920] as const;

export function normalizeMediaWidth(value: string | null) {
  if (!value) return null;
  const width = Number(value);
  return MEDIA_WIDTHS.includes(width as (typeof MEDIA_WIDTHS)[number]) ? width : null;
}

export function isManagedMediaUrl(url: string) {
  return url.startsWith("/api/media?");
}

export function mediaVariantUrl(url: string, width: number) {
  if (!isManagedMediaUrl(url)) return url;
  const normalizedWidth = normalizeMediaWidth(String(width));
  if (!normalizedWidth) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}w=${normalizedWidth}`;
}

export function mediaSrcSet(url: string, widths: readonly number[]) {
  if (!isManagedMediaUrl(url)) return undefined;
  const candidates = [...new Set(widths)]
    .map((width) => normalizeMediaWidth(String(width)))
    .filter((width): width is number => width !== null);
  if (!candidates.length) return undefined;
  return candidates.map((width) => `${mediaVariantUrl(url, width)} ${width}w`).join(", ");
}
