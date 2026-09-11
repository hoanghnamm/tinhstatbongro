/**
 * WHAT STANDS OUT — at most two sentences, every one of them a count.
 *
 * This is the one place in the app that writes prose about a game, so it is
 * also the one place that could tell a scorer something the board never
 * recorded. It does not. Every rule here is a threshold over numbers the log
 * actually holds, and every sentence it produces names the numbers it was
 * built from — `5 of 9 turnovers came in Q3.` is a fact a reader can go and
 * check, where `bad passing cost the game` is a guess about a cause this app
 * has no way to observe.
 *
 * FIVE DECISIONS:
 *
 *   NO CAUSES, NO ADVICE, NO VERDICTS. The board knows a turnover happened; it
 *   does not know it was a bad pass, and it certainly does not know whether
 *   the team should stop shooting threes. A sentence here says WHAT and WHEN
 *   and nothing else.
 *
 *   TWO AT MOST, AND ZERO IS A REAL ANSWER. A quiet game gets no card. Filling
 *   the block with the least uninteresting thing available is how a panel of
 *   observations turns into decoration nobody reads.
 *
 *   THE ORDER IS FIXED, NOT SCORED. The rules are listed worst-news-first and
 *   the first two that fire are the two that print. A weight would have to
 *   compare a scoring run with a free-throw line in some common unit, and
 *   there is no such unit — a made-up one would only make the ordering look
 *   principled without making it so.
 *
 *   A PERCENTAGE NEEDS A SAMPLE. Both shooting rules are gated on
 *   `MIN_ATTEMPTS`, the same review threshold `highlightsFor` uses.
 *
 *   AN OBSERVATION THAT NAMES A PERIOD CARRIES IT. `split` is what the screen
 *   moves the quarter filter to, so the sentence is not the end of the trail —
 *   it is the way into the rows and the play log that produced it.
 */
import { MIN_ATTEMPTS } from './analysis';
import { eventsIn, lenOf, scoreline, type Split } from './box';
import { periodLabel } from './format';
import { totals } from './stats';
import type { GameState } from '../types';

/** How many print. The rest of the list is still true; it is just not news. */
export const OBS_MAX = 2;

/* -- the thresholds, all of them arbitrary and all of them written down ---
 * Provisional product guards rather than statistics: they are the point at
 * which a scorer would plausibly look, and they are named so that moving one
 * is an edit to a number rather than an edit to a rule. */

/** Turnovers a game needs before WHERE they happened is worth a sentence… */
const TO_MIN = 6;
/** …and how many of them one period must hold, both as a share and outright. */
const TO_SHARE = 0.5;
const TO_FLOOR = 3;
/** An unanswered stretch worth naming — theirs is lower, because it is worse. */
const RUN_THEM = 8;
const RUN_US = 10;
/** The gap between our two shooting splits, in percentage POINTS. */
const SPLIT_GAP = 10;
/** Free throws left behind before the line is worth a sentence. */
const FT_MISS = 5;

export interface Observation {
  /** stable per rule, so React has a key and a test has a name */
  key: string;
  /** the sentence, exactly as it is printed */
  text: string;
  /** the slice holding the evidence — `null` when the whole game is */
  split: Split;
}

/** The longest unanswered run each side put together, and where it ended. */
interface Run {
  points: number;
  period: number;
}

export function runsOf(g: GameState): { us: Run; them: Run } {
  const best = { us: { points: 0, period: 1 }, them: { points: 0, period: 1 } };
  let side: 'us' | 'them' | null = null;
  let points = 0;

  for (const mk of scoreline(g.events, lenOf(g))) {
    if (!mk.side) continue; // the 0-0 seed belongs to neither
    if (mk.side === side) points += mk.value;
    else {
      side = mk.side;
      points = mk.value;
    }
    const b = best[mk.side];
    // the period the run REACHED its length in, which is the one to open: a
    // run that crosses a buzzer is read back from where it finished
    if (points > b.points) {
      b.points = points;
      b.period = mk.period;
    }
  }
  return best;
}

