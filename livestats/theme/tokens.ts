/**
 * The token table, ported from tokens.css.
 *
 * Two layers, exactly as the web build had them:
 *   1. PALETTE — raw values, the only place a hex is written.
 *   2. SEMANTIC — what the UI asks for, aliased onto the palette.
 *
 * There is ONE skin and it is light. The switcher, `auto`, the dark palette and
 * the two frosted ones were built and cut: a scorer picks a theme once and
 * never again, and every branch that existed to serve the choice — the blur in
 * `Surface`, the background wash in `_layout`, the `skin` option — was paying
 * for a decision nobody makes at courtside. The two-layer split survives the
 * cut because it is what keeps the hexes in one place, not because a second
 * skin is coming.
 *
 * This file is the single runtime source of truth. `global.css` carries a copy
 * purely as a fallback for NativeWind classes; the root view pushes the palette
 * back down as CSS variables (see `useTheme`), so a class and a `useTheme()`
 * read can never disagree.
 */

export interface Palette {
  /* ink & surface */
  ink: string;
  ink2: string;
  ink3: string;
  bg: string;
  surface: string;
  surface2: string;
  /**
   * The fill a board control wears while the finger is on it: one step AWAY
   * from `surface`. On a light skin there is no headroom — the surface is
   * already white — so `press` is the canvas, the only direction left with
   * contrast to spend. It carries no hue of its own; a lit cell is a different
   * cell and nothing more.
   */
  press: string;
  rule: string;
  line: string;
  /* accent & state */
  accent: string;
  accent2: string;
  accentInk: string;
  danger: string;
  dangerInk: string;
  /* court */
  court: string;
  courtLine: string;
  /**
   * The live mark: the ring that says WHERE the tap landed. It is the one
   * thing on the floor that is not a result, so it does not borrow `accent`,
   * which two dots away means MADE. Basketball orange — the one hue the
   * palette spends nowhere else.
   */
  mark: string;
  markMiss: string;
  liveFill: string;
}

interface Raw {
  teal600: string;
  teal700: string;
  ink: string;
  ink60: string;
  ink30: string;
  court: string;
  surface: string;
  canvas: string;
  /** the pressed fill; the canvas, because white has nowhere brighter to go */
  press: string;
  rule: string;
  danger: string;
  courtLine: string;
  mark: string;
  onAccent: string;
  liveFill: string;
}

/** Layer 1. The only place in the app a hex is written. */
const RAW: Raw = {
  teal600: '#15788A',
  teal700: '#0F5F6E',
  ink: '#1A2226',
  ink60: '#5C6A70',
  ink30: '#9AA6AC',
  court: '#B9C6CB',
  surface: '#FFFFFF',
  canvas: '#EEF1F2',
  press: '#EEF1F2', // white has nowhere brighter to go
  rule: '#D5DCDF',
  danger: '#B3261E',
  courtLine: '#FFFFFF',
  mark: '#E2611A',
  onAccent: '#FFFFFF',
  liveFill: 'rgba(255,255,255,0.55)',
};

/** Layer 2. What the UI asks for, aliased onto layer 1. */
export const PALETTE: Palette = {
  ink: RAW.ink,
  ink2: RAW.ink60,
  ink3: RAW.ink30,
  bg: RAW.canvas,
  surface: RAW.surface,
  surface2: RAW.canvas,
  press: RAW.press,
  rule: RAW.rule,
  line: RAW.rule,
  accent: RAW.teal600,
  accent2: RAW.teal700,
  accentInk: RAW.onAccent,
  danger: RAW.danger,
  dangerInk: RAW.onAccent,
  court: RAW.court,
  courtLine: RAW.courtLine,
  mark: RAW.mark,
  markMiss: RAW.surface,
  liveFill: RAW.liveFill,
};

/** Every palette key, for pushing into CSS variables. */
export const COLOR_KEYS = [
  'ink',
  'ink2',
  'ink3',
  'bg',
  'surface',
  'surface2',
  'press',
  'rule',
  'line',
  'accent',
  'accent2',
  'accentInk',
  'danger',
  'dangerInk',
  'court',
  'courtLine',
  'mark',
  'markMiss',
  'liveFill',
] as const satisfies readonly (keyof Palette)[];

/* ------------------------------------------------------------------ *
 * Type
 * Custom fonts have no numeric weight axis in React Native, so a weight
 * is a family name. These two helpers are the only place that mapping lives.
 * ------------------------------------------------------------------ */
export type NumWeight = 500 | 600 | 700;
export type UiWeight = 400 | 500 | 600 | 700;

export const fNum = (w: NumWeight = 700): string =>
  w === 500 ? 'ChakraPetch_500Medium' : w === 600 ? 'ChakraPetch_600SemiBold' : 'ChakraPetch_700Bold';

export const fUi = (w: UiWeight = 400): string =>
  w === 400
    ? 'Inter_400Regular'
    : w === 500
      ? 'Inter_500Medium'
      : w === 600
        ? 'Inter_600SemiBold'
        : 'Inter_700Bold';

/** CSS tracking is em-relative; React Native's letterSpacing is absolute. */
export const LS_BTN = 0.04;
export const LS_LABEL = 0.06;
export const ls = (fontSize: number, em: number): number => fontSize * em;

/**
 * `color-mix(in srgb, X n%, transparent)` from the web build, precomputed.
 * The zone heat map is the only caller: opacity is what carries the
 * percentage, so the fill has to be the accent at an arbitrary alpha.
 */
export function withAlpha(color: string, a: number): string {
  const hex = color.trim();
  if (!hex.startsWith('#')) return hex; // already rgba, leave it alone
  const n = hex.length === 4
    ? hex.slice(1).split('').map((c) => c + c).join('')
    : hex.slice(1);
  const int = parseInt(n, 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
}

/** Everywhere a number can change, so a tick does not shift the layout. */
export const TABULAR = { fontVariant: ['tabular-nums'] as const };
