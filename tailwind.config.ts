import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/** Warm greige / cream — darker canvas, no stark white */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#D6D0C5",
          sidebar: "#C9C2B5",
          surface: "#F0EBE3",
          elevated: "#F5F2EB",
          muted: "#6B6560",
          ink: "#2A2622",
          deep: "#4A4540",
          strong: "#2A2622",
          border: "#A8A095",
          highlight: "#C4BCAE",
          primary: "#3A342C",
          accent: "#4E4740",
          warm: "#7D6B5C",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card:
          "0 1px 2px rgba(42, 38, 34, 0.06), 0 6px 20px rgba(42, 38, 34, 0.07)",
        login:
          "0 2px 8px rgba(42, 38, 34, 0.08), 0 16px 48px rgba(42, 38, 34, 0.1)",
      },
    },
  },
  plugins: [typography],
};

export default config;
