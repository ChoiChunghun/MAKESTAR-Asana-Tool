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
          bg:           "#fcfdfd",  // gray-10   (light bg)
          panel:        "#f2f4f6",  // gray-50   (card/panel)
          canvas:       "#ffffff",  // pure white
          accent:       "#ff4d89",  // pink-400  (brand1)
          "accent-hover": "#e5195e", // pink-500
          gold:         "#c08000",  // darker gold for light bg
          text:         "#111417",  // gray-990  (fg-primary)
          muted:        "#4c5a66",  // gray-600  (fg-secondary)
          faint:        "#6d7f92",  // gray-500  (fg-tertiary)
          border:       "#d4d9de",  // gray-200  (border-default)
          subtle:       "#e8ebed",  // gray-100  (hover / subtle bg)
          input:        "#ffffff",  // white input bg
          hover:        "#e8ebed"   // hover state
        }
      },
      borderRadius: {
        card:   "14px",
        btn:    "12px",
        input:  "10px",
        canvas: "10px"
      },
      borderColor: {
        DEFAULT: "#d4d9de"
      }
    }
  },
  plugins: []
};

export default config;
