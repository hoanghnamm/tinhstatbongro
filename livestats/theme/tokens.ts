/**
 * The token table, ported from tokens.css.
 *
 * Two layers, exactly as the web build had them:
 *   1. PALETTE — raw values, the only place a hex is written.
 *   2. SEMANTIC — what the UI asks for, aliased onto the palette.
 *
 * THE SKIN IS LIGHT AND THERE IS STILL NO SWITCHER. `auto`, the two frosted
 * skins and the `skin` option were built and cut, and none of them is back: a
 * scorer picks a theme once and never again, and every branch that existed to
 * serve that choice was paying for a decision nobody makes at courtside.
 *
 * `DARK` below is NOT that switcher coming back. It is the FOUR TABS declaring
 * the palette they are drawn in, through the context in `useTheme.ts` — one
 * declaration, in `app/(tabs)/_layout.tsx`, covering the whole group. Nothing
 * reads a preference, nothing persists, and no user-facing control chooses
 * between them. The two-layer split is what keeps the hexes in one place, and
 * it is also what lets a second surface exist without a second copy of every
 * component.
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
  /**
   * NOW, IN PROGRESS — and it is the retired accent, not a new hue.
   *
   * The board is orange, which puts `accent` about twenty degrees from
   * `danger` on the wheel. That is survivable almost everywhere and is NOT
   * survivable on the footer's clock, which is a single cell that means one
   * thing when it is running and the opposite when it is stopped, read at a
   * glance from the bench. So the teal the palette used to spend on `accent`
   * moves here rather than leaving: running clock, the lobby's LIVE dot, and
   * the court's tap mark, which all say the same word.
   */
  live: string;
  /* court */
  court: string;
  courtLine: string;
  /**
   * The live mark: the ring that says WHERE the tap landed. It is the one
   * thing on the floor that is not a result, so it must not borrow `accent`,
   * which two dots away means MADE.
   *
   * It used to be basketball orange, on the grounds that it was the one hue
   * the palette spent nowhere else. `accent` IS that orange now, so the mark
   * would have collided with the made-shot dot it exists to be distinct from.
   * It is `live` — the same teal, because a tap not yet resolved into a make
   * or a miss is the same "in progress" the running clock means.
   */
  mark: string;
  markMiss: string;
  liveFill: string;
}

interface Raw {
  orange: string;
  orange2: string;
  teal: string;
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
  onAccent: string;
  liveFill: string;
  /** what a shadow is made of — see ELEV */
  shadow: string;
}

/**
 * Layer 1. The only place in the app a hex is written.
 *
 * The greys are WARM and they are warm on purpose: a cool blue-grey ramp under
 * a saturated orange reads as two palettes sharing a screen. The court is the
 * one surface left slightly cool, because it is the backdrop the orange marks
 * are read against and it is the only place the contrast is worth the seam.
 */
const RAW: Raw = {
  orange: '#F26414',
  orange2: '#D2500A', // pressed: darker, never lighter — down is down
  teal: '#0E8FA3',
  ink: '#050505',
  ink60: '#6B6560',
  ink30: '#A8A29B',
  court: '#BFC5C8',
  surface: '#FFFFFF',
  canvas: '#F4F2F0',
  press: '#F4F2F0', // white has nowhere brighter to go
  rule: '#E3DFDB',
  danger: '#B3261E',
  courtLine: '#FFFFFF',
  onAccent: '#FFFFFF',
  liveFill: 'rgba(255,255,255,0.55)',
  shadow: '#050505',
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
  accent: RAW.orange,
  accent2: RAW.orange2,
  accentInk: RAW.onAccent,
  danger: RAW.danger,
  dangerInk: RAW.onAccent,
  live: RAW.teal,
  court: RAW.court,
  courtLine: RAW.courtLine,
  mark: RAW.teal,
  markMiss: RAW.surface,
  liveFill: RAW.liveFill,
};

