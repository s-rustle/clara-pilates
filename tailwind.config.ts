import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/** Mediterranean-adjacent: warm plaster neutrals, olive primary, terracotta accent, sea for links */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#F5F1E8",
          surface: "#FDFBF7",
          tint: "#EFE8DC",
          border: "#E0D8CC",
          deep: "#2C2824",
          muted: "#7A756E",
          primary: {
            DEFAULT: "#5F6F52",
            dark: "#4D5C42",
          },
          accent: {
            DEFAULT: "#C2782E",
            soft: "#F3EBE0",
            foreground: "#8B5220",
          },
          sea: {
            DEFAULT: "#2C5F63",
            muted: "#3D7377",
          },
          leaf: "#5F6F52",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: [
          "var(--font-fraunces)",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      borderRadius: {
        clara: "0.375rem",
      },
      boxShadow: {
        "clara-soft":
          "0 2px 14px rgba(44, 40, 36, 0.06), 0 1px 2px rgba(44, 40, 36, 0.04)",
        "clara-lift":
          "0 6px 24px rgba(44, 40, 36, 0.08), 0 2px 6px rgba(44, 40, 36, 0.05)",
      },
    },
  },
  plugins: [typography],
};

export default config;
