import type { NextConfig } from "next";

// In production Caddy routes /api/* to the backend before requests reach Next.js.
// In development this rewrite does the same, so the session cookie stays on one origin.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Signed-in pages render in the browser once /api/auth/me answers, so there is no server-rendered
    // page content for Next.js to check for instant navigation. Only check segments that opt in.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
};

export default nextConfig;