/**
 * THE DARK PALETTE, AND IT IS THE TAB GROUP'S ALONE.
 *
 * This is not the second skin that was cut — nobody chooses it, there is no
 * switcher and no `auto`. It is the four ROOMS rendered dark, the way a
 * magazine runs one section on black: they are where you stand BEFORE and
 * AFTER a game, and none of them is read at arm's length under gym lighting
 * while something is happening. It started as the lobby's alone and the other
 * three followed it, because a lobby on black beside a shelf on white was one
 * app wearing two skins in the space of one tap.
 *
 * THE BOARD IS STILL LIGHT AND THAT IS THE POINT — it is the one screen read
 * at arm's length mid-possession, and walking onto it should feel like the
 * lights coming up. `start`, the saved game's page and the season's own pages
 * sit outside the group and stay light with it.
 *
 * The greys are WARM and near-black rather than neutral, so the orange sits in
 * them rather than on them. Two tokens are deliberately NOT the light values:
 * `danger` lifts, because `#B3261E` on near-black is a smear rather than a red,
 * and `live` lifts for the same reason. Both are still the same two hues doing
 * the same two jobs; they are simply the versions of them that survive here.
 */
export const DARK: Palette = {
  ink: '#F7F4F2',
  ink2: '#A39A93',
  ink3: '#6E655F',
  bg: '#050505',
  // THE SURFACES ARE TRANSLUCENT, AND THAT IS WHAT MAKES THE GLASS WORK.
  // A `Card` on this screen is a `BlurView`, and an opaque child inside one
  // covers the blur completely — so a `Stat`, a `Band` and a `Seam` painted in
  // solid dark would have left the frosting visible only in the padding.
  // Putting the alpha in the PALETTE rather than in a `glass` prop on each of
  // them is what keeps the shared components shared: they go on asking for
  // `surface` and `rule` exactly as they do on the light screens, and the
  // answer here happens to let light through. It is safe because every
  // consumer draws on the near-black `bg` above, with the bloom the only thing
  // between — do not reuse this palette on a screen with a light ground under
  // it, where a 5% white surface is a surface nobody can see.
  surface: 'rgba(255,255,255,0.05)',
  surface2: 'rgba(255,255,255,0.09)',
  press: 'rgba(255,255,255,0.14)',
  rule: 'rgba(255,255,255,0.12)',
  line: 'rgba(255,255,255,0.16)',
  accent: RAW.orange,
  accent2: RAW.orange2,
  accentInk: RAW.onAccent,
  danger: '#E5484D',
  dangerInk: RAW.onAccent,
  live: '#2AB8CE',
  court: '#2A211B',
  courtLine: '#6E655F',
  mark: '#2AB8CE',
  markMiss: '#6E655F',
  liveFill: 'rgba(0,0,0,0.35)',
};

/**
 * DOES THIS PALETTE LET WHAT IS BEHIND A SURFACE THROUGH?
 *
 * One question, asked in one place, and it is asked of the palette rather than
 * threaded down as a prop — which is the same argument that put the alpha in
 * `DARK` instead of in a `glass` prop on every component. Its readers are the
 * two views that paint a GROUND behind something they do not own: `Card`'s
 * shadow wrapper and anything else that would otherwise composite a translucent
 * surface over a copy of itself.
 *
 * It reads the surface rather than carrying a flag beside it, because a flag is
 * a second fact that can disagree with the first one.
 */
export const isTranslucent = (p: Palette): boolean => p.surface.startsWith('rgba');

/* ------------------------------------------------------------------ *
 * The chart's three dots
 *
 * A made shot, a miss and the free-throw spot are the only three marks the
 * floor ever carries, and they are the one part of the palette a SCORER may
 * move. That is not the skin switcher coming back: nothing else on any screen
 * changes with it, the three are read on a court and nowhere else, and the
 * reason they are settable at all is that a scorer who cannot separate orange
 * from grey cannot read a chart whose two commonest marks are orange and grey.
 *
 * FOUR OF THE EIGHT ARE PALETTE TOKENS, not new hexes — orange IS `accent`,
 * red IS `danger`, teal IS `live`, and NEUTRAL is `markMiss`, which is the one
 * that differs between the light board and the dark player page. Resolving
 * them through the palette rather than freezing a hex is what keeps a dot
 * legible on both floors. The other four are raw, and this is still the only
 * file in the app where a hex is written.
 *
 * The defaults reproduce exactly what the chart drew before it was settable:
 * orange, neutral, red.
 * ------------------------------------------------------------------ */
