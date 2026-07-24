import type { NextConfig } from "next";

// Bezpečnostní hlavičky pro všechny odpovědi:
//  - clickjacking: stránku nejde vložit do cizího <iframe>,
//  - nosniff: prohlížeč nehádá MIME typy (ochrana před podvrženým obsahem),
//  - referrer: na cizí weby neodchází celá URL (jen origin),
//  - HSTS: prohlížeč si vynutí HTTPS,
//  - permissions: vypnuté senzory, které aplikace nepoužívá.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Workspace balíčky se konzumují přímo jako TS zdroje.
  transpilePackages: ["@erp/core", "@erp/db", "@erp/ui"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
