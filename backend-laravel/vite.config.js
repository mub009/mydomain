import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import { globSync } from "node:fs";

export default defineConfig({
  plugins: [
    laravel({
      // Shared CSS/JS for every page, plus one module per page that needs
      // behaviour (resources/js/pages/*.js, loaded with @vite in its view).
      input: [...globSync("resources/css/*.css"), "resources/js/app.js", ...globSync("resources/js/pages/*.js")],
      refresh: true,
    }),
  ],
});