/** Turnovers per period, and the total, in one walk. */
function turnoversBy(g: GameState): { total: number; worst: number; count: number } {
  const by = new Map<number, number>();
  let total = 0;
  for (const e of g.events) {
    if (e.type !== 'turnover') continue;
    total++;
    by.set(e.period, (by.get(e.period) ?? 0) + 1);
  }
  let worst = 0;
  let count = 0;
  // ascending, so a tie between two periods names the earlier one
  for (const p of [...by.keys()].sort((a, b) => a - b)) {
    const n = by.get(p) ?? 0;
    if (n > count) {
      count = n;
      worst = p;
    }
  }
  return { total, worst, count };
}

/**
 * Every rule that fired, worst news first. The screen prints `OBS_MAX` of
 * them; the whole list is returned so a test can read the ones that lost.
 */
export function observations(g: GameState): Observation[] {
  const out: Observation[] = [];
  const T = totals(g.players);
  const word = (p: number): string => periodLabel(p, g.periods);

  /* 1. THEIR RUN. The one thing on this list a coach would want first. */
  const runs = runsOf(g);
  if (runs.them.points >= RUN_THEM) {
    out.push({
      key: 'oppRun',
      text: `The opponent scored ${runs.them.points} unanswered points in ${word(runs.them.period)}.`,
      split: runs.them.period,
    });
  }

  /* 2. WHERE WE GAVE IT AWAY — a count and its denominator, never a rate. */
  const to = turnoversBy(g);
  if (to.total >= TO_MIN && to.count >= TO_FLOOR && to.count >= to.total * TO_SHARE) {
    out.push({
      key: 'turnovers',
      text: `${to.count} of ${to.total} turnovers came in ${word(to.worst)}.`,
      split: to.worst,
    });
  }

  /* 3. THE LINE. Misses, stated as misses: `10/18` is the conversion and `8`
        is the opportunity, and the second is the one that goes uncounted. */
  if (T.fta >= MIN_ATTEMPTS && T.fta - T.ftm >= FT_MISS) {
    out.push({
      key: 'freeThrows',
      text: `Free throws: ${T.ftm}/${T.fta}, with ${T.fta - T.ftm} misses.`,
      split: null,
    });
  }

  /* 4. THE TWO SPLITS, SIDE BY SIDE AND UNJUDGED. Both need their own sample,
        and the sentence carries no verdict about which one to take more of —
        where those attempts came from is the zone tab's answer, not a
        sentence's. */
  if (T.twoa >= MIN_ATTEMPTS && T.tpa >= MIN_ATTEMPTS) {
    const gap = Math.abs((T.twom / T.twoa) * 100 - (T.tpm / T.tpa) * 100);
    if (gap >= SPLIT_GAP) {
      out.push({
        key: 'split',
        text: `Three-pointers: ${T.tpm}/${T.tpa}; two-pointers: ${T.twom}/${T.twoa}.`,
        split: null,
      });
    }
  }

  /* 5. OUR RUN, last, and with a higher bar than theirs. */
  if (runs.us.points >= RUN_US) {
    out.push({
      key: 'ourRun',
      text: `We scored ${runs.us.points} unanswered points in ${word(runs.us.period)}.`,
      split: runs.us.period,
    });
  }

  return out;
}

/** What the screen draws: the first `OBS_MAX`, or nothing at all. */
export const standouts = (g: GameState): Observation[] =>
  observations(g).slice(0, OBS_MAX);

/**
 * The evidence behind an observation that names a period: how many events of
 * the kind it is about that slice holds. The screen does not print this — it
 * is here so `npm run check` can assert a sentence against the log rather than
 * against another copy of the same arithmetic.
 */
export const turnoversIn = (g: GameState, split: Split): number =>
  eventsIn(g.events, split).filter((e) => e.type === 'turnover').length;
