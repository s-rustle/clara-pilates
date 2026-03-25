import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import claraPalette from "./lib/design/claraPalette.json";

/** Cycladic Mediterranean — grove green primary, lemon accent (hours bar + exam only), stark geometry */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: { ...claraPalette },
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
