import { createContext, useContext } from 'react';
import { vars } from 'nativewind';

import { COLOR_KEYS, PALETTE, type Palette } from './tokens';

/** `--color-accent-ink` from `accentInk`; the one place the two spellings meet. */
const cssName = (key: string) => '--color-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/**
 * THE SEAM, AND IT IS FINALLY IN USE.
 *
 * `useTheme()` was a constant wearing a hook's name for as long as there was
 * exactly one skin, and the note here said it was kept as "the seam a second
 * skin would come back through if one ever had to". This is that, and it is
 * deliberately NOT the switcher that was cut: nothing reads a preference,
 * nothing persists, and there is no `auto`. A SUBTREE declares the palette it
 * is drawn in, and exactly one does — the TAB GROUP, in `DARK`.
 *
 * It is the group and not a screen. The lobby declared it alone first and the
 * other three rooms inherited the light palette off the root, which is how the
 * app came to wear two skins in the space of one tap; the four rooms are one
 * place, so they say it once, in `app/(tabs)/_layout.tsx`. The board is not in
 * that group and is still light, and so is every page you go INTO and come back
 * out of — `start`, a saved game, a competition, a player.
 *
 * Doing it here rather than in those screens' own components is what keeps it
 * honest: `Card`, `Btn`, `Band`, `Crest`, `BoxTable` and `ClubCard` all call
 * `useTheme()` internally, so they follow the surface they are placed on
 * without a `dark` prop threaded through every one of them — and without a
 * second copy of each. `ClubCard` is the case that proves it: the same card on
 * the dark TEAM tab and on the light new-game picker.
 *
 * The default is the light palette, so every screen that does not ask for
 * anything is exactly what it was.
 */
const ThemeCtx = createContext<Palette>(PALETTE);

export const ThemeProvider = ThemeCtx.Provider;

export function useTheme(): Palette {
  return useContext(ThemeCtx);
}

/**
 * The same values as CSS variables for the root view. Pushing them down means
 * a NativeWind class and a `useTheme()` read always agree.
 *
 * Note this is the ROOT's job and the dark subtree does not do it: the four
 * rooms and the panels over them are drawn entirely in inline styles, so there
 * is no class in there that could disagree with anything. This is not a
 * hypothetical — `components/panels/shell.tsx` carried `className="text-ink"`
 * on its header and its notes, which resolved through the variables below (the
 * LIGHT palette's) and drew near-black ink on the lobby's near-black sheet.
 * They are inline now. A `className` added anywhere under the tab group is the
 * next thing that would break this, and the fix would be to push
 * `themeVars(DARK)` onto the same view that provides the palette.
 */
export function themeVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of COLOR_KEYS) out[cssName(k)] = p[k] as string;
  return vars(out) as unknown as Record<string, string>;
}
