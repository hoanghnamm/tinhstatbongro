/**
 * ONE GAME AGAINST A BASELINE — the whole of the COMPARISON.
 *
 * One question, asked of a team and of a player with the same arithmetic: how
 * did THIS game compare with what this team normally does. Plain functions
 * over plain `GameState`s, on the same side of the line as `box.ts`,
 * `season.ts` and `billing.ts` — nothing here knows about AsyncStorage, React
 * or a screen, so `npm run check` walks the whole thing without a device.
 *
 * FIVE DECISIONS, and all five are easy to get wrong:
 *
 *   THE BASELINE DOES NOT INCLUDE THE SUBJECT. It is what the game is being
 *   compared AGAINST, so folding it in would flatten every difference this
 *   file exists to show — the more games there are, the less a great night
 *   would appear to differ from the run it broke. `teamComparison` drops the
 *   subject out of the baseline itself rather than trusting a caller to.
 *
 *   THE BASELINE IS EVERY OTHER OFFICIAL GAME, and the caller decides which
 *   those are. It used to be the five before the last one, which was the right
 *   answer while the subject was always the LAST game: "how have we been
 *   playing lately". The subject is now any game on the shelf, and "the five
 *   before that one" is a window nobody asked for — what a scorer means by
 *   *is this a good game* is *against how this team plays*, which is the
 *   season. A practice is a real game with a real box score and is simply not
 *   what a season is made of, which is what the scorer said when they tapped
 *   PRACTICE at the door.
 *
 *   A BASELINE OF ONE GAME IS THE SAME ARITHMETIC. Comparing two games is not
 *   a second mode with a second set of rules — it is an average over a
 *   baseline of one, which is that game's own figures. That is why the screen
 *   can offer *against the average* and *against that game* off one function.
 *
 *   A RISE IS NOT ALWAYS GOOD, AND SOMETIMES IT IS NEITHER. Points, rebounds
 *   and assists are better when they go up; turnovers, fouls and the points we
 *   let in are better when they go down; and a SHOT COUNT is neither. Taking
 *   six more threes is a change in what the team chose to do, not a change in
 *   how well it did it, and colouring it green or red would be this file
 *   making a claim it cannot support. `polarity` is that fact, held once per
 *   stat, so no screen has to know which of its rows is which.
 *
 *   THE OPPONENT IS ONE NUMBER. There is no opponent box score anywhere in
 *   this app — three buttons and a total — so the defensive rows are STEALS,
 *   BLOCKS and POINTS ALLOWED. An opponent field-goal percentage is not
 *   missing from this table; it was never observed, and a row of dashes
 *   pretending otherwise would be worse than its absence.
 *
 * AND ONE AVERAGING RULE THAT IS DELIBERATELY NOT THE OTHERS'. Every counting
 * stat averages the way an average works — the total over the number of games.
 * A RATE DOES NOT: a percentage and the assists-per-turnover ratio are the
 * numerator over the denominator across the WHOLE baseline, pooled, not the
 * mean of each game's own figure. The mean is undefined for a game nobody shot
 * in and it lets a 1-for-2 night weigh as much as a 9-for-20 one, and neither
 * is what "we have been shooting 41%" means. The screens print that under the
 * shooting table rather than leaving it implied.
 *
 * AND ONE QUESTION THAT IS NOT ABOUT THE OTHER GAMES AT ALL: whether the team
 * played better after a timeout. It compares the game with ITSELF, off the
 * marks the log now carries, and it lives at the bottom of this file — see
 * `timeoutRun`.
 */
import { absOf, gameElapsed, lenOf, regOf } from './box';
import { periodScores } from './flow';
import { appeared } from './season';
import { efficiency, plusMinus } from './stats';
import type { GameState, Player } from '../types';

/**
 * The smallest RELATIVE move worth calling a change.
 *
 * "What changed?" ranks on percentage, and a percentage over a small average
 * is the loudest number on any comparison — three steals against two is +50%
 * and is not news. The floor below it is the absolute half of the same guard.
 */
export const MIN_RATIO = 0.1;

