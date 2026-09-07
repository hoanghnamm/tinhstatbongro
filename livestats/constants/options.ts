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
  /**
   * WHETHER THE FOOTER COUNTS POSSESSIONS AS WELL AS TIMEOUTS.
   *
   * The fourth footer cell is a hand-counted number, and there are two of them
   * a scorer might want there. A TIMEOUT is not optional — every game has them,
   * every scorer has to know how many are left, and nobody has to be taught
   * what the number means. A POSSESSION count is a choice: it is a tap on every
   * change of possession all night, forty of them a quarter, and it buys
   * exactly one figure — points per possession. A scorer who is not going to
   * read that figure should not be handed the tap.
   *
   * So the timeout has the cell and this switch is what SPLITS it: `on` divides
   * the cell in halves, possessions above, timeouts below. It is `off` on a
   * fresh install because the quieter board is the one that is right for more
   * scorers, and because the count it enables is the only one of the two that
   * can be started mid-game without the number lying — a possession count begun
   * in the third quarter is a possession count of the third quarter.
   *
   * Read LIVE, like everything here except the two stamped rules: turning it on
   * shows the count this game already has, and turning it off hides a number
   * the game goes on holding.
   */
  poss: 'on' | 'off';
  /**
   * WHICH SKIN THE BOARD IS DRAWN IN — white, or the near-black the four rooms
   * are. It is not the skin switcher coming back: it reaches ONE ROUTE, and it
   * is the only screen in the app that was ever the odd one out.
   *
   * The board is light because it is read at arm's length in gym lighting, and
   * walking onto it is meant to feel like the lights coming up. That is still
   * the DEFAULT and still the argument. But a gym lit like a gym is not every
   * gym, and a white board at night is the one screen in this app anybody has
   * ever asked to turn down — so `dark` hands the board the LOBBY'S palette,
   * the same `DARK` the four rooms declare, rather than a new third one.
   *
   * It switches the whole palette and not merely the fill, deliberately: a
   * near-black ground under near-black ink is a board nobody can read, and the
   * dark palette is the one place in the app where every pair — the surfaces,
   * the rules, the press lift, the floor — is already answered for that ground.
   */
  board: 'light' | 'dark';
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
  // the timeout cell whole: the count every scorer keeps, and no second tap to
  // learn on the first night
  poss: 'off',
  // the lights coming up: what the board has always been
  board: 'light',
};

/**
 * THE ANSWERS, AS TABLES — one per switch, and they are here rather than in
 * the screen that draws them because two screens now draw them.
 *
 * `app/settings.tsx` is where every option is set and `app/intro.tsx` asks for
 * the two that are STAMPED at tip-off. A second copy of `6 / 8 / 10 / 12` is a
 * second chance for one screen to offer a length the other does not, which the
 * type would not catch — both are valid `Options['periodLen']` lists.
 *
 * They are plain `{ key, label }` records rather than the `SegItem` the strip
 * takes: `SegItem` lives in `components/`, this file is a constant, and the
 * shape is structurally what `Seg` asks for.
 */
export interface OptionChoice<T extends string | number> {
  key: T;
  label: string;
}

export const PERIOD_CHOICES: readonly OptionChoice<Options['periods']>[] = [
  { key: 2, label: '2 halves' },
  { key: 4, label: '4 quarters' },
];

/** Four cells is the tightest row either screen draws, so the UNIT is said
 *  once in the label above rather than four times inside it — `12 min` in a
 *  quarter of a 360pt phone is a cell that ellipsises. */
export const LENGTH_CHOICES: readonly OptionChoice<Options['periodLen']>[] = [
  { key: 360, label: '6' },
  { key: 480, label: '8' },
  { key: 600, label: '10' },
  { key: 720, label: '12' },
];

export const LABEL_CHOICES: readonly OptionChoice<Options['labels']>[] = [
  { key: 'full', label: 'Word' },
  { key: 'short', label: 'Short' },
  { key: 'both', label: 'Both' },
];

/**
 * THE FOURTH FOOTER CELL, WHOLE OR IN HALVES — and the answers are named after
 * what the cell DOES rather than after the switch, because `on` / `off` on a
 * row labelled "possessions" is a scorer guessing which way round it reads.
 */
export const POSS_CHOICES: readonly OptionChoice<Options['poss']>[] = [
  { key: 'off', label: 'Timeouts only' },
  { key: 'on', label: 'Both' },
];

/**
 * THE BOARD'S OWN SKIN, AND IT IS THE ONLY PLACE IN THE APP A PALETTE IS
 * CHOSEN. Two answers because there are two: the white the board has always
 * been, and the near-black every other room is already drawn in — which is why
 * the second is named after the room a scorer has just come from rather than
 * after a colour.
 */
export const BOARD_CHOICES: readonly OptionChoice<Options['board']>[] = [
  { key: 'light', label: 'White' },
  { key: 'dark', label: 'Lobby' },
];

/**
 * `4 × 10:00` — what the two stamped switches add up to, said in one string.
 *
 * Both screens print it: the door under its two segments, and it is the line
 * that makes "stamped on each game at tip-off" mean something. It is derived
 * rather than typed, so it cannot disagree with the switches above it.
 */
export const shapeLabel = (periods: Options['periods'], len: Options['periodLen']): string =>
  `${periods} × ${Math.floor(len / 60)}:00`;
