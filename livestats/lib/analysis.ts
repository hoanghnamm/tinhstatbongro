/**
 * LAST GAME VERSUS THE GAMES BEFORE IT.
 *
 * One question, asked of a team and of a player with the same arithmetic: how
 * did the most recent game compare with the handful that came before it. Plain
 * functions over plain `GameState`s, on the same side of the line as `box.ts`,
 * `season.ts` and `billing.ts` — nothing here knows about AsyncStorage, React
 * or a screen, so `npm run check` walks the whole thing without a device.
 *
 * FOUR DECISIONS, and all four are easy to get wrong:
 *
 *   THE AVERAGE DOES NOT INCLUDE THE LAST GAME. It is what the last game is
 *   being compared AGAINST, so folding it in would flatten every difference
 *   this file exists to show — the more games there are, the less a great
 *   night would appear to differ from the run it broke.
 *
 *   THE WINDOW IS THE FIVE BEFORE IT, or every game there is when there are
 *   fewer than five. Five is a form guide rather than a season: a scorer
 *   asking "was that a good game" means "compared with how we have been
 *   playing", not "compared with October".
 *
 *   THE GAMES ARE THE SEASON'S GAMES. The caller hands them in already
 *   filtered to OFFICIAL and already newest first, exactly as `season()` is
 *   handed them — a practice is a real game with a real box score and it is
 *   simply not what a season's form is made of, which is what the scorer said
 *   when they tapped PRACTICE at the door.
 *
 *   A RISE IS NOT ALWAYS GOOD. Points, rebounds, assists, steals and a
 *   shooting percentage are better when they go up; turnovers are better when
 *   they go down. `riseIsGood` is that fact, held once per stat, so no screen
 *   has to know which of its rows is which.
 *
 * AND ONE AVERAGING RULE THAT IS DELIBERATELY NOT THE OTHERS'. Every counting
 * stat averages the way an average works — the total over the number of games.
 * FG% DOES NOT: it is the makes over the attempts across the whole window,
 * pooled, not the mean of five percentages. The mean is undefined for a game
 * nobody shot in and it lets a 1-for-2 night weigh as much as a 9-for-20 one,
 * and neither is what "we have been shooting 41%" means. The screens print
 * that under the table rather than leaving it implied.
 *
 * AND ONE QUESTION THAT IS NOT ABOUT THE OTHER GAMES AT ALL: whether the team
 * played better after a timeout. It compares the last game with ITSELF, off the
 * marks the log now carries, and it lives at the bottom of this file — see
 * `timeoutRun`.
 */
import { absOf, gameElapsed, lenOf } from './box';
import { appeared } from './season';
import type { GameState, Player } from '../types';

/** How many games before the last one the average is made of, at most. */
export const AVG_WINDOW = 5;

/**
 * The smallest RELATIVE move worth calling a change.
 *
 * "What changed?" ranks on percentage, and a percentage over a small average
 * is the loudest number on any comparison — three steals against two is +50%
 * and is not news. The floor below it is the absolute half of the same guard.
 */
export const MIN_RATIO = 0.1;

export type StatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'to' | 'fg';

export interface StatDef {
  key: StatKey;
  /** the scorebook's abbreviation — a CODE, which is why it stays in caps */
  code: string;
  /** what the row is called in words */
  label: string;
  /** true when going UP is the favourable direction */
  riseIsGood: boolean;
  /** a percentage, so its own delta is measured in percentage POINTS */
  percent: boolean;
  /**
   * The smallest ABSOLUTE move worth naming in "What changed?".
   *
   * Two guards rather than one, because each catches what the other cannot:
   * `MIN_RATIO` throws out a big number that barely moved, and this throws out
   * a small number that moved a long way in percentage terms. One assist more
   * than an average of 0.4 is +150% and is noise.
   */
  floor: number;
  /** what to call it when it goes the favourable way, and the other way */
  better: string;
  worse: string;
}

