import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static HTML export — `npm run build` writes to ./out and you can serve
  // those files from any static host (nginx, Caddy, S3, a media server, etc).
  // Remove this line if you'd rather use `next start` for SSR.
  output: "export",
};

export default nextConfig;
