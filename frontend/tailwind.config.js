/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        '45': '11.25rem', // 180px
      },
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
          bg: "#030a0f",
          panel: "#071318",
          panel2: "#0a1a22",
          border: "#1a3a4a",
          fg: "#d0f0ff",
          dim: "#4a7a8a",
          accent: "#00d9ff",
          hot: "#ff6b35",
          amber: "#ffa500",
          yellow: "#ffd700",
          green: "#00ff88",
          blue: "#58a6ff",
          gray: "#5a6a7a",
        },
      },
      boxShadow: {
        glow: "0 0 10px rgba(0,217,255,0.6)",
        glowSoft: "0 0 18px rgba(0,217,255,0.25)",
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