/**
 * THE SIX ROWS, and there are six because six is what fits a reading.
 *
 * Points, rebounds, assists, steals, turnovers and shooting: what we scored,
 * whether we got the ball back, whether we moved it, and whether we gave it
 * away. Blocks, fouls and the rest are on the box score one tap away — a
 * comparison table is a thing you read in a glance to know whether to look
 * closer, and a table of eighteen rows is the looking closer.
 */
export const TEAM_STATS: readonly StatDef[] = [
  { key: 'pts', code: 'PTS', label: 'Points', riseIsGood: true, percent: false, floor: 3, better: 'Scoring improved', worse: 'Scoring dropped' },
  { key: 'reb', code: 'REB', label: 'Rebounds', riseIsGood: true, percent: false, floor: 2, better: 'Rebounding improved', worse: 'Rebounding dropped' },
  { key: 'ast', code: 'AST', label: 'Assists', riseIsGood: true, percent: false, floor: 2, better: 'Ball moved better', worse: 'Ball moved less' },
  { key: 'stl', code: 'STL', label: 'Steals', riseIsGood: true, percent: false, floor: 2, better: 'Steals up', worse: 'Steals down' },
  { key: 'to', code: 'TO', label: 'Turnovers', riseIsGood: false, percent: false, floor: 2, better: 'Turnovers cut', worse: 'Turnovers increased' },
  { key: 'fg', code: 'FG%', label: 'Field goals', riseIsGood: true, percent: true, floor: 3, better: 'Shooting improved', worse: 'Shooting dropped' },
] as const;

/**
 * ONE GAME, REDUCED TO WHAT THE TABLE COMPARES.
 *
 * The shooting split is carried as MAKES AND ATTEMPTS rather than as a
 * percentage, because a percentage cannot be added to another percentage —
 * pooling the window is the whole reason this shape has two fields where the
 * others have one.
 */
export interface Line {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  fgm: number;
  fga: number;
}

const ZERO: Line = { pts: 0, reb: 0, ast: 0, stl: 0, to: 0, fgm: 0, fga: 0 };

/** One player's line, from their own counters. */
export function playerLine(p: Player): Line {
  const s = p.stats;
  return {
    pts: s.points,
    reb: s.offensiveRebounds + s.defensiveRebounds,
    ast: s.assists,
    stl: s.steals,
    to: s.turnovers,
    fgm: s.fgMade,
    fga: s.fgAttempted,
  };
}

/**
 * The team's line for a game — every player on the sheet added up.
 *
 * It is built off the PLAYERS rather than off `g.score`, and that is not an
 * oversight: the six numbers have to come from one place or the PTS row would
 * be the board's own score while the five under it were the box score's, and
 * the two disagree the moment a point is logged against nobody.
 */
export function teamLine(g: GameState): Line {
  return g.players.reduce<Line>(
    (a, p) => {
      const l = playerLine(p);
      a.pts += l.pts;
      a.reb += l.reb;
      a.ast += l.ast;
      a.stl += l.stl;
      a.to += l.to;
      a.fgm += l.fgm;
      a.fga += l.fga;
      return a;
    },
    { ...ZERO },
  );
}

/**
 * What one row of the table reads off one line.
 *
 * `null` is a real answer and not a zero: a team that took no shot at all has
 * no field-goal percentage, and printing `0.0%` there would be a number the
 * game did not produce.
 */
export function valueOf(def: StatDef, l: Line): number | null {
  if (def.key === 'fg') return l.fga ? (l.fgm / l.fga) * 100 : null;
  return l[def.key];
}

/** The window, pooled: counting stats over the count, shooting over attempts. */
export function averageOf(def: StatDef, lines: Line[]): number | null {
  if (lines.length === 0) return null;
  if (def.key === 'fg') {
    const m = lines.reduce((a, l) => a + l.fgm, 0);
    const a = lines.reduce((s, l) => s + l.fga, 0);
    return a ? (m / a) * 100 : null;
  }
  // pulled out of the closure: narrowing `def.key` past the guard above does
  // not reach inside a callback, and `Line` has no `fg` field to index
  const key: Exclude<StatKey, 'fg'> = def.key;
  return lines.reduce((a, l) => a + l[key], 0) / lines.length;
}