export type DotHue =
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'neutral';

/** The swatch row, warm to cool with the neutral last. */
export const DOT_HUES: readonly DotHue[] = [
  'orange',
  'red',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'neutral',
];

/** The four that are not already in the palette. Mid-tone on purpose: each has
 *  to read on the board's cool floor AND on the dark player page's warm one. */
const DOT_RAW = {
  yellow: '#E0A200',
  green: '#2E9E4F',
  blue: '#2563C9',
  purple: '#7B4BC9',
} as const;

export const dotColor = (hue: DotHue, p: Palette): string => {
  switch (hue) {
    case 'orange':
      return p.accent;
    case 'red':
      return p.danger;
    case 'teal':
      return p.live;
    // the palette-dependent one, and the reason a hex here would be wrong:
    // white on the board's cool floor, warm grey on the dark player page
    case 'neutral':
      return p.markMiss;
    default:
      return DOT_RAW[hue];
  }
};

export const DOT_LABEL: Record<DotHue, string> = {
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  neutral: 'Neutral',
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
  'live',
  'court',
  'courtLine',
  'mark',
  'markMiss',
  'liveFill',
] as const satisfies readonly (keyof Palette)[];

/* ------------------------------------------------------------------ *
 * Elevation
 *
 * THREE STEPS, AND THE BOARD IS ON NONE OF THEM. Cards and panels float;
 * the court, the rail, the footer and every tile grid stay flat, because the
 * 1px seam that divides a tile grid IS the grid — a tile that lifts casts onto
 * its neighbour and eats the seam it is defined by.
 *
 * Both platforms are written out. `elevation` is Android's whole shadow model
 * and it takes no colour or offset; the four `shadow*` keys are iOS's and do
 * nothing there. A step that set only one of the two would be flat on the
 * other platform, which is how a depth pass half-lands.
 *
 * Two traps worth stating, because both fail silently:
 *   - iOS CLIPS a shadow to `overflow:'hidden'`. A rounded card that clips its
 *     children needs the radius and the shadow on an outer view and the clip
 *     on an inner one.
 *   - Android needs an opaque `backgroundColor` on the same view or it draws
 *     nothing at all.
 * ------------------------------------------------------------------ */
export interface Elev {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** resting: a card sitting on the canvas. */
export const ELEV_CARD: Elev = {
  shadowColor: RAW.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
};

/** raised: the one card on a screen that is the reason you opened it. */
export const ELEV_LIFT: Elev = {
  shadowColor: RAW.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.13,
  shadowRadius: 18,
  elevation: 8,
};

/** over everything: a panel, which is the only thing that leaves the page. */
export const ELEV_PANEL: Elev = {
  shadowColor: RAW.shadow,
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.2,
  shadowRadius: 32,
  elevation: 20,
};

/* ------------------------------------------------------------------ *
 * Type
 *
 * THE FACE IS THE SYSTEM'S — SAN FRANCISCO ON iOS, INTER ON ANDROID — and
 * these three helpers are the only place that mapping lives. Each returns a
 * STYLE FRAGMENT to be spread, not a family string, because the system font
 * needs a `fontWeight` beside its family where a bundled one does not.
 *
 * THIS FILE MAY NOT IMPORT `react-native`, which is why the platform is read
 * off `process.env.EXPO_OS` rather than off `Platform.OS`. `lib/pdf.ts` imports
 * `PALETTE` from here, and `npm run check` runs that under plain node, where a
 * `react-native` import throws on the first line of Flow syntax it meets.
 * `babel-preset-expo` inlines the constant at build time, so it costs nothing
 * at runtime and is simply `undefined` under node — which lands on Inter, the
 * branch the node script does not read anyway.
 * ------------------------------------------------------------------ */
const APPLE = process.env.EXPO_OS === 'ios';

export type NumWeight = 500 | 600 | 700;
export type UiWeight = 400 | 500 | 600 | 700;

/**
 * A FACE IS A STYLE FRAGMENT NOW, NOT A FAMILY STRING, and that is what
 * spreading it at every call site is for: `...fUi(500)` rather than
 * `fontFamily: fUi(500)`.
 *
 * The reason is San Francisco. iOS does not expose the system face by
 * PostScript name — there is no `SFProText-Medium` to ask for — so the only
 * honest way to get it is `fontFamily: 'System'` with a real `fontWeight`
 * beside it, which is two keys where the old convention had one. Every other
 * face in this app was a family per weight because a bundled font has to be;
 * the system font is the one that is not, and pretending otherwise would mean
 * one weight for the whole app.
 *
 * IT IS SPLIT BY PLATFORM exactly as the tab bar is. SF is Apple's and exists
 * nowhere else, so ANDROID KEEPS INTER — already a dependency, already the
 * closest neo-grotesque to it — and gets its weight the way a bundled face
 * always has, as a family name. Neither platform pays for the other.
 *
 * `fNum` and `fUi` still both exist and still differ in DEFAULT WEIGHT rather
 * than in family: a number is set at 600 where a word is set at 400, and the
 * tracking ramp does the rest. SF carries tabular figures, so `TABULAR` keeps
 * doing its job — the footer's clock would shift the middle block once a
 * second without it.
 */
export interface FontFace {
  fontFamily: string;
  fontWeight?: '400' | '500' | '600' | '700';
}

const SYSTEM = 'System';

const INTER: Record<UiWeight, string> = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
};

