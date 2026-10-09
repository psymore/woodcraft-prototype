import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at the GitHub Pages project path
  // (/woodcraft-prototype/) and at a local root — the app has no router, so
  // nothing needs an absolute base. Public assets (textures) are referenced
  // with relative paths for the same reason (see engine/core/species.ts).
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5180,
    strictPort: true,
  },
});
