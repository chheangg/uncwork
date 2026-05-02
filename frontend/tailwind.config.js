/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "IBM Plex Mono",
          "Menlo",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        terminal: {
          bg: "#0a0203",
          panel: "#160708",
          panel2: "#1f0a0c",
          border: "#3a1216",
          fg: "#ffd0d0",
          dim: "#8a4a4f",
          accent: "#ff3a3a",
          hot: "#ff1414",
          amber: "#ff8c42",
          yellow: "#ffd166",
          green: "#4ade80",
          blue: "#58a6ff",
          gray: "#5a4347",
        },
      },
      boxShadow: {
        glow: "0 0 10px rgba(255,58,58,0.6)",
        glowSoft: "0 0 18px rgba(255,58,58,0.25)",
      },
      animation: {
        pulse: "pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 4s linear infinite",
        blink: "blink 1.2s steps(2, end) infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        blink: {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0.2" },
        },
      },
    },
  },
  plugins: [],
};
