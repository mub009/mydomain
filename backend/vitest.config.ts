import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://mydomain:mydomain@localhost:5432/mydomain_test?schema=public",
      JWT_ACCESS_SECRET: "test-access-secret-not-for-prod",
      JWT_REFRESH_SECRET: "test-refresh-secret-not-for-prod",
    },
  },
});
