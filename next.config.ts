import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["libpg-query", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