/**
 * THE SPARSE-SAMPLE FLOOR: attempts below which a rate is not allowed to be
 * the subject of a sentence.
 *
 * Ten is a REVIEW THRESHOLD and not a significance test, and it is written
 * down here rather than at each call site so the two readers cannot drift: a
 * rate's move is not a highlight unless BOTH samples cleared it (see
 * `highlightsFor`), and a game's own shooting split is not worth remarking on
 * below it either (see `lib/observe.ts`). One-for-two is 50% and is not a
 * fact about anybody's shooting.
 */
export const MIN_ATTEMPTS = 10;

/**
 * WHICH WAY IS UP — and the third answer is the one that matters.
 *
 * `up` and `down` name the favourable direction. `none` is a stat with NO
 * favourable direction: the four shot-volume rows are a record of what the
 * team chose to do, and a change in them is a fact rather than news. A row
 * with no polarity is never coloured and can never be a highlight, which is
 * this file declining to say something it cannot know.
 */
export type Polarity = 'up' | 'down' | 'none';

/**
 * HOW A FIGURE IS MADE, which is also how a baseline is pooled.
 *
 * `count` is meaned over the games. `percent` and `ratio` are the numerator
 * over the denominator across the whole baseline — see the note at the top of
 * this file. The only difference between those two is how they are PRINTED: a
 * percentage carries its change in percentage points, a ratio does not.
 */
export type StatKind = 'count' | 'percent' | 'ratio';

