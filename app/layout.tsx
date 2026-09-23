import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://crazychiken.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
