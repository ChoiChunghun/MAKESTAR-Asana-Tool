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
        sans: ["Pretendard JP Variable", "Pretendard", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      colors: {
        ms: {
          bg:           "#111417",  // gray-990
          panel:        "#1f242a",  // gray-900
          canvas:       "#0c0f12",  // near-black
          accent:       "#ff4d89",  // pink-400  (brand1)
          "accent-hover": "#e5195e", // pink-500
          gold:         "#FFBF00",
          text:         "#fcfdfd",  // gray-10   (fg-primary)
          muted:        "#6d7f92",  // gray-500  (fg-secondary)
          faint:        "#4c5a66",  // gray-600  (fg-tertiary)
          border:       "#2d353d",  // gray-800  (border-default)
          subtle:       "#252c34",  // gray-850  (border-subtle / hover)
          input:        "#181d22",  // slightly darker panel
          hover:        "#252c34"   // hover state
        }
      },
      borderRadius: {
        card:   "14px",
        btn:    "12px",
        input:  "10px",
        canvas: "10px"
      },
      borderColor: {
        DEFAULT: "#2d353d"
      }
    }
  },
  plugins: []
};

export default config;
