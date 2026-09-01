import type { NextConfig } from "next";

// Server-only — never exposed to the browser. Where the Laravel API lives.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Don't regenerate AGENTS.md/CLAUDE.md on every dev/build run — this repo
  // has its own CLAUDE.md conventions at the project root.
  agentRules: false,
  // Client-side code keeps calling relative "/api/v1/..." paths, exactly like
  // the existing Vite app — Next proxies them to the real Laravel origin
  // server-to-server, so the browser never needs CORS and this app can run on
  // a different domain/subdomain than the API in production without any
  // extra config beyond API_ORIGIN.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  images: {
    // Business/classified photos are user-uploaded to DigitalOcean Spaces —
    // the exact hostname varies per deployment (DO_SPACES_CDN_ENDPOINT), so
    // this allows any https host rather than hard-coding one.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
