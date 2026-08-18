import { vars } from 'nativewind';

import { COLOR_KEYS, PALETTE, type Palette } from './tokens';

/** `--color-accent-ink` from `accentInk`; the one place the two spellings meet. */
const cssName = (key: string) => '--color-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/**
 * The palette. There is one, so this is a constant wearing a hook's name —
 * kept as a hook because every component in the app calls it that way, and
 * because it is the seam a second skin would come back through if one ever
 * had to. It reads no state and never causes a render.
 */
export function useTheme(): Palette {
  return PALETTE;
}

/**
 * The same values as CSS variables for the root view. Pushing them down means
 * a NativeWind class and a `useTheme()` read always agree.
 */
export function themeVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of COLOR_KEYS) out[cssName(k)] = p[k] as string;
  return vars(out) as unknown as Record<string, string>;
}
