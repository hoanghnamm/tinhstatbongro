import { ZONES } from '../constants/game';
import { pct1 } from './format';
import type { GameEvent, Player, Zone } from '../types';

export interface Totals {
  pts: number;
  fgm: number;
  fga: number;
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
  pf: number;
  tf: number;
  fl: number;
}

export function totals(players: Player[]): Totals {
  return players.reduce<Totals>(
    (a, p) => {
      const s = p.stats;
      a.pts += s.points;
      a.fgm += s.fgMade;
      a.fga += s.fgAttempted;
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
      a.pf += s.fouls;
      a.tf += s.technicals;
      a.fl += s.flagrants;
      return a;
    },
    {
      pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
      oreb: 0, dreb: 0, reb: 0, ast: 0, to: 0, st: 0, bs: 0, pf: 0, tf: 0, fl: 0,
    },
  );
}

/** eFG treats a three as 1.5 field goals. */
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