export interface CompareRow {
  key: StatKey;
  code: string;
  label: string;
  percent: boolean;
  riseIsGood: boolean;
  /** the last game's own figure */
  last: number | null;
  /** the window's, or `null` when there is no window to average */
  avg: number | null;
  /** `last − avg` — percentage POINTS on the shooting row */
  delta: number | null;
  /**
   * The relative change, as a fraction of the average.
   *
   * `null` WHEN THE AVERAGE IS ZERO, and that is the stated rule rather than a
   * guard against a division: a team that averaged no steals and took three is
   * not up by an infinite percentage, and any number printed there would be
   * made up. The absolute delta is the whole answer in that case.
   */
  ratio: number | null;
  /** favourable, unfavourable, or `null` when it did not move or cannot be read */
  better: boolean | null;
}

export interface Highlight {
  key: StatKey;
  /** 'Scoring improved' */
  label: string;
  /** '+6.6 PTS' */
  detail: string;
  better: boolean;
  /** did the FIGURE go up — which is not the same question as `better` */
  rose: boolean;
}

export interface Comparison {
  rows: CompareRow[];
  /** how many games the average is made of: 0 when there is nothing to compare */
  window: number;
  /** at most three, biggest relative move first */
  highlights: Highlight[];
}

/** Rounded the way it is printed, so what is compared is what is read. */
const r1 = (n: number): number => Math.round(n * 10) / 10;

const signed = (n: number): string => (n > 0 ? `+${r1(n)}` : String(r1(n)));

