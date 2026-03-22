import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Clara palette — warm Roman whitewash, terracotta, burnt sienna / orange-red earth.
 * Documented in Constitution §6.1 and Planning §10.
 */
const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        clara: {
          /** Limewash / roman whitewash canvas */
          bg: "#F4EDE6",
          /** Sidebar — deeper warm stone / mud */
          sidebar: "#D4C4B8",
          /** Cards and panels — soft earthen cream */
          surface: "#EBE3D9",
          /** Inputs, raised fields */
          elevated: "#F7F1EA",
          /** Secondary labels, de-emphasized copy */
          muted: "#8A7268",
          /** UI chrome, emphasis text */
          ink: "#3D2E28",
          /** Body text — burnt umber brown */
          deep: "#4A352C",
          /** Headings — deep terracotta / sienna */
          strong: "#5C2E24",
          /** Borders — dusty clay */
          border: "#C9B3A4",
          /** Hovers, selected rows — rose-tan */
          highlight: "#E5D5CA",
          /** Primary actions, progress fill — terracotta */
          primary: "#B8482E",
          /** Hover on primary, links — brighter burnt orange */
          accent: "#C45F3D",
          /** Focus rings — earth red */
          warm: "#A65D45",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:
          "0 1px 2px rgba(60, 40, 32, 0.06), 0 6px 20px rgba(60, 40, 32, 0.07)",
        login:
          "0 2px 8px rgba(60, 40, 32, 0.08), 0 16px 48px rgba(60, 40, 32, 0.1)",
      },
    },
  },
  plugins: [typography],
};

export default config;
