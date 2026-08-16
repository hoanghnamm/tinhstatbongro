import { useColorScheme } from 'react-native';
import { vars } from 'nativewind';

import { useGameStore } from '../store/gameStore';
import { COLOR_KEYS, PALETTES, type Palette, type SkinName } from './tokens';
import type { Options } from '../constants/options';

/** `--color-accent-ink` from `accentInk`; the one place the two spellings meet. */
const cssName = (key: string) => '--color-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

export function resolvePalette(skin: Options['skin'], scheme: string | null | undefined): Palette {
  const name: SkinName = skin === 'auto' ? (scheme === 'dark' ? 'dark' : 'light') : skin;
  return PALETTES[name];
}

/**
 * The resolved palette, and the same values as CSS variables for the root view.
 * Pushing them down means a NativeWind class and a `useTheme()` read always
 * agree, even on a skin `global.css` never heard of.
 */
export function useTheme(): Palette {
  const skin = useGameStore((s) => s.options.skin);
  return resolvePalette(skin, useColorScheme());
}

export function themeVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of COLOR_KEYS) out[cssName(k)] = p[k] as string;
  return vars(out) as unknown as Record<string, string>;
}
