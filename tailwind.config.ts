import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/** Red Rocks — earthy brutalist palette (Constitution §6.1) */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#E8E0D5",
          surface: "#DDD5C8",
          highlight: "#C9BFB0",
          accent: "#C4522A",
          primary: "#5C4A32",
          strong: "#3D3128",
          deep: "#1C1610",
          muted: "#8A7F74",
          rock: "#A63D1F",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [typography],
};

export default config;
