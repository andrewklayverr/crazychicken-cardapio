"use client";

import { useEffect, useState } from "react";

type BrandMarkProps = {
  compact?: boolean;
  logoKey?: string | null;
};

function resolveLogo(key: string | null | undefined) {
  if (!key || key === "/logo-frango.png") return "/logo-frango.webp";
  if (key.startsWith("/") || (key.includes(".") && !key.includes("/"))) return `/${key.replace(/^\//, "")}`;
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export function BrandMark({ compact = false, logoKey }: BrandMarkProps) {
  const [remoteLogoKey, setRemoteLogoKey] = useState<string | null>(null);

  useEffect(() => {
    if (logoKey !== undefined) return;
    let active = true;
    fetch("/api/storefront")
      .then((response) => response.ok ? response.json() as Promise<{ settings?: { logoKey?: string | null } }> : null)
      .then((data) => {
        if (active && data?.settings) setRemoteLogoKey(data.settings.logoKey ?? null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [logoKey]);

  return <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}><img className="brand-mark__image" src={resolveLogo(logoKey === undefined ? remoteLogoKey : logoKey)} alt="Crazy Chicken" width={42} height={42} loading={compact ? "lazy" : "eager"} decoding="async" fetchPriority={compact ? "low" : "high"} onError={(event) => { if (!event.currentTarget.src.endsWith("/logo-frango.webp")) event.currentTarget.src = "/logo-frango.webp"; }} /></div>;
}