const face = (w: UiWeight): FontFace =>
  APPLE
    ? { fontFamily: SYSTEM, fontWeight: String(w) as FontFace['fontWeight'] }
    : { fontFamily: INTER[w] };

export const fNum = (w: NumWeight = 600): FontFace => face(w);

export const fUi = (w: UiWeight = 400): FontFace => face(w);

/**
 * THE THIRD FACE, AND IT IS NOW SPENT ON THE WORDMARK AND THE MONOGRAM ONLY.
 *
 * Anton is BUNDLED on both platforms, because a wordmark is a shape before it
 * is a word and a brand that is condensed on one phone and not on the next is
 * not a brand. That argument covers a logo. It does not cover a name a SCORER
 * TYPED — the club's own name in the lobby header was set in this face at a
 * weight a hair off the wordmark's, so the club read as a second logotype
 * rather than as the answer to "whose board is this". User text is body text,
 * always, and the body face is the system's.
 *
 * So: the HOOPLOG lockup, and the two initials inside a `Crest` — which is a
 * mark and not a label. Never a number, never a caption, never a button, and
 * never a string the app did not write itself.
 *
 * It ships the Vietnamese subset, which is not incidental: the club names this
 * app was built for carry diacritics.
 */
export const fDisplay = (): FontFace => ({ fontFamily: 'Anton_400Regular' });

/**
 * TRACKING IS OPTICAL, AND THE RAMP WAS BUILT FOR A SCREEN SET ENTIRELY IN
 * CAPS. IT IS NOT ANY MORE.
 *
 * Every label in this app used to be uppercase, and uppercase needs air:
 * `LS_MICRO` at 0.12em is what keeps ten capitals from reading as one block.
 * Mixed case does not need it and is actively hurt by it — lowercase letters
 * carry their own rhythm in the ascenders and descenders, so tracking them
 * wide pulls a word apart into letters. The whole positive half of the ramp
 * therefore steps down to near zero, and the one place real tracking survives
 * is `LS_CAPS`, for the strings that are still capitals because they are
 * ABBREVIATIONS rather than shouting: PTS, REB, 3PT, Q1, OT.
 *
 *   LS_CAPS    the scorebook's abbreviations — the only caps left
 *   LS_MICRO   the smallest captions, where a hair of air still helps
 *   LS_LABEL   an ordinary label
 *   LS_BTN     a verb on a button: none, it is a word like any other
 *   LS_TITLE   a screen's own name at display size
 *   LS_TIGHT   the numbers: a score, a tile's value, the footer's block, so a
 *              figure reads as ONE object rather than as digits standing next
 *              to each other. Tabular figures keep their column regardless.
 *
 * CSS tracking is em-relative; React Native's letterSpacing is absolute, which
 * is the whole reason `ls()` exists — an em is a multiplication here, not a unit.
 */
