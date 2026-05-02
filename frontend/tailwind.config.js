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
          bg: "#05080a",
          panel: "#0a1014",
          border: "#1a2630",
          fg: "#c8f7c8",
          dim: "#6b8a78",
          accent: "#39ff14",
          amber: "#ffb000",
          red: "#ff3a3a",
          yellow: "#ffd166",
          blue: "#58a6ff",
        },
      },
      boxShadow: {
        glow: "0 0 8px rgba(57,255,20,0.5)",
      },
      animation: {
        pulse: "pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 4s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
