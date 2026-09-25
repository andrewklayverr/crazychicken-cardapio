import type { Metadata, Viewport } from "next";
import "./globals.css";

const defaultSiteUrl = "https://crazychicken247.com.br";

function getMetadataBase() {
  const configuredUrl = process.env.APP_URL?.trim();

  if (!configuredUrl) {
    return new URL(defaultSiteUrl);
  }

  try {
    const parsedUrl = new URL(configuredUrl);

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return new URL(defaultSiteUrl);
    }

    return new URL(parsedUrl.origin);
  } catch {
    return new URL(defaultSiteUrl);
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Crazy Chicken | Cardápio online",
  description: "Frango crocante, petiscos e molhos da Crazy Chicken. Peça online em Suzano.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Crazy Chicken | Cardápio online",
    description: "Frango crocante, petiscos e molhos da Crazy Chicken. Peça online em Suzano.",
    url: "/",
    siteName: "Crazy Chicken",
    locale: "pt_BR",
    type: "website",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      {
        url: "/logo-frango.png?v=20260923",
        type: "image/png",
        sizes: "1254x1254",
      },
    ],
    shortcut: "/logo-frango.png?v=20260923",
    apple: [
      {
        url: "/logo-frango.png?v=20260923",
        type: "image/png",
        sizes: "1254x1254",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