export const LS_CAPS = 0.06;
export const LS_BTN = 0;
export const LS_LABEL = 0.005;
export const LS_MICRO = 0.015;
export const LS_TITLE = -0.01;
export const LS_TIGHT = -0.02;
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

/* ------------------------------------------------------------------ *
 * The bloom
 *
 * THE FOUR TABS ARE DRAWN ON BLACK WITH ONE WARM CORNER, and this is the
 * corner. It is the accent falling out of the top-left, low enough that it
 * names nothing and no control is picked out by it: it is a GROUND, not a
 * mark, which is the only reason it does not count against the two things
 * accent is allowed to mean on these screens.
 *
 * It lives here rather than in the screen that draws it because it is now
 * drawn in TWO places that must not drift — the canvas behind the four tabs,
 * and the fill of the primary button, which was asked to have the same vibe as
 * the thing behind it. The axis and the stops are shared; only the colours
 * differ, because one of them is a wash over near-black and the other is a
 * button that has to stay legible with white ink on it.
 *
 * The axis is a DIAGONAL and not a straight drop, so the warm corner is a
 * corner: light arriving from the top-left and running out before the fold.
 * ------------------------------------------------------------------ */
export const BLOOM_START = { x: 0.15, y: 0 } as const;
export const BLOOM_END = { x: 0.85, y: 1 } as const;
export const BLOOM_STOPS: readonly [number, number, number] = [0, 0.45, 1];

/** How far down the window the wash runs before it is gone. */
export const BLOOM_HEIGHT = 0.52;

/** The wash behind a screen: the accent, twice, then nothing. */
export const bloomWash = (accent: string): readonly [string, string, string] => [
  withAlpha(accent, 0.34),
  withAlpha(accent, 0.07),
  'transparent',
];

/**
 * THE SAME WASH ON A BUTTON, AND IT IS THE SAME CONSTRUCTION: the accent at
 * falling alpha over the near-black ground, on the same axis, so the button is
 * a piece of the background rather than an orange slab standing on it. The
 * caller paints `bg` underneath and lets these three sit on it, exactly as the
 * screen does.
 *
 * IT IS DENSER THAN THE WASH AND SOFTER THAN THE RAW ACCENT, and it is pinned
 * between those two by what went wrong at each end. The wash runs 0.34 → 0.07
 * down half a window; a button is forty-eight points tall, and those alphas
 * over a strip that short is a dark slab nobody reads as the primary verb —
 * worse, one that reads like the `surface` weight this same button takes while
 * a game is live. The other end is the flat `#F26414` slab this variant exists
 * to stop being: at full strength the fill is louder than everything it is
 * meant to sit among, and the gradient in it cannot be seen at all.
 *
 * So the ramp is a SOFT orange throughout — the accent stepped back off full
 * at the near corner and falling to a warm ember at the far one, which leaves
 * the whole width of the button carrying visible movement in one hue. It is
 * the wash's move at a weight a control can carry.
 *
 * `withAlpha` is why there is no new hex here: every stop is the one orange
 * over the room's own near-black, and passing `accent2` gets the whole ramp a
 * step darker for the press.
 */
export const bloomFill = (accent: string): readonly [string, string, string] => [
  withAlpha(accent, 0.82),
  withAlpha(accent, 0.56),
  withAlpha(accent, 0.3),
];

/**
 * AND THE SAME WASH ON A JERSEY PLATE, which is the third weight of one idea.
 *
 * A plate is smaller than a button and much smaller than a window, so the
 * screen's 0.34 → 0.07 falls to nothing across sixty points and leaves the
 * corner flat. But a plate is also a GROUND WITH A NUMBER ON IT, where a button
 * is a ground with a word on it and can afford `bloomFill`'s near-solid orange:
 * a jersey read at arm's length in a gym cannot spend any of its contrast on
 * the light behind it. So this sits between the two — a warm corner that is
 * clearly there and never competes with the digits.
 *
 * It runs on `BLOOM_START` / `BLOOM_END` / `BLOOM_STOPS` like the other two, so
 * a plate is lit from the same corner as the room it is standing in.
 */
export const plateWash = (accent: string): readonly [string, string, string] => [
  withAlpha(accent, 0.3),
  withAlpha(accent, 0.09),
  'transparent',
];
