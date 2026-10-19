import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = Number(process.env.PR_BOARD_PORT ?? 4848);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: Number(process.env.PORT ?? 5180),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${SERVER_PORT}` },
    // The Appearance menu saves to this file; reloading the page on every edit would fight the live preview.
    watch: { ignored: ["**/shared/cast.json"] },
  },
});
