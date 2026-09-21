import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crazy Chicken | Cardápio online",
  description: "Frango crocante, petiscos e molhos da Crazy Chicken. Peça online em Suzano.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
