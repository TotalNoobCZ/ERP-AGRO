import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP AGRO",
  description: "Poptávky · Zakázky · Konstrukce – jeden systém",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Nastaví uložené téma před prvním vykreslením (žádné probliknutí). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
