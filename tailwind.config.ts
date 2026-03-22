import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/** Terracotta & sage — warm cream surfaces (palette from earlier moodboard pass) */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#F4EDE3",
          surface: "#E9E2D6",
          highlight: "#C5D1B8",
          accent: "#D4A84B",
          primary: "#C4512E",
          strong: "#152A22",
          deep: "#2A3D34",
          muted: "#5F6B62",
          rock: "#5C2718",
          forest: "#2F4D3C",
          alert: "#A6453B",
          sky: "#5B9AAA",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-lora)", "Georgia", "serif"],
      },
      boxShadow: {
        "clara-soft":
          "0 2px 14px rgba(21, 42, 34, 0.06), 0 1px 2px rgba(21, 42, 34, 0.04)",
        "clara-lift":
          "0 6px 24px rgba(21, 42, 34, 0.08), 0 2px 6px rgba(21, 42, 34, 0.05)",
      },
    },
  },
  plugins: [typography],
};

export default config;
