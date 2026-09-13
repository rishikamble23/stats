import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The migrator reads SQL files at runtime; make sure they ship with the server bundle.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
};

export default nextConfig;
