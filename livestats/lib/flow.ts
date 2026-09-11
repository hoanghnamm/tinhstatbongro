/**
 * THE SHAPE OF THE NIGHT — the score as a curve, and the score as a table.
 *
 * Two readings of one question: WHEN DID THE LEAD CHANGE. The curve answers it
 * at a glance and the table answers it exactly, and the table is not a
 * fallback for the curve — it is the curve's textual equivalent, printed
 * underneath it every time, because a step chart four hundred pixels wide
 * cannot be read to the point and a scorer at a timeout is reading to the
 * point.
 *
 * FOUR DECISIONS, and three of them are about not lying with a time axis:
 *
 *   THE MARGIN IS OURS MINUS THEIRS, and it is drawn as a STEP, never a
 *   smoothed curve. Nothing happened between two baskets; a spline through
 *   them invents a slope and the slope is the thing people read.
 *
 *   ORDER SURVIVES A CORRECTED CLOCK. `absOf` reads the period and the clock
 *   off each event, and a clock set by hand can put a later event earlier on
 *   the game's own timeline. The walk therefore clamps each stamp forward to
 *   the one before it — the log's order is the truth about what happened
 *   first, and the clock is only the truth about roughly when.
 *
 *   A GAME WITH NO USABLE CLOCK GETS NO TIME AXIS. If every basket carries the
 *   same stamp, an x in seconds is false precision, and `timed` says so; the
 *   screen then draws the quarter table alone.
 *
 *   THE RUNNING TOTAL MUST MEET THE SCOREBOARD. `reconciled` compares the last
 *   mark with the board's own `score` / `oppScore`. They come from the same
 *   taps and should always agree; if they ever do not, the chart is the one
 *   that is wrong, and a chart that ends on a score the game never held is
 *   worse than no chart.
 *
 * Plain functions over a plain `GameState`, on the same side of the line as
 * `box.ts` and `analysis.ts` — no React, no store, no device.
 */
import { eventsIn, gameElapsed, lenOf, periodsOf, scoreline } from './box';
import { mmss, periodLabel } from './format';
import type { GameState } from '../types';

/* ------------------------------------------------------------------ *
 * The quarter table
 * ------------------------------------------------------------------ */

export interface PeriodScore {
  period: number;
  /** the GAME's own word for it — `Q3`, `H1`, `OT2` */
  label: string;
  us: number;
  them: number;
  /** the game is still standing in this one, so the row is not final */
  live: boolean;
}

/**
 * Every period the game reached, with what each side scored in it.
 *
 * Built off the log rather than off `linesFor`, because THEIR points are only
 * ever events — the opponent has no box score to add up — and reading our half
 * one way and theirs another is how two halves of one row come to disagree.
 */
export function periodScores(g: GameState): PeriodScore[] {
  return periodsOf(g).map((p) => {
    let us = 0;
    let them = 0;
    for (const e of eventsIn(g.events, p)) {
      if (e.type === 'oppPoint') them += e.value;
      else if ((e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made') us += e.value;
    }
    return {
      period: p,
      label: periodLabel(p, g.periods),
      us,
      them,
      live: !g.ended && p === g.period,
    };
  });
}

/* ------------------------------------------------------------------ *
 * The step chart
 * ------------------------------------------------------------------ */

export interface FlowPoint {
  /** game time elapsed, clamped forward so the walk never runs backwards */
  at: number;
  period: number;
  us: number;
  them: number;
  /** ours minus theirs — positive is our lead */
  margin: number;
}

export interface Flow {
  /** the 0-0 seed first, then one point per score */
  points: FlowPoint[];
  /** period boundaries in elapsed seconds, ends excluded */
  bounds: number[];
  /** how far the game has got, in seconds */
  end: number;
  /** the biggest absolute margin the axis has to hold, never below 1 */
  span: number;
  /** false when the clock stamps cannot carry an x axis */
  timed: boolean;
  /** the running total meets the board's own score */
  reconciled: boolean;
  us: number;
  them: number;
}

export function flowOf(g: GameState): Flow {
  const len = lenOf(g);
  const end = gameElapsed(g);

  let at = 0;
  const points: FlowPoint[] = scoreline(g.events, len).map((mk) => {
    // forward only, and never past the point the game has actually reached
    at = Math.max(at, Math.min(mk.at, end));
    return { at, period: mk.period, us: mk.us, them: mk.them, margin: mk.us - mk.them };
  });

  const last = points[points.length - 1];
  const span = points.reduce((n, p) => Math.max(n, Math.abs(p.margin)), 0);

  return {
    points,
    bounds: periodsOf(g)
      .slice(0, -1)
      .map((p) => p * len)
      .filter((b) => b > 0 && b < end),
    end,
    span: Math.max(1, span),
    // the seed sits at zero, so this asks whether ANYTHING was scored at a
    // time the clock could tell apart from the tip
    timed: end > 0 && points.some((p) => p.at > 0),
    reconciled: last.us === g.score && last.them === g.oppScore,
    us: last.us,
    them: last.them,
  };
}

/**
 * A point on the axis, said the way the board says it — `Q3 06:12`.
 *
 * A stamp landing exactly on `p * len` is that period's BUZZER and not the
 * next period's tip, which is why the period is a ceiling rather than a floor:
 * the last basket of a quarter belongs to the quarter it was scored in.
 */
export const stampOf = (at: number, len: number, regulation: number): string => {
  const period = at <= 0 ? 1 : Math.ceil(at / len);
  return `${periodLabel(period, regulation)} ${mmss(Math.max(0, period * len - at))}`;
};
