import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["95fb-4-78-254-114.ngrok-free.app", ".ngrok-free.app"],
    hmr: {
      protocol: "wss",
      host: "95fb-4-78-254-114.ngrok-free.app",
      clientPort: 443,
    },
  },
});
