import { ZONES } from '../constants/game';
import { pct1 } from './format';
import type { GameEvent, Player, PlayerStats, Zone } from '../types';

export interface Totals {
  pts: number;
  fgm: number;
  fga: number;
  /** the two-point split, which the FG line alone cannot be read back into */
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
  st: number;
  bs: number;
  /** fouls drawn — the other side of PF, and its own tally */
  fd: number;
  pf: number;
  tf: number;
  fl: number;
  /** seconds, not minutes: formatted once, at the edge, by `mmss` */
  sec: number;
  pm: number;
  ef: number;
}

/**
 * The real plus-minus. Both halves are counted the same way — every point,
 * ours and theirs, is credited to the five standing on the floor when it went
 * up — so this is a plus-minus and not the half of one the board shows as ON.
 *
 * The `?? 0` is not decoration: a game persisted before the against-half
 * existed rehydrates without the key, and a missing number would make the
 * whole line read `NaN` rather than merely read low.
 */
export const plusMinus = (s: PlayerStats): number =>
  (s.onCourtPoints ?? 0) - (s.onCourtOppPoints ?? 0);

/**
 * Efficiency, the one-number line every box score in the world prints:
 * everything you did minus everything you wasted. A missed shot, a missed free
 * throw and a turnover are the three ways to waste a possession, so those are
 * the three subtractions.
 */
export const efficiency = (s: PlayerStats): number =>
  s.points +
  s.offensiveRebounds +
  s.defensiveRebounds +
  s.assists +
  s.steals +
  s.blocks -
  (s.fgAttempted - s.fgMade) -
  (s.ftAttempted - s.ftMade) -
  s.turnovers;

export function totals(players: Player[]): Totals {
  return players.reduce<Totals>(
    (a, p) => {
      const s = p.stats;
      a.pts += s.points;
      a.fgm += s.fgMade;
      a.fga += s.fgAttempted;
      a.twom += s.twoMade;
      a.twoa += s.twoAttempted;
      a.tpm += s.threeMade;
      a.tpa += s.threeAttempted;
      a.ftm += s.ftMade;
      a.fta += s.ftAttempted;
      a.oreb += s.offensiveRebounds;
      a.dreb += s.defensiveRebounds;
      a.reb += s.offensiveRebounds + s.defensiveRebounds;
      a.ast += s.assists;
      a.to += s.turnovers;
      a.st += s.steals;
      a.bs += s.blocks;
      a.fd += s.foulsDrawn;
      a.pf += s.fouls;
      a.tf += s.technicals;
      a.fl += s.flagrants;
      a.sec += s.secondsPlayed;
      a.pm += plusMinus(s);
      a.ef += efficiency(s);
      return a;
    },
    {
      pts: 0, fgm: 0, fga: 0, twom: 0, twoa: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
      oreb: 0, dreb: 0, reb: 0, ast: 0, to: 0, st: 0, bs: 0, fd: 0,
      pf: 0, tf: 0, fl: 0, sec: 0, pm: 0, ef: 0,
    },
  );
}

/**
 * eFG treats a three as 1.5 field goals, which is the whole of it: a 3-for-10
 * night from the arc and a 3-for-10 night from the elbow are the same FG% and
 * are not the same shooting.
 *
 * IT IS NOT CAPPED. There is no arithmetic that puts it over 100 — that would
 * need more threes than field goals — so a clamp here would only hide a
 * counting bug rather than a real reading.
 *
 * The number and the string are two exports because two callers need two
 * things: the headline tile prints it, and the screen that decides whether it
 * is worth printing has to compare it.
 */
export const efgValue = (t: Totals): number | null =>
  t.fga ? ((t.fgm + 0.5 * t.tpm) / t.fga) * 100 : null;

export const efg = (t: Totals): string => (t.fga ? pct1(t.fgm + 0.5 * t.tpm, t.fga) : '-');

/** TS charges 0.44 of a possession per free throw attempt. */
export const ts = (t: Totals): string =>
  t.fga + 0.44 * t.fta ? ((t.pts / (2 * (t.fga + 0.44 * t.fta))) * 100).toFixed(1) + '%' : '-';

export type ZoneSplit = Record<Zone, { m: number; a: number }>;

export function zoneSplits(events: GameEvent[]): ZoneSplit {
  const z = Object.fromEntries(ZONES.map((k) => [k, { m: 0, a: 0 }])) as ZoneSplit;
  for (const e of events) {
    if (e.type !== 'shot' || !e.zone || !z[e.zone]) continue;
    z[e.zone].a++;
    if (e.result === 'made') z[e.zone].m++;
  }
  return z;
}

/**
 * Points scored in the possession that followed one of our steals. The window
 * closes on a score, a turnover, a defensive rebound or a foul — and on an
 * opponent basket, which is the one thing the opponent's single number does
 * help with. An unlogged opponent board can leave it open, so this reads high
 * in sloppy record-keeping.
 */
export function ptsOffSteals(events: GameEvent[]): number {
  let total = 0,
    armed = false;
  for (const e of events) {
    if (e.type === 'steal') {
      armed = true;
      continue;
    }
    if (!armed) continue;
    // an oppPoint's `value` is THEIR points, so the type is checked first
    if (e.type === 'turnover' || e.type === 'foul' || e.type === 'oppPoint') armed = false;
    else if ('value' in e && e.value) {
      total += e.value;
      armed = false;
    } else if (e.type === 'rebound' && e.reboundType === 'defensive') armed = false;
  }
  return total;
}
