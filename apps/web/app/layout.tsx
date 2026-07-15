import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP AGRO",
  description: "Poptávky · Zakázky · Konstrukce – jeden systém",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
