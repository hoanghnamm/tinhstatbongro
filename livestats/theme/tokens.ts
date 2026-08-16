/**
 * The token table, ported from tokens.css.
 *
 * Two layers, exactly as the web build had them:
 *   1. PALETTE — raw values, the only place a hex is written.
 *   2. SEMANTIC — what the UI asks for, aliased onto the palette, so a skin
 *      only has to swap layer 1.
 *
 * This file is the single runtime source of truth. `global.css` carries a
 * light-mode copy purely as a fallback for NativeWind classes; the root view
 * pushes the resolved palette back down as CSS variables (see `useTheme`), so
 * a class and a `useTheme()` read can never disagree.
 */

export type SkinName = 'light' | 'dark' | 'glass' | 'glassDark';

/** A two-stop gradient. The clock is tinted, not saturated — the time sits on it. */
export type Grad = readonly [string, string];

export interface Palette {
  /* ink & surface */
  ink: string;
  ink2: string;
  ink3: string;
  bg: string;
  surface: string;
  surface2: string;
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
  lane: string;
  courtLine: string;
  markMiss: string;
  liveFill: string;
  /* clock */
  clockInk: string;
  clockRun: Grad;
  clockStop: Grad;
  /* skin behaviour */
  /** drives the status bar and the blur tint; not a colour */
  dark: boolean;
  glass: boolean;
  /** frosted skins paint a wash behind the blur; a flat fill has nothing to show */
  bgWash: Grad | null;
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
  rule: string;
  danger: string;
  courtLine: string;
  onAccent: string;
  liveFill: string;
  run: Grad;
  stop: Grad;
  dark?: boolean;
  glass?: boolean;
  bgWash?: Grad;
}

/** Layer 2. A skin is a palette swap and nothing more. */
const semantic = (r: Raw): Palette => ({
  ink: r.ink,
  ink2: r.ink60,
  ink3: r.ink30,
  bg: r.canvas,
  surface: r.surface,
  surface2: r.canvas,
  rule: r.rule,
  line: r.rule,
  accent: r.teal600,
  accent2: r.teal700,
  accentInk: r.onAccent,
  danger: r.danger,
  dangerInk: r.onAccent,
  court: r.court,
  lane: r.ink30,
  courtLine: r.courtLine,
  markMiss: r.surface,
  liveFill: r.liveFill,
  clockInk: r.ink,
  clockRun: r.run,
  clockStop: r.stop,
  dark: r.dark ?? false,
  glass: r.glass ?? false,
  bgWash: r.bgWash ?? null,
});

const RAW: Record<SkinName, Raw> = {
  light: {
    teal600: '#15788A',
    teal700: '#0F5F6E',
    ink: '#1A2226',
    ink60: '#5C6A70',
    ink30: '#9AA6AC',
    court: '#B9C6CB',
    surface: '#FFFFFF',
    canvas: '#EEF1F2',
    rule: '#D5DCDF',
    danger: '#B3261E',
    courtLine: '#FFFFFF',
    onAccent: '#FFFFFF',
    liveFill: 'rgba(255,255,255,0.55)',
    run: ['#D7F0DC', '#A8DCB4'],
    stop: ['#FBD9D5', '#F2B2AA'],
  },
  dark: {
    teal600: '#3FC6E4',
    teal700: '#2AA9C6',
    ink: '#EFF1F4',
    ink60: '#A8AEB8',
    ink30: '#78818C',
    court: '#2C3238',
    surface: '#181B20',
    canvas: '#0E1013',
    rule: '#2B3038',
    danger: '#E4576A',
    courtLine: '#FFFFFF',
    onAccent: '#0E1013',
    liveFill: 'rgba(24,27,32,0.55)',
    run: ['#1D4A2B', '#123420'],
    stop: ['#4A1F1C', '#331211'],
    dark: true,
  },
  glass: {
    teal600: '#4A5FE0',
    teal700: '#3547BE',
    ink: '#151A2E',
    ink60: '#5A6480',
    ink30: '#98A0BC',
    court: '#A9B4DC',
    surface: '#FFFFFF',
    canvas: '#E9ECFA',
    rule: '#CED6F0',
    danger: '#D2394C',
    courtLine: '#FFFFFF',
    onAccent: '#FFFFFF',
    liveFill: 'rgba(255,255,255,0.55)',
    run: ['#D5F2E0', '#A7E0BE'],
    stop: ['#FBD9DE', '#F2AEB8'],
    glass: true,
    // the web build used a three-stop radial; a linear pass reads the same
    // behind 16px of blur and costs no extra dependency
    bgWash: ['#DEE4FF', '#F7EDFB'],
  },
  glassDark: {
    teal600: '#5BD7F0',
    teal700: '#38B2CC',
    ink: '#EAEDF7',
    ink60: '#A2AAC4',
    ink30: '#6F7793',
    court: '#252C46',
    surface: '#1A2038',
    canvas: '#0C1020',
    rule: '#333B58',
    danger: '#FF6B7E',
    courtLine: '#FFFFFF',
    onAccent: '#0B1020',
    liveFill: 'rgba(26,32,56,0.55)',
    run: ['#1B4A38', '#0F3126'],
    stop: ['#4A1D2A', '#301017'],
    dark: true,
    glass: true,
    bgWash: ['#1D2653', '#241340'],
  },
};

export const PALETTES: Record<SkinName, Palette> = {
  light: semantic(RAW.light),
  dark: semantic(RAW.dark),
  glass: semantic(RAW.glass),
  glassDark: semantic(RAW.glassDark),
};

/** Every palette key that is a plain colour, for pushing into CSS variables. */
export const COLOR_KEYS = [
  'ink',
  'ink2',
  'ink3',
  'bg',
  'surface',
  'surface2',
  'rule',
  'line',
  'accent',
  'accent2',
  'accentInk',
  'danger',
  'dangerInk',
  'court',
  'lane',
  'courtLine',
  'markMiss',
  'liveFill',
  'clockInk',
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
 * Only the glass skins need it, and only for the frosted fill.
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
