import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const hmrHost = process.env.VITE_HMR_HOST;

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
    allowedHosts: [".ngrok-free.app", ".ngrok.app", ".ngrok.io"],
    hmr: hmrHost
      ? { protocol: "wss", host: hmrHost, clientPort: 443 }
      : undefined,
  },
});
