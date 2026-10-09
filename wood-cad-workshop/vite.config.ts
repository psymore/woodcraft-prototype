import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at the GitHub Pages project path
  // (/woodcraft-prototype/) and at a local root — the app has no router, so
  // nothing needs an absolute base. Public assets (textures) are referenced
  // with relative paths for the same reason (see engine/core/species.ts).
  base: "./",
  build: {
    // three.js alone minifies to ~730kB and can't be split further, so the
    // default 500kB warning would fire on every build.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Vendor code changes far less often than app code — splitting it
        // out lets returning visitors keep three.js etc. cached across
        // deploys instead of re-downloading one ~1.2MB bundle every time.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/three\//.test(id)) return "three";
          if (/node_modules\/(@react-three|three-stdlib|camera-controls|troika|maath|meshline|stats)/.test(id)) return "r3f";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5180,
    strictPort: true,
  },
});
