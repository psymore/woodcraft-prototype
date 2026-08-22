import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Telefonunuzdan veya başka bir cihazdan erişim sağlar
    port: 5173, // Portu sabitler
    strictPort: true, // Port doluysa hata verir, rastgele başka porta geçmez
  },
});
