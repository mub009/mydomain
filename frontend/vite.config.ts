import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // QR boards encode this origin, so the scan redirect must reach the
      // backend in development too — otherwise /r/q/<code> hits the SPA.
      "/r": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
