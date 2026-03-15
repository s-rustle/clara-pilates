import type { Config } from "tailwindcss";

const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          bg: "#F8F9F7",
          surface: "#F0F5F3",
          highlight: "#C5E4DF",
          accent: "#0D9488",
          primary: "#0F766E",
          strong: "#115E59",
          deep: "#1E4644",
        },
      },
    },
  },
  plugins: [],
};

export default config;
