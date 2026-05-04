import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles a minimal Node server at .next/standalone/server.js.
  // The Docker image runs that with `node server.js` so the archive route can
  // gate per-request on the current date and return real 404s for unreleased puzzles.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Block MIME-sniffing attacks against any oddly-typed asset.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No reason to ever embed this site in an iframe — disallow it.
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak full URLs to cross-origin destinations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable powerful features the app doesn't use.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Pin HTTPS for two years; Cloudflare also serves HTTPS in front.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
