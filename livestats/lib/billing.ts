/**
 * WHAT IS BEHIND THE WALL, AND WHAT THE WALL COSTS.
 *
 * This is the rulebook half of the paywall and it is a plain module on purpose
 * — the same side of the line as `lib/actions.ts`, `lib/box.ts` and
 * `lib/history.ts`. `npm run check` exercises the entire gate table without
 * React, Zustand or a device, which is the only way a rule that decides whether
 * somebody can use what they paid for gets tested at all. **Nothing here
 * touches a store, a route or a screen.** `store/billingStore.ts` holds the two
 * booleans and `hooks/useGate.ts` is what a component asks.
 *
 * ## THE TRIAL IS ONE SAVED GAME
 *
 * A scorer gets to play one game all the way through — start it, score it, undo
 * on it, end it — and the trial is spent when that game is SAVED, not when it
 * tips off. That is the friendlier of the two readings and it is the one
 * chosen: abandoning a game half way through a warm-up costs nothing, and a
 * scorer who mis-taps START GAME has not just lost the thing they came to try.
 *
 * **The loophole is real and it is accepted.** Nothing stops somebody starting
 * a game, exiting, and starting another for ever without saving one — but a
 * game nobody ends has no box score, no shelf row and nothing to export, so
 * what they are getting for free is a scoreboard. The alternative charged
 * honest scorers for their mis-taps to close a hole that yields almost nothing.
 *
 * ## THE LINE
 *
 * **Anything that makes a SECOND game, or reads ACROSS games, is locked.
 * Anything needed to play and read the ONE free game stays open.** That is the
 * whole rule, and every entry in the table below is it applied once:
 *
 * - MATCHES stays open, because it is how a scorer reaches their trial game.
 * - TEAM stays open, because a roster is what the free game is played WITH —
 *   locking it would leave the trial unusable.
 * - GAME SETTINGS stays open, because `periods` and `periodLen` are STAMPED at
 *   tip-off: lock the page and the one free game is forced to 4 × 10:00 for
 *   ever, which is a rule change disguised as a paywall.
 *
 * To make it stricter, add the gate here and to the table — the components ask
 * this module and never decide for themselves.
 */

/**
 * The four things a free scorer cannot have. They are named for what the SCORER
 * was reaching for rather than for the screen that hosts it, because two
 * screens can reach the same one: `season` is the STATS tab, a competition page
 * AND a player page, all three being the same act — reading across games.
 */
export type Gate =
  /** starting another game once the free one is filed */
  | 'newGame'
  /** every number that spans more than one game */
  | 'season'
  /** the PDF */
  | 'export'
  /** PLAYERS, ZONES and PLAYS on a saved game — everything past the team line */
  | 'deepStats';

/** The two booleans the whole thing turns on. Kept as data, not as a store. */
export interface Entitlement {
  /** paid, and therefore nothing below applies */
  entitled: boolean;
  /** the one free game has been saved */
  trialUsed: boolean;
}

/** How many games a scorer gets before the wall. One, and it is stated once. */
export const FREE_GAMES = 1;

/**
 * THE WHOLE GATE TABLE, in one expression.
 *
 * Paying unlocks everything, which is the first line and the only one that
 * should ever be checked first. After that only `newGame` is conditional: it is
 * the gate the TRIAL is measured in, so it is open until the free game is
 * filed. The other three are paid features from the start — and that is not a
 * harsher reading than it looks, because a scorer with no saved game has no
 * season to read, nothing to export and no box score to go deep on. The wall
 * is in front of an empty room until the trial game fills it.
 */
export function locked(gate: Gate, e: Entitlement): boolean {
  if (e.entitled) return false;
  return gate === 'newGame' ? e.trialUsed : true;
}

/**
 * WHY THE PAYWALL OPENED, in the scorer's own words.
 *
 * A wall that appears with no explanation reads as the app breaking. Each of
 * these is printed above the headline as the one line that connects the tap to
 * the screen — "to unlock ...", which is what makes it an answer rather than an
 * interruption. They are phrased as what is GAINED, never as what was refused.
 */
export const GATE_PITCH: Record<Gate, string> = {
  newGame: 'Unlock to start another game',
  season: 'Unlock your season',
  export: 'Unlock the PDF export',
  deepStats: 'Unlock the full box score',
};

/** The gates, so `npm run check` can walk the table rather than list it again. */
export const GATES: Gate[] = ['newGame', 'season', 'export', 'deepStats'];

/* ------------------------------------------------------------------ price -- */

/**
 * VIETNAMESE DONG, GROUPED THE VIETNAMESE WAY — `99.000₫`, dots for thousands
 * and the symbol trailing. It is written out rather than handed to
 * `toLocaleString` for the same reason `numDateLabel` is: a locale-formatted
 * figure is a different width and a different shape on every device, and a
 * price is the one string on the paywall that must read identically to
 * everybody looking at it.
 */
export function vnd(amount: number): string {
  const digits = Math.round(amount).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    // group from the RIGHT, so a 6-digit and a 9-digit figure both break
    // correctly — counting from the left puts the dot in the wrong place on
    // everything that is not exactly six digits
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return `${out}₫`;
}

export interface Plan {
  key: 'monthly' | 'yearly';
  /** the card's own name */
  title: string;
  /** in dong */
  price: number;
  /** what the price buys, spoken: "per month" */
  per: string;
  /** the one card that carries a flag, and there is only ever one */
  badge?: string;
  /**
   * THE SECOND READING OF THE SAME PRICE. A year is a number nobody can put
   * beside a month in their head, so the yearly card prints what it works out
   * at monthly — the way the reference prints a per-week figure under a yearly
   * one. It is derived rather than typed, so the two can never disagree.
   */
  note?: string;
}

/**
 * TWO CARDS, MONTHLY AND YEARLY, and the yearly is the default selection.
 *
 * There is no trial card, because the trial is not a PLAN here — it is a free
 * game the scorer already has, and a card offering what they are already using
 * would be selling them something they own. That is the one place this departs
 * from the reference layout, and it is why the FREE TRIAL ENABLED toggle is
 * gone with it: a switch whose only job is to select the card underneath it is
 * a second control for one decision.
 */
export const PLANS: Plan[] = [
  {
    key: 'monthly',
    title: 'Monthly',
    price: 99_000,
    per: 'per month',
  },
  {
    key: 'yearly',
    title: 'Yearly',
    price: 999_000,
    per: 'per year',
    badge: 'Best value',
    note: `${vnd(Math.round(999_000 / 12))} a month`,
  },
];

/** The card a scorer lands on. The year, because it is the one being argued for. */
export const DEFAULT_PLAN: Plan['key'] = 'yearly';

/**
 * WHAT THE MONEY BUYS, as three lines.
 *
 * Three, and in this order: the thing they just hit (another game), the thing
 * that is biggest (every number the app keeps), and the thing that leaves the
 * app (the sheet). The bold half of each is the noun — the reference bolds a
 * keyword per row and it is what makes three short lines scannable rather than
 * three sentences.
 */
export const BENEFITS: { icon: string; lead: string; bold: string; tail: string }[] = [
  {
    icon: 'basketball',
    lead: '',
    bold: 'Unlimited games',
    tail: ', every season',
  },
  {
    icon: 'chart-box-outline',
    lead: 'Full ',
    bold: 'box score, shot chart',
    tail: ' and play log',
  },
  {
    icon: 'file-pdf-box',
    lead: 'Export any game as a ',
    bold: 'PDF',
    tail: '',
  },
];