/** A figure in a Last or Average cell. */
export const figure = (row: CompareRow, v: number | null): string => {
  if (v === null) return '—';
  if (row.percent) return `${v.toFixed(1)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/**
 * The Change cell's first half.
 *
 * The shooting row carries its UNIT and the others do not, because it is the
 * one row where the reader has to be told which of two things the number is:
 * three points of shooting percentage and three percent of it are different
 * quantities, and the second is the one people assume.
 */
export const deltaLabel = (row: CompareRow): string => {
  if (row.delta === null) return '—';
  return row.percent ? `${signed(row.delta)} pts` : signed(row.delta);
};

/** The Change cell's second half — empty rather than `—` when there is none. */
export const ratioLabel = (row: CompareRow): string => {
  if (row.ratio === null) return '';
  const p = Math.round(row.ratio * 100);
  return p > 0 ? `+${p}%` : `${p}%`;
};

function rowFor(def: StatDef, last: Line, prev: Line[]): CompareRow {
  const lastV = valueOf(def, last);
  const avgV = averageOf(def, prev);
  const delta = lastV === null || avgV === null ? null : lastV - avgV;
  const ratio = delta === null || !avgV ? null : delta / avgV;

  // `r1` first, so a move too small to be printed is not called a change: a
  // delta of 0.04 renders as `+0.0` and must not be lit as an improvement
  const moved = delta === null ? 0 : r1(delta);

  return {
    key: def.key,
    code: def.code,
    label: def.label,
    percent: def.percent,
    riseIsGood: def.riseIsGood,
    last: lastV,
    avg: avgV,
    delta,
    ratio,
    better: moved === 0 ? null : moved > 0 === def.riseIsGood,
  };
}

/**
 * THE TWO OR THREE THINGS WORTH SAYING OUT LOUD.
 *
 * Ranked on the RELATIVE move, because that is the reading that compares a
 * turnover with a rebound — six points and six turnovers are the same number
 * and not the same news. Both guards have to pass: the move has to be big
 * enough against the average (`MIN_RATIO`) and big enough in its own units
 * (`floor`), which is what keeps an assist average of 0.4 rising to 1 out of a
 * list it would otherwise top.
 *
 * IT IS NOT BALANCED ON PURPOSE. Whatever moved most is what is named, so a
 * night where everything went right says so three times rather than inventing
 * a complaint — the table above is where the other side is read.
 */
export function highlightsFor(rows: CompareRow[], max = 3): Highlight[] {
  const defs = new Map(TEAM_STATS.map((d) => [d.key, d]));

  return rows
    .filter(
      (row) =>
        row.delta !== null &&
        row.ratio !== null &&
        row.better !== null &&
        Math.abs(row.ratio) >= MIN_RATIO &&
        Math.abs(row.delta) >= (defs.get(row.key)?.floor ?? 0),
    )
    .sort((a, b) => Math.abs(b.ratio ?? 0) - Math.abs(a.ratio ?? 0))
    .slice(0, max)
    .map((row) => {
      const def = defs.get(row.key)!;
      const rose = (row.delta ?? 0) > 0;
      return {
        key: row.key,
        label: row.better ? def.better : def.worse,
        // `+6.6 PTS`, and on the shooting row `+3.3 pts FG%` — clumsy, and the
        // clumsiness is `deltaLabel`'s unit doing its job
        detail: `${deltaLabel(row)} ${row.code}`,
        better: row.better!,
        rose,
      };
    });
}

/** The table and its highlights, from one line and the window behind it. */
export function compare(last: Line, prev: Line[]): Comparison {
  const rows = TEAM_STATS.map((d) => rowFor(d, last, prev));
  return { rows, window: prev.length, highlights: highlightsFor(rows) };
}

/**
 * THE TEAM'S LAST GAME AGAINST THE FIVE BEFORE IT.
 *
 * `games` is newest first and already OFFICIAL — the same array the season
 * screen aggregates, handed in the same order. `null` when there is no game at
 * all; a single game is NOT null, it is a comparison with an empty window,
 * which is what draws the last game's own figures with `—` beside them.
 */
export function teamComparison(games: GameState[]): Comparison | null {
  if (games.length === 0) return null;
  return compare(
    teamLine(games[0]),
    games.slice(1, 1 + AVG_WINDOW).map(teamLine),
  );
}

/**
 * ONE PLAYER'S LAST GAME AGAINST THE FIVE BEFORE IT.
 *
 * THE WINDOW IS THE GAMES THEY APPEARED IN, which is the denominator
 * `lib/season.ts` uses everywhere and for the reason it is used there: a
 * player is not having a worse run because the team played a game without
 * them, and averaging a DNP in as a zero line is exactly that. It also means
 * "their last game" is the last one they played rather than the team's last —
 * a card that read `—` across because somebody was injured on Saturday would
 * be telling them nothing about their own form.
 *
 * `null` when they have never appeared, which is what draws no card at all.
 */
export function playerComparison(games: GameState[], playerId: string): Comparison | null {
  const lines: Line[] = [];
  for (const g of games) {
    const p = g.players.find((q) => q.id === playerId);
    if (!p || !appeared(p)) continue;
    lines.push(playerLine(p));
    if (lines.length > AVG_WINDOW) break;
  }
  if (lines.length === 0) return null;
  return compare(lines[0], lines.slice(1));
}

/* ------------------------------------------------------------------ *
 * AFTER A TIMEOUT
 *
 * The one question on this page that is not about the run of games at all.
 * A timeout is the only thing on the board a COACH did — every other tap
 * records something a player did — and the only thing worth knowing about one
 * is whether the team came out of it playing better. So this compares the game
 * with ITSELF: the minutes right after the timeouts against every other minute
 * of the same night.
 *
 * FOUR DECISIONS, in the order they bite:
 *
 *   THE MEASURE IS NET POINTS PER MINUTE, ours minus theirs. Points alone
 *   would call a 6–8 stretch a good one, and a shooting percentage says
 *   nothing about the half of the floor a timeout is usually called over. Per
 *   MINUTE because the windows are short and the rest of the game is not, and
 *   two raw totals over unequal time are not a comparison.
 *
 *   THE MINUTES ARE GAME CLOCK, not wall clock. `absOf` reads the period and
 *   the clock reading off each event, so a stoppage costs the window nothing —
 *   which is the whole point, since a timeout IS a stoppage.
 *
 *   A WINDOW IS CUT SHORT BY ITS OWN PERIOD. Two minutes after a timeout
 *   called with thirty seconds left in the quarter is not two minutes of the
 *   same possession-by-possession thing; the huddle at the buzzer that follows
 *   is a different huddle. This is the same approximation `lib/box.ts` makes
 *   at a period end, and it is stated on the screen.
 *
 *   OVERLAPPING WINDOWS ARE MERGED, and the seconds are counted once. Two
 *   timeouts inside a minute of each other are one stretch of play, and
 *   counting it twice would weight it twice in a rate.
 *
 * A game saved before timeouts were stamped has the count and no marks, so
 * there is nothing to compare and `timeoutRun` says so by answering `null`.
 * ------------------------------------------------------------------ */

/** How much game clock after a timeout is counted as "after the timeout". */
export const AFTER_TIMEOUT = 120;

export interface TimeoutRun {
  /** timeouts that left a mark — not `g.timeouts`, which an old game also has */
  count: number;
  /** seconds of game clock inside the windows, counted once */
  afterSeconds: number;
  /** and every other second the game was played */
  restSeconds: number;
  afterUs: number;
  afterThem: number;
  restUs: number;
  restThem: number;
  /** net points per minute after the timeouts — `null` when no clock ran there */
  after: number | null;
  /** the same over the rest of the game */
  rest: number | null;
  /** `after − rest` */
  delta: number | null;
  /** true when the team was better after the timeouts; `null` when it did not move */
  better: boolean | null;
}

/** A rate, signed, at the one decimal it is printed to. */
export const netLabel = (v: number | null): string => (v === null ? '—' : signed(v));

/**
 * THE MINUTES AFTER THE TIMEOUTS AGAINST THE REST OF THE GAME.
 *
 * `null` when this game stamped no timeout — either none was called, or it was
 * saved before the mark existed. The caller has `g.timeouts` in hand and can
 * tell those two apart; this function will not guess between them.
 */
export function timeoutRun(g: GameState): TimeoutRun | null {
  const len = lenOf(g);
  const end = gameElapsed(g);
  const marks = g.events.filter((e) => e.type === 'timeout');
  if (marks.length === 0) return null;

  // sorted, because a clock corrected by hand can put a later event earlier on
  // the game's own timeline — `lib/box.ts` guards the same walk the same way
  const spans = marks
    .map((e) => {
      const lo = Math.min(absOf(e, len), end);
      // its own period's buzzer, the window's length, or the end of the game,
      // whichever comes first
      return [lo, Math.min(lo + AFTER_TIMEOUT, e.period * len, end)] as [number, number];
    })
    .filter(([lo, hi]) => hi > lo)
    .sort((a, b) => a[0] - b[0]);

  const windows: [number, number][] = [];
  for (const [lo, hi] of spans) {
    const last = windows[windows.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else windows.push([lo, hi]);
  }

  // half open at the START: the basket that a timeout was called over reads on
  // the same second as the timeout, and it belongs to the play before it
  const inside = (t: number): boolean => windows.some(([lo, hi]) => t > lo && t <= hi);

  const r = {
    count: marks.length,
    afterSeconds: windows.reduce((n, [lo, hi]) => n + (hi - lo), 0),
    restSeconds: 0,
    afterUs: 0,
    afterThem: 0,
    restUs: 0,
    restThem: 0,
  };
  r.restSeconds = Math.max(0, end - r.afterSeconds);

  for (const e of g.events) {
    const ours = (e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made';
    if (!ours && e.type !== 'oppPoint') continue;
    const after = inside(Math.min(absOf(e, len), end));
    if (ours) r[after ? 'afterUs' : 'restUs'] += e.value;
    else r[after ? 'afterThem' : 'restThem'] += e.value;
  }

  const rate = (net: number, seconds: number): number | null =>
    seconds > 0 ? net / (seconds / 60) : null;

  const after = rate(r.afterUs - r.afterThem, r.afterSeconds);
  const rest = rate(r.restUs - r.restThem, r.restSeconds);
  const delta = after === null || rest === null ? null : after - rest;
  // rounded the way it is printed first, so a move too small to show is not
  // lit as an improvement — the same rule `rowFor` follows
  const moved = delta === null ? 0 : r1(delta);

  return { ...r, after, rest, delta, better: moved === 0 ? null : moved > 0 };
}
