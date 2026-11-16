import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// The proxy lets the browser reach Yahoo Finance and the Claude API without
// CORS errors. The Anthropic key is read from .env on the server side and
// added here, so it is never sent to (or stored in) the browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy: Record<string, ProxyOptions> = {
    "/yahoo": {
      target: "https://query1.finance.yahoo.com",
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/yahoo/, ""),
      headers: { "User-Agent": "Mozilla/5.0" },
    },
    "/claude": {
      target: "https://api.anthropic.com",
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/claude/, ""),
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
    },
  };
  return {
    plugins: [react()],
    define: {
      __AI_ENABLED__: JSON.stringify(Boolean(env.ANTHROPIC_API_KEY)),
      __AI_MODEL__: JSON.stringify(env.STOCK_AGENT_MODEL || "claude-opus-5-5"),
    },
    server: { proxy },
    preview: { proxy },
  };
});
