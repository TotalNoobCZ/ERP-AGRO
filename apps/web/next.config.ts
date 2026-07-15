import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace balíčky se konzumují přímo jako TS zdroje.
  transpilePackages: ["@erp/core", "@erp/db", "@erp/ui"],
};

export default nextConfig;
