export const mmss = (s: number): string =>
  String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* ------------------------------------------------------------------ *
 * The clock keypad
 *
 * Four slots, mm:ss, filled LEFT TO RIGHT — the order the time is read in.
 * "0724" is 7:24, and a shorter entry is simply unfinished: the panel keeps SET
 * dark until all four are down rather than guessing which slots were meant.
 * (Shifting digits in from the right was built and cut. It reaches 0:45 in two
 * taps instead of four, but it moves every digit already on screen with each
 * keystroke, which is unreadable at courtside.)
 * ------------------------------------------------------------------ */

export const CLOCK_DIGITS = 4;

/** Unfilled slots read as this — never a digit, which would be a wrong time. */
const SLOT = '-';

/**
 * Append one digit, or refuse it. Slot 2 is the TENS of seconds and takes 0–5
 * only: refusing the keystroke is the one rule that keeps the readout honest at
 * every point in the entry. Clamping 74 to 59 afterwards would put a time on
 * screen that SET does not apply.
 */
export const pushClockDigit = (digits: string, d: string): string => {
  if (digits.length >= CLOCK_DIGITS) return digits;
  if (digits.length === 2 && Number(d) > 5) return digits;
  return digits + d;
};

/** The readout, always four slots wide so the shape never moves as it fills. */
export const clockEntry = (digits: string): string => {
  const s = digits.padEnd(CLOCK_DIGITS, SLOT);
  return s.slice(0, 2) + ':' + s.slice(2);
};

/** Only ever asked of a complete entry — see `clockReady`. */
export const secondsFromClock = (digits: string): number =>
  Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4));

export const clockReady = (digits: string): boolean => digits.length === CLOCK_DIGITS;

/**
 * `Q3`, `H1`, `OT`, `OT2` — what one slice of a game is called.
 *
 * THE REGULATION COUNT IS AN ARGUMENT because it is settable, and it is the
 * GAME's, never the live setting's: a night played in halves is read back in
 * halves whatever the scorer has switched to since. It had three identical
 * copies with a hardcoded four in them — the stats screen, the saved game's
 * page and the PDF — which is exactly three chances to disagree about what
 * period 5 is called.
 *
 * A two-period game is HALVES and says so. Four is quarters, which is the only
 * other answer, so `Q` is the fallback rather than a third branch.
 */
export const periodLabel = (p: number, regulation: number): string => {
  if (p > regulation) return regulation + 1 === p ? 'OT' : `OT${p - regulation}`;
  return (regulation === 2 ? 'H' : 'Q') + p;
};

/**
 * THE SAME ANSWER IN WORDS — `1st quarter`, `1st half`, `Overtime`, `Overtime 2`.
 *
 * `periodLabel` is what a two-character cell prints; this is what a panel's
 * header says and what the screen reader hears. It exists because the board
 * used to print the word QUARTER outright, which is a lie the moment a scorer
 * sets the game to halves — and because `5TH QUARTER` was never what anybody
 * called an overtime, at any setting.
 */
export const periodName = (p: number, regulation: number): string => {
  if (p > regulation) return p === regulation + 1 ? 'Overtime' : `Overtime ${p - regulation}`;
  return `${ord(p)} ${periodWord(p, regulation).toLowerCase()}`;
};

/** Just the noun, for a tile caption that has ten characters to spend. */
export const periodWord = (p: number, regulation: number): string =>
  p > regulation ? 'Overtime' : regulation === 2 ? 'Half' : 'Quarter';

export const ord = (n: number): string =>
  n + ['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10];

export const pct = (m: number, a: number): string => (a ? Math.round((m / a) * 100) + '%' : '-');
export const pct1 = (m: number, a: number): string => (a ? ((m / a) * 100).toFixed(1) + '%' : '-');
