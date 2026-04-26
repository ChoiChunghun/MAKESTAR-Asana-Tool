import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      colors: {
        ms: {
          bg:      "#0b0b0b",
          panel:   "#111111",
          canvas:  "#000000",
          accent:  "#FF558F",
          gold:    "#FFBF00",
          text:    "rgba(255,255,255,0.92)",
          muted:   "rgba(255,255,255,0.65)",
          faint:   "rgba(255,255,255,0.55)",
          border:  "rgba(255,255,255,0.12)",
          subtle:  "rgba(255,255,255,0.08)",
          input:   "rgba(255,255,255,0.04)",
          hover:   "rgba(255,255,255,0.09)"
        }
      },
      borderRadius: {
        card:   "14px",
        btn:    "12px",
        input:  "10px",
        canvas: "10px"
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.12)"
      }
    }
  },
  plugins: []
};

export default config;
