import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "undici"],
  output: "standalone",
};

export default nextConfig;
