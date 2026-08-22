import type { DotHue } from '../theme/tokens';

/**
 * The web build read these from the query string so a call that could go either
 * way was a switch to try rather than a decision buried in the code. There is
 * no query string here, so they live in the store — and `app/settings.tsx` is
 * the single place that writes them.
 *
 * `skin` used to be one of them, and the only one ever exposed. It is gone: the
 * app has one look, so there is nothing left to store. The three dot hues below
 * are NOT it coming back — see `DotHue` in `theme/tokens.ts` for why the marks
 * on a court are a different question from the colour of the app.
 *
 * TWO OF THEM ARE THE RULES OF THE GAME rather than preferences about the app,
 * and they behave differently because of it: `periods` and `periodLen` are
 * STAMPED ONTO A GAME at tip-off and read off the game thereafter. Changing
 * either here cannot reach a game already on the board and cannot reach a game
 * already on the shelf — a night played in 4 × 10:00 stays 4 × 10:00 however
 * this screen is set afterwards, or every quarter split ever saved would move
 * the day a scorer switched to halves.
 */
export interface Options {
  /**
   * HOW MANY PERIODS A GAME IS, before overtime. Anything past it is OT, which
   * is the whole of what this number decides: `periodLabel` says `Q3` under
   * four and `OT` under two, and the buzzer counts on regardless.
   *
   * Two answers, because basketball has two: quarters and halves.
   */
  periods: 2 | 4;
  /** How long one of them is, in SECONDS. 6/8/10/12 minutes — youth to NBA. */
  periodLen: 360 | 480 | 600 | 720;
  /** quick: one tap = one attempt | trip: batched 1/2/3/and-1 */
  ft: 'quick' | 'trip';
  /** stats: player row opens the stat sheet | sub: straight to substitution */
  tap: 'stats' | 'sub';
  /** ask: prompt after every made shot | skip: never prompt */
  assist: 'ask' | 'skip';
  /** which edge PF/FT/RB lives on; OPP always takes the other. Landscape only. */
  bar: 'right' | 'left';
  /**
   * What a stat is CALLED on the panels where it is picked — DF, DEFENSIVE, or
   * DF with the word under it. Panels only: the board's own PF / FT / RB keys
   * are abbreviations whatever this says, because the bar is three cells wide
   * and a scorer already knows them by shape.
   */
  labels: 'short' | 'full' | 'both';
  /** the made-shot dot on every chart */
  dotMade: DotHue;
  /** the missed-shot dot */
  dotMiss: DotHue;
  /** the one dot on the free-throw line, however many were taken */
  dotFt: DotHue;
}

export const DEFAULT_OPTIONS: Options = {
  // four tens: what the board was hardcoded to before either was a question
  periods: 4,
  periodLen: 600,
  ft: 'quick',
  tap: 'stats',
  assist: 'ask',
  bar: 'right',
  // the word, spelled out. An abbreviation is faster to read only once you know
  // it, and the scorer who has just installed this does not.
  labels: 'full',
  // exactly what the chart drew before the three were settable
  dotMade: 'orange',
  dotMiss: 'neutral',
  dotFt: 'red',
};
