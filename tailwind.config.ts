import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/** Cycladic Mediterranean — grove green primary, lemon accent (hours bar + exam only), stark geometry */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#FFFFFF",
          surface: "#FAFAF8",
          tint: "#F0F5EC",
          border: "#E8E8E0",
          primary: "#3D5A2A",
          "primary-hover": "#324A22",
          accent: "#D4B800",
          deep: "#1A1A14",
          muted: "#AAAAAA",
          danger: "#B84820",
          "danger-bg": "#FFF0E8",
          exam: "#FFFBE8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        /** Display / page titles — Cormorant Garamond */
        display: [
          "var(--font-cormorant)",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        cormorant: [
          "var(--font-cormorant)",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
    },
  },
  plugins: [typography],
};

export default config;
