/**
 * The sizing ramp, ported from tokens.css.
 *
 * Every size in the board is `clamp(floor, N vh, ceiling)`. The vh term keeps
 * the tablet proportions; the px floor is the only reason the phone build
 * works. Anything that must *not* scale comes off the fixed step scale
 * s1…s6 (4/8/12/16/24/32).
 *
 * `vh` is the window height in both orientations, exactly like CSS, so the
 * ramp is recomputed whenever the device rotates.
 */
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The court's viewBox aspect, and the divisor in both court calcs. */
export const COURT_ASPECT = 792 / 521; // 1.52015…

/** Below this the panels tighten and the rail's tap floor is released. */
export const SHORT = 590;

/**
 * How much of a left/right safe inset the board actually honours.
 * iOS hands landscape 44pt on BOTH edges for a cutout that occupies the middle
 * third of one of them, and 44 + 44 is a court-width's worth of black. The
 * rounded corner and the cutout's real bite both fit in 24.
 * ponytail: one number, not a per-edge model — raise it if a device clips.
 */
const SIDE_INSET = 30;

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface Metrics {
  portrait: boolean;
  /** `@media (max-height:560px)` — panels tighten, the layout blocks narrow. */
  compact: boolean;
  win: { w: number; h: number };
  safe: { top: number; right: number; bottom: number; left: number };

  /* type */
  fsXs: number;
  fsSm: number;
  fsMd: number;
  fsLg: number;
  fsXl: number;
  fs2xl: number;
  fs3xl: number;
  fs4xl: number;
  /** the footer is deliberately left on the pre-bump ramp: --ftr did not grow */
  fsNav: number;
  fsNavLg: number;
  /**
   * the middle block's numbers — score, clock and quarter are ONE size, and it
   * is the one step on this ramp that a WIDTH can cap. See below.
   */
  fsFtr: number;

  /* space */
  sp: number;
  spLg: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;

  /* shape + hit area */
  r: number;
  rSm: number;
  tap: number;

  /* layout blocks */
  ftr: number;
  rail: number;
  side: number;
  oppw: number;
  /** portrait only */
  railMin: number;
  barh: number;
  /** the rotate glyph — the only thing on screen when a phone is held upright */
  rot: number;

  /** the court's own box, computed the way the two CSS calcs did */
  court: { w: number; h: number };
}

export function computeMetrics(
  w: number,
  h: number,
  raw: { top: number; right: number; bottom: number; left: number },
): Metrics {
  const vh = h / 100;
  const portrait = h > w;
  // Landscape hands top 0 (no status bar there) while the gesture bar still owns
  // the bottom, so the board reads as jammed against the ceiling with a black
  // band under the footer. Split the pair instead of raising both to the max:
  // the extra would come straight out of the court's height.
  // Portrait keeps the real insets — the Dynamic Island genuinely owns its strip.
  const vy = (raw.top + raw.bottom) / 2;
  // capped here, not at the call site, so the arithmetic below and the shell
  // padding in Board can never disagree about the box
  const safe = {
    top: portrait ? raw.top : vy,
    bottom: portrait ? raw.bottom : vy,
    left: Math.min(raw.left, SIDE_INSET),
    right: Math.min(raw.right, SIDE_INSET),
  };
  const compact = h <= SHORT;

  const sp = clamp(4, 0.9 * vh, 10);
  const tap = 48;
  const ftr = clamp(59, 8.5 * vh, 74);

  // five rail cells have to divide a short column, so the blocks narrow too
  const rail = compact ? clamp(143, 24 * vh, 187) : clamp(165, 28.6 * vh, 330);
  // the two flanking columns are one width: they read as a matched pair, and
  // both flex-grow by the same rule, so a different basis is a visible offset
  const side = compact ? clamp(84, 21 * vh, 110) : clamp(84, 13 * vh, 132);
  const oppw = side;

  const railMin = clamp(209, 33 * vh, 330);
  const barh = clamp(tap, 9.9 * vh, 84);
  // the rotate glyph only ever renders on a portrait phone, where vh is the long
  // edge, so the vh term governs everywhere between a 480pt and a 950pt screen
  const rot = clamp(96, 17 * vh, 168);

  const safeX = safe.left + safe.right;
  const safeY = safe.top + safe.bottom;

  /**
   * The footer's own width — landscape stops it at the rail, portrait runs it
   * to the shell padding — and the ONE size on this ramp that a width decides.
   *
   * The footer is four parts, 1 / 2 / 1, and the **half** in the middle carries
   * three numbers side by side, **all three at this size** — the quarter used to
   * sit a step under the other two and no longer does. The budget is measured
   * off the real Chakra Petch advances, not guessed: `108 : 99` is 3.08em plus
   * its two gaps, `07:24` is 2.56em, and `2ND` — the widest period label — is
   * 2.12em with its tracking. Add the two rules and six cells of `s1` padding
   * and the block has to hold roughly `7.76em + 34`, so the size that fits is
   * `(half − 34) / 7.76`.
   *
   * The vh ramp governs wherever width is not what runs out, which is every
   * screen the board actually runs on — a phone narrow enough to bind here is
   * one the rotate gate has already covered. The cap stays because `fsNav` grows
   * with the window height while the block does not, and the day that crosses
   * over the clock reads `07:2…` rather than throwing.
   */
  const ftrw = portrait ? w - safeX - 2 * sp : w - safeX - rail - sp;
  const fsNav = clamp(15, 2.6 * vh, 28);
  const fsFtr = Math.max(18, Math.min(fsNav * 1.5, (ftrw / 2 - 34) / 7.76));

  let court: { w: number; h: number };
  if (portrait) {
    // what the court does NOT get: the rail, the action bar, the footer, the
    // cutouts, and the five gaps. The score strip used to be a sixth term and a
    // sixth gap; it is a footer cell now, and the court has both back.
    const rows = railMin + barh + ftr + safeY + 5 * sp;
    const cw = Math.min(w - safeX - 2 * sp, Math.max(0, h - rows) * COURT_ASPECT);
    court = { w: cw, h: cw / COURT_ASPECT };
  } else {
    // 5 gaps: the app's two side pads, the app grid gap, and the board's two
    const maxW = w - safeX - rail - side - oppw - 5 * sp;
    const maxH = h - safeY - 2 * sp - sp - ftr;
    const ch = Math.min(maxH, maxW / COURT_ASPECT);
    court = { w: ch * COURT_ASPECT, h: ch };
  }

  return {
    portrait,
    compact,
    win: { w, h },
    safe,
    fsXs: clamp(12, 1.45 * vh, 15),
    fsSm: clamp(13, 1.9 * vh, 19),
    fsMd: clamp(16, 2.45 * vh, 24),
    fsLg: clamp(17, 2.9 * vh, 31),
    fsXl: clamp(21, 3.8 * vh, 42),
    fs2xl: clamp(28, 5.1 * vh, 55),
    fs3xl: clamp(31, 7 * vh, 75),
    fs4xl: clamp(42, 9.5 * vh, 96),
    fsNav,
    fsNavLg: clamp(19, 3.4 * vh, 38),
    fsFtr,
    sp,
    spLg: clamp(12, 2 * vh, 24),
    s1: 4,
    s2: 8,
    s3: 12,
    s4: 16,
    s5: 24,
    s6: 32,
    r: 8,
    rSm: 6,
    tap,
    ftr,
    rail,
    side,
    oppw,
    railMin,
    barh,
    rot,
    court,
  };
}

export function useMetrics(): Metrics {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return computeMetrics(width, height, insets);
}
