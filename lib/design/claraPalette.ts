import raw from "./claraPalette.json";

/**
 * Single source of truth for Clara UI colors (data: `claraPalette.json`).
 * Consumed by `tailwind.config.ts` — keep `app/globals.css` `:root` / `h1` in sync (bg + deep).
 */
export const claraPalette = raw;

export type ClaraPaletteKey = keyof typeof raw;
