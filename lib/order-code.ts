export function displayOrderCode(id: number | undefined, fallback: string) {
  if (Number.isInteger(id) && (id as number) > 0) return `#${String(id).padStart(4, "0")}`;
  const numericCode = /^CC-(\d+)$/.exec(fallback)?.[1];
  return numericCode ? `#${numericCode.padStart(4, "0")}` : fallback;
}
