import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles a minimal Node server at .next/standalone/server.js.
  // The Docker image runs that with `node server.js` so the archive route can
  // gate per-request on the current date and return real 404s for unreleased puzzles.
  output: "standalone",
};

export default nextConfig;