export interface StatDef {
  key: string;
  /** the scorebook's abbreviation — a CODE, which is why it stays in caps */
  code: string;
  /** what the row is called in words */
  label: string;
  polarity: Polarity;
  kind: StatKind;
  /** the figure itself on a count, the numerator on a rate */
  num: (l: Line) => number;
  /** a rate's denominator — absent on a count, which is its own sample */
  den?: (l: Line) => number;
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

/** A named handful of rows, read together. */
export interface StatGroup {
  key: string;
  title: string;
  stats: readonly StatDef[];
}

/**
 * ONE GAME, REDUCED TO WHAT THE TABLES COMPARE.
 *
 * Every rate is carried as ITS TWO HALVES rather than as a figure, because a
 * percentage cannot be added to another percentage — pooling the baseline is
 * the whole reason this shape has `fgm` and `fga` where it could have had one
 * number.
 *
 * `opp` and `margin` are TEAM figures and are zero on a player's line. There
 * is no per-player equivalent of "points allowed" on a board that scores the
 * opponent as one number, and a player's own answer to the same question is
 * `pm`, which is a real plus-minus because the board knows who was standing
 * there when the three OPP buttons were tapped.
 */
export interface Line {
  pts: number;
  fgm: number;
  fga: number;
  twom: number;
  twoa: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  to: number;
  stl: number;
  blk: number;
  pf: number;
  pm: number;
  eff: number;
  /** what the other team scored — a team line only */
  opp: number;
  /** ours minus theirs — a team line only */
  margin: number;
}

const ZERO: Line = {
  pts: 0, fgm: 0, fga: 0, twom: 0, twoa: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
  oreb: 0, dreb: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0,
  pm: 0, eff: 0, opp: 0, margin: 0,
};

/* -- the rows, grouped the way a coach reads them -------------------- *
 * Each group is ONE AREA of the game and the rows under it are that area's
 * evidence, which is why SHOOTING and SHOT VOLUME are two groups and not one:
 * they answer different questions — were we efficient, and did we simply
 * shoot more — and a table that mixes a percentage with a count invites the
 * reader to treat the second as an explanation of the first.
 *
 * The two builders below are shorthand for the shape, not a second rulebook:
 * everything either is a field on the line or is a numerator over a
 * denominator, and there is no third kind.
 * ------------------------------------------------------------------- */

const count = (
  key: keyof Line,
  code: string,
  label: string,
  polarity: Polarity,
  floor: number,
  better: string,
  worse: string,
): StatDef => ({
  key,
  code,
  label,
  polarity,
  kind: 'count',
  num: (l) => l[key],
  floor,
  better,
  worse,
});

const rate = (
  key: string,
  code: string,
  label: string,
  num: (l: Line) => number,
  den: (l: Line) => number,
  floor: number,
  better: string,
  worse: string,
  kind: StatKind = 'percent',
): StatDef => ({
  key,
  code,
  label,
  polarity: 'up',
  kind,
  num,
  den,
  floor,
  better,
  worse,
});

export const TEAM_GROUPS: readonly StatGroup[] = [
  {
    key: 'scoring',
    title: 'Scoring',
    stats: [
      count('pts', 'PTS', 'Points', 'up', 3, 'Scoring improved', 'Scoring dropped'),
      count('margin', '+/-', 'Margin', 'up', 4, 'Margin improved', 'Margin dropped'),
    ],
  },
  {
    key: 'shooting',
    title: 'Shooting',
    stats: [
      rate('fg', 'FG%', 'Field goals', (l) => l.fgm, (l) => l.fga, 3, 'Shooting improved', 'Shooting dropped'),
      rate('two', '2P%', 'Two-pointers', (l) => l.twom, (l) => l.twoa, 3, 'Two-point shooting improved', 'Two-point shooting dropped'),
      rate('three', '3P%', 'Three-pointers', (l) => l.tpm, (l) => l.tpa, 3, 'Three-point shooting improved', 'Three-point shooting dropped'),
      rate('ft', 'FT%', 'Free throws', (l) => l.ftm, (l) => l.fta, 4, 'Free-throw shooting improved', 'Free-throw shooting dropped'),
      // the one row that weighs a three as the extra point it is worth, which
      // is why it sits under the four splits rather than beside FG%
      rate('efg', 'eFG%', 'Effective FG', (l) => l.fgm + 0.5 * l.tpm, (l) => l.fga, 3, 'Effective shooting improved', 'Effective shooting dropped'),
    ],
  },
  {
    key: 'volume',
    title: 'Shot volume',
    stats: [
      count('fga', 'FGA', 'Field goals attempted', 'none', 4, '', ''),
      count('twoa', '2PA', 'Twos attempted', 'none', 3, '', ''),
      count('tpa', '3PA', 'Threes attempted', 'none', 3, '', ''),
      count('fta', 'FTA', 'Free throws attempted', 'none', 3, '', ''),
    ],
  },
  {
    key: 'movement',
    title: 'Ball movement',
    stats: [
      count('ast', 'AST', 'Assists', 'up', 2, 'Assists increased', 'Assists decreased'),
      // POOLED like every other rate, and undefined in a game nobody turned
      // the ball over in — which is a real answer, not a zero
      rate('astto', 'A/TO', 'Assists per turnover', (l) => l.ast, (l) => l.to, 0.3, 'Assists per turnover rose', 'Assists per turnover fell', 'ratio'),
    ],
  },
  {
    key: 'security',
    title: 'Ball security',
    stats: [count('to', 'TO', 'Turnovers', 'down', 2, 'Turnovers cut', 'Turnovers increased')],
  },
  {
    key: 'rebounding',
    title: 'Rebounding',
    stats: [
      count('reb', 'REB', 'Rebounds', 'up', 2, 'Rebounding improved', 'Rebounding dropped'),
      count('oreb', 'OR', 'Offensive', 'up', 2, 'Offensive rebounding improved', 'Offensive rebounding dropped'),
      count('dreb', 'DR', 'Defensive', 'up', 2, 'Defensive rebounding improved', 'Defensive rebounding dropped'),
    ],
  },
  {
    key: 'defence',
    title: 'Defence',
    stats: [
      count('stl', 'ST', 'Steals', 'up', 2, 'Steals up', 'Steals down'),
      count('blk', 'BS', 'Blocks', 'up', 2, 'Blocks up', 'Blocks down'),
      // THE ONLY DEFENSIVE FIGURE THE OTHER TEAM LEAVES BEHIND on a board that
      // scores them with three buttons. It is not a stand-in for their
      // shooting percentage and is not labelled as one.
      count('opp', 'OPP', 'Points allowed', 'down', 3, 'Fewer points allowed', 'More points allowed'),
    ],
  },
  {
    key: 'discipline',
    title: 'Discipline',
    stats: [count('pf', 'PF', 'Fouls', 'down', 2, 'Fouls down', 'Fouls up')],
  },
];

/** Every team row, flat — what `highlightsFor` ranks over. */
export const TEAM_STATS: readonly StatDef[] = TEAM_GROUPS.flatMap((g) => g.stats);

/**
 * WHAT A PLAYER IS READ ON, and it is five things.
 *
 * Points, rebounds, assists, plus-minus and efficiency: what they scored, what
 * they got back, what they created, what happened while they were out there,
 * and one figure that folds the lot together. The twenty-column box score is
 * one tap away on the STATS tab — this is the glance that decides whether to
 * go and look.
 */
export const PLAYER_STATS: readonly StatDef[] = [
  count('pts', 'PTS', 'Points', 'up', 3, 'Scoring improved', 'Scoring dropped'),
  count('reb', 'REB', 'Rebounds', 'up', 2, 'Rebounding improved', 'Rebounding dropped'),
  count('ast', 'AST', 'Assists', 'up', 2, 'Assists increased', 'Assists decreased'),
  count('pm', '+/-', 'Plus-minus', 'up', 4, 'Plus-minus improved', 'Plus-minus dropped'),
  count('eff', 'EF', 'Efficiency', 'up', 3, 'Efficiency improved', 'Efficiency dropped'),
];

/** The one group a player's own card draws. */
export const PLAYER_GROUPS: readonly StatGroup[] = [
  { key: 'impact', title: 'Impact', stats: PLAYER_STATS },
];

/** One player's line, from their own counters. */
export function playerLine(p: Player): Line {
  const s = p.stats;
  return {
    ...ZERO,
    pts: s.points,
    fgm: s.fgMade,
    fga: s.fgAttempted,
    twom: s.twoMade,
    twoa: s.twoAttempted,
    tpm: s.threeMade,
    tpa: s.threeAttempted,
    ftm: s.ftMade,
    fta: s.ftAttempted,
    oreb: s.offensiveRebounds,
    dreb: s.defensiveRebounds,
    reb: s.offensiveRebounds + s.defensiveRebounds,
    ast: s.assists,
    to: s.turnovers,
    stl: s.steals,
    blk: s.blocks,
    pf: s.fouls,
    pm: plusMinus(s),
    eff: efficiency(s),
  };
}

/**
 * The team's line for a game — every player on the sheet added up.
 *
 * The counting half is built off the PLAYERS rather than off `g.score`, and
 * that is not an oversight: the rows have to come from one place, or PTS would
 * be the board's own score while everything under it was the box score's, and
 * the two disagree the moment a point is logged against nobody.
 *
 * THE TWO TEAM FIGURES ARE THE BOARD'S. `opp` is what the opponent scored,
 * which no player line can carry, and `margin` is measured against it — so the
 * margin is the BOARD's score minus theirs. A team plus-minus is the same
 * number: adding five players' plus-minus up counts one margin five times.
 */
export function teamLine(g: GameState): Line {
  const l = g.players.reduce<Line>((a, p) => {
    const q = playerLine(p);
    a.pts += q.pts;
    a.fgm += q.fgm;
    a.fga += q.fga;
    a.twom += q.twom;
    a.twoa += q.twoa;
    a.tpm += q.tpm;
    a.tpa += q.tpa;
    a.ftm += q.ftm;
    a.fta += q.fta;
    a.oreb += q.oreb;
    a.dreb += q.dreb;
    a.reb += q.reb;
    a.ast += q.ast;
    a.to += q.to;
    a.stl += q.stl;
    a.blk += q.blk;
    a.pf += q.pf;
    a.eff += q.eff;
    return a;
  }, { ...ZERO });

  l.opp = g.oppScore;
  l.margin = g.score - g.oppScore;
  l.pm = l.margin;
  return l;
}

/**
 * What one row reads off one line.
 *
 * `null` is a real answer and not a zero: a team that took no shot at all has
 * no field-goal percentage, and printing `0.0%` there would be a number the
 * game did not produce. The same holds of assists per turnover in a game
 * nobody turned it over in.
 */
export function valueOf(def: StatDef, l: Line): number | null {
  if (!def.den) return def.num(l);
  const d = def.den(l);
  if (!d) return null;
  return (def.num(l) / d) * (def.kind === 'percent' ? 100 : 1);
}

/** The baseline: a count over the number of games, a rate over its own denominator. */
export function averageOf(def: StatDef, lines: Line[]): number | null {
  if (lines.length === 0) return null;
  if (!def.den) return lines.reduce((a, l) => a + def.num(l), 0) / lines.length;
  const den = def.den;
  const d = lines.reduce((a, l) => a + den(l), 0);
  if (!d) return null;
  return (lines.reduce((a, l) => a + def.num(l), 0) / d) * (def.kind === 'percent' ? 100 : 1);
}

export interface CompareRow {
  key: string;
  code: string;
  label: string;
  kind: StatKind;
  polarity: Polarity;
  /** the subject game's own figure */
  subject: number | null;
  /** the baseline's, or `null` when there is no baseline to average */
  base: number | null;
  /**
   * WHAT EACH FIGURE IS MADE OF on a rate row — `null` on a count, which is
   * its own sample.
   *
   * It is carried rather than recomputed because the guard that needs it lives
   * in `highlightsFor`, which is handed rows and not games: a rate cannot be
   * the subject of a sentence unless BOTH sides of the comparison cleared
   * `MIN_ATTEMPTS`, and a row that has forgotten its denominator cannot answer
   * that.
   */
  subjectDen: number | null;
  baseDen: number | null;
  /** `subject − base` — percentage POINTS on a percentage row */
  delta: number | null;
  /**
   * The relative change, as a fraction of the baseline.
   *
   * `null` WHEN THE BASELINE IS ZERO, and that is the stated rule rather than
   * a guard against a division: a team that averaged no steals and took three
   * is not up by an infinite percentage, and any number printed there would be
   * made up. The absolute delta is the whole answer in that case.
   */
  ratio: number | null;
  /**
   * Favourable, unfavourable, or `null` — which covers three cases on purpose:
   * it did not move, it cannot be read, or the stat HAS no favourable
   * direction. All three are drawn the same way, because all three mean the
   * same thing to a reader: this figure is a fact, not news.
   */
  better: boolean | null;
}

export interface Highlight {
  key: string;
  /** 'Scoring improved' */
  label: string;
  /** '+6.6 PTS' */
  detail: string;
  better: boolean;
  /** did the FIGURE go up — which is not the same question as `better` */
  rose: boolean;
}

export interface ComparisonGroup {
  key: string;
  title: string;
  rows: CompareRow[];
}

export interface Comparison {
  rows: CompareRow[];
  groups: ComparisonGroup[];
  /** how many games the baseline is made of: 0 when there is nothing to compare */
  baseGames: number;
  /** at most three, biggest relative move first */
  highlights: Highlight[];
}

/** Rounded the way it is printed, so what is compared is what is read. */
const r1 = (n: number): number => Math.round(n * 10) / 10;

const signed = (n: number, dp = 1): string => {
  const v = Number(n.toFixed(dp));
  const s = Number.isInteger(v) ? String(v) : v.toFixed(dp);
  return v > 0 ? `+${s}` : s;
};

/**
 * A figure in a Game or a baseline cell.
 *
 * A PERCENTAGE IS A WHOLE NUMBER HERE, and it is the one place in the app that
 * differs: `lib/stats.ts` keeps its tenth for `eFG%` and true shooting, which
 * are read one at a time in a tile. This table is five columns beside a label
 * on a phone, and it was over-subscribed by about a fifth of the screen —
 * `100.0%` did not fit the Game cell on any device and `44.1%` did not fit on
 * most, so both were printed with an ellipsis where the digits should be. The
 * tenth was the cheapest thing in the row to spend: nobody reads a shooting
 * split to a tenth of a percent off a phone at courtside, and the Change cell
 * beside it still carries the move.
 */
export const figure = (row: CompareRow, v: number | null): string => {
  if (v === null) return '—';
  if (row.kind === 'percent') return `${Math.round(v)}%`;
  if (row.kind === 'ratio') return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/**
 * The Change cell's first half.
 *
 * A percentage row carries its UNIT and the others do not, because it is the
 * kind of row where the reader has to be told which of two things the number
 * is: three points of shooting percentage and three percent of it are
 * different quantities, and the second is the one people assume.
 */
export const deltaLabel = (row: CompareRow): string => {
  if (row.delta === null) return '—';
  // whole points, to match the two figures it is the distance between
  if (row.kind === 'percent') return `${signed(row.delta, 0)} pts`;
  return signed(row.delta, row.kind === 'ratio' ? 2 : 1);
};

/**
 * The Change cell's second half — empty rather than `—` when there is none.
 *
 * AND EMPTY PAST THREE FIGURES, which is the same judgement `MIN_RATIO` and
 * `MIN_ATTEMPTS` already make elsewhere in this file: a player who averaged a
 * fifth of an assist and had six is not up 2,900% in any sense a reader can
 * use, and the four- and five-digit strings that produced were the widest
 * thing this table ever had to draw. The delta beside it still says `+5.8`,
 * which is the honest reading of the same move.
 */
export const RATIO_MAX = 999;

export const ratioLabel = (row: CompareRow): string => {
  if (row.ratio === null) return '';
  const p = Math.round(row.ratio * 100);
  if (Math.abs(p) > RATIO_MAX) return '';
  return p > 0 ? `+${p}%` : `${p}%`;
};

function rowFor(def: StatDef, subject: Line, base: Line[]): CompareRow {
  const sv = valueOf(def, subject);
  const bv = averageOf(def, base);
  const delta = sv === null || bv === null ? null : sv - bv;
  const ratio = delta === null || !bv ? null : delta / bv;

  // `r1` first, so a move too small to be printed is not called a change: a
  // delta of 0.04 renders as `+0.0` and must not be lit as an improvement
  const moved = delta === null ? 0 : r1(delta);

  return {
    key: def.key,
    code: def.code,
    label: def.label,
    kind: def.kind,
    polarity: def.polarity,
    subject: sv,
    base: bv,
    subjectDen: def.den ? def.den(subject) : null,
    baseDen: def.den ? base.reduce((a, l) => a + def.den!(l), 0) : null,
    delta,
    ratio,
    better: moved === 0 || def.polarity === 'none' ? null : moved > 0 === (def.polarity === 'up'),
  };
}

/**
 * THE TWO OR THREE THINGS WORTH SAYING OUT LOUD.
 *
 * Ranked on the RELATIVE move, because that is the reading that compares a
 * turnover with a rebound — six points and six turnovers are the same number
 * and not the same news. Both guards have to pass: the move has to be big
 * enough against the baseline (`MIN_RATIO`) and big enough in its own units
 * (`floor`), which is what keeps an assist average of 0.4 rising to 1 out of a
 * list it would otherwise top.
 *
 * A ROW WITH NO POLARITY IS NEVER NAMED. Six more three-point attempts is a
 * fact about what the team chose to do, and there is no sentence this file can
 * write about it that is not a claim — the table is where it is read.
 *
 * ONE SENTENCE PER AREA, which is what the groups are doing here. Rebounds,
 * offensive rebounds and defensive rebounds are three rows and one piece of
 * news: a night on the glass moves all three, and three sentences saying so
 * would crowd out the two other things that happened. The strongest row in a
 * group speaks for it.
 *
 * IT IS NOT BALANCED ON PURPOSE. Whatever moved most is what is named, so a
 * night where everything went right says so three times rather than inventing
 * a complaint — the tables are where the other side is read.
 */
export function highlightsFor(
  rows: CompareRow[],
  groups: readonly StatGroup[] = TEAM_GROUPS,
  max = 3,
): Highlight[] {
  const defs = new Map(groups.flatMap((g) => g.stats).map((d) => [d.key, d]));
  const areaOf = new Map(groups.flatMap((g) => g.stats.map((d) => [d.key, g.key])));
  const spoken = new Set<string>();

  return rows
    .filter(
      (row) =>
        row.delta !== null &&
        row.ratio !== null &&
        row.better !== null &&
        Math.abs(row.ratio) >= MIN_RATIO &&
        Math.abs(row.delta) >= (defs.get(row.key)?.floor ?? 0) &&
        // THE SPARSE GUARD, and it applies to BOTH samples. A 2-for-4 night
        // against a pooled 38% is a twelve-point "improvement" that four shots
        // cannot support, and a great night measured against a two-attempt
        // baseline is the same lie the other way round.
        (row.subjectDen === null ||
          (row.subjectDen >= MIN_ATTEMPTS && (row.baseDen ?? 0) >= MIN_ATTEMPTS)),
    )
    .sort((a, b) => Math.abs(b.ratio ?? 0) - Math.abs(a.ratio ?? 0))
    .filter((row) => {
      const area = areaOf.get(row.key) ?? row.key;
      if (spoken.has(area)) return false;
      spoken.add(area);
      return true;
    })
    .slice(0, max)
    .map((row) => {
      const def = defs.get(row.key)!;
      const rose = (row.delta ?? 0) > 0;
      return {
        key: row.key,
        label: row.better ? def.better : def.worse,
        // `+6.6 PTS`, and on a shooting row `+3.3 pts FG%` — clumsy, and the
        // clumsiness is `deltaLabel`'s unit doing its job
        detail: `${deltaLabel(row)} ${row.code}`,
        better: row.better!,
        rose,
      };
    });
}

/** The tables and their highlights, from one line and the baseline behind it. */
export function compare(
  subject: Line,
  base: Line[],
  groups: readonly StatGroup[] = TEAM_GROUPS,
): Comparison {
  const built = groups.map((g) => ({
    key: g.key,
    title: g.title,
    rows: g.stats.map((d) => rowFor(d, subject, base)),
  }));
  const rows = built.flatMap((g) => g.rows);
  return { rows, groups: built, baseGames: base.length, highlights: highlightsFor(rows, groups) };
}

/**
 * THE SENTENCE THAT KEEPS THE SHOOTING TABLE HONEST.
 *
 * It is not decoration and must not be dropped: the baseline is POOLED on
 * every rate row and MEANED on every count, and a reader who assumes one rule
 * for the whole column will read half the table wrong. It is the same argument
 * as the stats screen's note under POINTS FROM TURNOVERS.
 *
 * THERE IS NO NOTE WHEN THE BASELINE IS ONE GAME, because there is nothing to
 * say: pooling one game and meaning one game are the same figure, and the row
 * above the table already names which game it is.
 */
export const poolNote = (n: number): string => {
  if (n === 0) return 'No other official games to compare against yet.';
  if (n === 1) return '';
  return `Averaged over the ${n} other official games. Percentages and assists per turnover are pooled — the makes over the attempts across those games — not the mean of each game's own figure.`;
};

/**
 * THIS GAME AGAINST THE OTHERS.
 *
 * `others` is the season's own games — official, in the season's own order,
 * filtered by the caller exactly as `season()` is handed them. THE SUBJECT IS
 * DROPPED OUT OF IT HERE rather than at the call site: it is the one rule in
 * this file that produces plausible numbers for ever when it is got wrong, and
 * the screen now picks the subject out of the very list it hands in.
 *
 * A baseline of ONE game is a comparison with that game — the same arithmetic,
 * not a second mode. An EMPTY baseline is not null: it is the game's own
 * figures with `—` beside them, which is what a scorer one game into a season
 * should see.
 */
export function teamComparison(subject: GameState, others: GameState[]): Comparison {
  return compare(teamLine(subject), others.filter((g) => g !== subject).map(teamLine), TEAM_GROUPS);
}

/**
 * ONE PLAYER'S LAST GAME AGAINST EVERY OTHER GAME THEY PLAYED.
 *
 * THE BASELINE IS THE GAMES THEY APPEARED IN, which is the denominator
 * `lib/season.ts` uses everywhere and for the reason it is used there: a
 * player is not having a worse run because the team played a game without
 * them, and averaging a DNP in as a zero line is exactly that. It also means
 * "their last game" is the last one they played rather than the team's — a
 * card that read `—` across because somebody was injured on Saturday would be
 * telling them nothing about their own form.
 *
 * `null` when they have never appeared, which is what draws no card at all.
 */
export function playerComparison(games: GameState[], playerId: string): Comparison | null {
  const lines: Line[] = [];
  for (const g of games) {
    const p = g.players.find((q) => q.id === playerId);
    if (!p || !appeared(p)) continue;
    lines.push(playerLine(p));
  }
  if (lines.length === 0) return null;
  return compare(lines[0], lines.slice(1), PLAYER_GROUPS);
}

/**
 * WHO PLAYED ABOVE OR BELOW THEIR OWN NORMAL — one row per player who was on
 * the sheet, five figures each.
 *
 * EVERY PLAYER IS MEASURED AGAINST THEMSELVES, never against each other, and
 * the rows are in the GAME's own order with nothing ranked. A table sorted by
 * who beat their average hardest says the twelfth man had the best night every
 * time he plays twice, and this app does not rank people — the same argument
 * the ZONES tab's attempt bars carry.
 *
 * A player with no other appearance keeps their row and gets dashes rather
 * than being dropped: they played in this game, and a sheet that quietly loses
 * a name cannot be reconciled with the box score beside it.
 */
export interface ImpactRow {
  id: string;
  number: number;
  name: string;
  cells: CompareRow[];
  /** how many other games this player's baseline is made of */
  baseGames: number;
}

export function playerImpact(subject: GameState, others: GameState[]): ImpactRow[] {
  const pool = others.filter((g) => g !== subject);

  return subject.players
    .filter((p) => appeared(p))
    .map((p) => {
      const base: Line[] = [];
      for (const g of pool) {
        const q = g.players.find((x) => x.id === p.id);
        if (q && appeared(q)) base.push(playerLine(q));
      }
      const mine = playerLine(p);
      return {
        id: p.id,
        number: p.number,
        name: p.name,
        cells: PLAYER_STATS.map((d) => rowFor(d, mine, base)),
        baseGames: base.length,
      };
    });
}

/**
 * POINTS BY PERIOD, against the same period in the baseline.
 *
 * IT IS DROPPED, NOT FAKED, when the baseline was played to a different SHAPE.
 * A half is not a quarter, and averaging what a team scored in `H1` into what
 * it scored in `Q1` would put two different lengths of basketball in one
 * column — so the baseline is narrowed to the games whose regulation matches
 * the subject's, and a period no such game reached prints `—`. It is the same
 * rule `GameFlow` follows when a game carries no clock: what cannot be drawn
 * honestly is not drawn.
 *
 * A PERIOD IS AVERAGED OVER THE GAMES THAT REACHED IT. Four games and one
 * overtime is an overtime average of one game, not of four — the other three
 * did not score nothing in it, they never played it.
 */
export function periodRows(subject: GameState, others: GameState[]): CompareRow[] | null {
  const reg = regOf(subject);
  const mine = periodScores(subject);
  if (mine.length === 0) return null;

  const pool = others.filter((g) => g !== subject && regOf(g) === reg).map(periodScores);

  return mine.map((q) => {
    const seen = pool.flatMap((ps) => ps.filter((r) => r.period === q.period));
    const base = seen.length ? seen.reduce((a, r) => a + r.us, 0) / seen.length : null;
    const delta = base === null ? null : q.us - base;
    const moved = delta === null ? 0 : r1(delta);
    return {
      key: `p${q.period}`,
      code: q.label,
      label: q.label,
      kind: 'count',
      polarity: 'up',
      subject: q.us,
      base,
      subjectDen: null,
      baseDen: null,
      delta,
      ratio: delta === null || !base ? null : delta / base,
      better: moved === 0 ? null : moved > 0,
    };
  });
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
