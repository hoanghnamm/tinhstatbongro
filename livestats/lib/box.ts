/**
 * The post-game report: the same game, sliced by quarter.
 *
 * The board's counters are the truth about the WHOLE game and say nothing
 * about when a number happened, so everything per-quarter here is rebuilt from
 * `state.events` instead — which is exactly what the append-only log is for.
 * Two things that are not counted on an event have to be reconstructed, and
 * both come out of the same walk:
 *
 *   THE FLOOR. `player.starter` is who tipped off, and every `substitution`
 *   and `foulOut` after it moves one name. Replaying those in order gives the
 *   five who were standing there at any point in the log — which is what a
 *   quarter's plus-minus is made of.
 *
 *   THE CLOCK. Every event carries the period and the game clock it happened
 *   on, so the gap between two consecutive events is game time that the floor
 *   between them played. That is the same second the live ticker credits, so
 *   the quarters add up to the whole-game minutes rather than competing with
 *   them.
 *
 * One approximation, stated out loud: a gap that spans the end of a period is
 * credited as if the period ran out. It is the right guess — a quarter almost
 * always ends on 0:00, whereas two minutes with nothing logged in them are
 * ordinary — but a quarter ENDED EARLY hands its unplayed tail to whoever was
 * on the floor.
 *
 * `split` is the one argument every reader here takes: a period number, or
 * null for the whole game. Null does NOT re-derive — it returns the board's
 * own counters, because those are authoritative and are what UNDO maintains.
 */
import { FOUL_KINDS, PERIOD_LEN, TALLY, ZONES, zeroStats } from '../constants/game';
import { totals, zoneSplits, type Totals, type ZoneSplit } from './stats';
import type { GameEvent, GameState, Player, PlayerStats, Zone } from '../types';

/** A period number, or null for the whole game. */
export type Split = number | null;

/** Points scored this close behind a steal or a defensive rebound are a break. */
export const BREAK_WINDOW = 7;

/** 'mm:ss' back to seconds. The log writes it with `mmss`, so it always parses. */
export const clockSeconds = (clock: string): number => {
  const [m, s] = clock.split(':');
  return Number(m) * 60 + Number(s);
};

/**
 * HOW LONG A PERIOD OF THIS GAME WAS, and it is asked of the GAME rather than
 * of `constants/game.ts`, because it is settable now — see `GameState.periods`.
 * A game read off disk that was saved before it was settable was played to ten
 * minutes, which is what the board was hardcoded to; the fallback lives here
 * rather than at every call site so no reader can forget it.
 */
export const lenOf = (g: { periodLen?: number }): number => g.periodLen || PERIOD_LEN;

/**
 * Game time elapsed when an event happened, counted from the opening tip.
 *
 * The length is passed in rather than read off a constant: an event carries a
 * period and a clock, and neither says how long a period is. Every caller has
 * the game in hand and gets it from `lenOf`.
 */
export const absOf = (e: { period: number; gameClock: string }, len: number): number =>
  (e.period - 1) * len + (len - clockSeconds(e.gameClock));

/** …and the same number for right now, which is where the last gap ends. */
export const gameElapsed = (g: GameState): number => {
  const len = lenOf(g);
  return (g.period - 1) * len + (len - g.remaining);
};

/**
 * Every period the game has reached. The clock's period leads the log — a
 * quarter with nothing logged in it is still a quarter that was played.
 */
export function periodsOf(g: GameState): number[] {
  const last = g.events.reduce((n, e) => Math.max(n, e.period), g.period);
  return Array.from({ length: Math.max(1, last) }, (_, i) => i + 1);
}

export const inSplit = (e: { period: number }, split: Split): boolean =>
  split === null || e.period === split;

export const eventsIn = (events: GameEvent[], split: Split): GameEvent[] =>
  split === null ? events : events.filter((e) => e.period === split);

/* ------------------------------------------------------------------ *
 * The floor, replayed
 * ------------------------------------------------------------------ */

/** The five who tipped off. `starter` is stamped once, by `buildPlayers`. */
const startingFloor = (g: GameState): Set<string> =>
  new Set(g.players.filter((p) => p.starter).map((p) => p.id));

/** One event's effect on who is standing there — and nothing else. */
function moveFloor(floor: Set<string>, e: GameEvent): void {
  if (e.type === 'substitution') {
    floor.delete(e.outPlayerId);
    floor.add(e.playerId);
  } else if (e.type === 'foulOut') {
    floor.delete(e.playerId);
  }
}

/** Every counting stat one event is worth, for the player it names. */
function applyCounts(s: PlayerStats, e: GameEvent): void {
  switch (e.type) {
    case 'shot': {
      s.fgAttempted++;
      if (e.shotType === '3PT') s.threeAttempted++;
      else s.twoAttempted++;
      if (e.result !== 'made') return;
      s.fgMade++;
      if (e.shotType === '3PT') s.threeMade++;
      else s.twoMade++;
      s.points += e.value;
      return;
    }
    case 'freeThrow': {
      s.ftAttempted++;
      if (e.result === 'made') {
        s.ftMade++;
        s.points += e.value;
      }
      return;
    }
    case 'assist':
      s.assists++;
      return;
    case 'rebound':
      if (e.reboundType === 'offensive') s.offensiveRebounds++;
      else s.defensiveRebounds++;
      return;
    case 'foul': {
      if (FOUL_KINDS[e.foulKind].dq) s.fouls++;
      if (e.foulKind === 'technical') s.technicals++;
      if (e.foulKind === 'flagrant') s.flagrants++;
      if (e.foulKind === 'offensive') s.offensiveFouls++;
      if (e.foulKind === 'shooting') s.shootingFouls++;
      return;
    }
    case 'turnover':
    case 'steal':
    case 'block':
    case 'foulDrawn':
      (s[TALLY[e.type]] as number)++;
      return;
    default:
      return;
  }
}

/**
 * The box score for one slice. A period is rebuilt from the log; the whole
 * game is the board's own counters, untouched — they are what `undo()` keeps
 * correct, and re-deriving them would only invite the two to disagree.
 */
export function linesFor(g: GameState, split: Split): Player[] {
  if (split === null) return g.players;

  const stats = new Map(g.players.map((p) => [p.id, zeroStats()]));
  const floor = startingFloor(g);
  const len = lenOf(g);
  const from = (split - 1) * len;
  const to = split * len;
  const end = gameElapsed(g);
  let at = 0;

  /** Credit the floor with the part of a gap that falls inside this period. */
  const played = (a: number, b: number): void => {
    const lo = Math.max(a, from);
    const hi = Math.min(b, to, end);
    if (hi <= lo) return;
    for (const id of floor) {
      const s = stats.get(id);
      if (s) s.secondsPlayed += hi - lo;
    }
  };

  /** Points, either way, land on the five who were out there. */
  const onFloor = (key: 'onCourtPoints' | 'onCourtOppPoints', value: number): void => {
    for (const id of floor) {
      const s = stats.get(id);
      if (s) s[key] += value;
    }
  };

  for (const e of g.events) {
    // a clock corrected forwards must not rewind the walk
    const t = Math.min(absOf(e, len), end);
    if (t > at) {
      played(at, t);
      at = t;
    }
    if (e.period === split) {
      if (e.playerId) {
        const s = stats.get(e.playerId);
        if (s) applyCounts(s, e);
      }
      if (e.type === 'oppPoint') onFloor('onCourtOppPoints', e.value);
      else if ((e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made')
        onFloor('onCourtPoints', e.value);
    }
    moveFloor(floor, e);
  }
  played(at, end);

  return g.players.map((p) => ({ ...p, stats: stats.get(p.id) ?? zeroStats() }));
}

/* ------------------------------------------------------------------ *
 * The scoreboard, replayed
 *
 * Six of the team numbers are not about a stat at all — they are about the
 * SHAPE of the score: how far ahead it got, how many points went by without a
 * reply, how often it turned over. All six come off one running scoreline, so
 * it is built once and read six ways.
 * ------------------------------------------------------------------ */

export interface ScoreMark {
  at: number;
  period: number;
  us: number;
  them: number;
  /** whose points these were — the seed entry belongs to neither */
  side: 'us' | 'them' | null;
  value: number;
}

export function scoreline(events: GameEvent[], len: number = PERIOD_LEN): ScoreMark[] {
  const marks: ScoreMark[] = [{ at: 0, period: 1, us: 0, them: 0, side: null, value: 0 }];
  let us = 0;
  let them = 0;
  for (const e of events) {
    const ours = (e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made';
    if (!ours && e.type !== 'oppPoint') continue;
    if (ours) us += e.value;
    else them += e.value;
    marks.push({
      at: absOf(e, len),
      period: e.period,
      us,
      them,
      side: ours ? 'us' : 'them',
      value: e.value,
    });
  }
  return marks;
}

export interface TeamAdvanced {
  paint: number;
  secondChance: number;
  fastBreak: number;
  offTurnovers: number;
  bench: number;
  biggestLead: number;
  oppBiggestLead: number;
  biggestRun: number;
  oppBiggestRun: number;
  leadChanges: number;
  timesTied: number;
  /** seconds, ours */
  timeAhead: number;
  /** null when the possession count cannot be attributed to the slice */
  ppp: number | null;
}

/**
 * The team's advanced line for one slice.
 *
 * Three of these are DERIVED FROM THE LOG'S SHAPE rather than tapped, and the
 * screen says so under them:
 *
 *   PTS OFF TURNOVERS is points off the turnovers we forced, because a steal
 *   is the only opponent turnover this board hears about.
 *   SECOND CHANCE is points scored after one of our offensive rebounds, before
 *   the possession ends.
 *   FAST BREAK is points scored within `BREAK_WINDOW` seconds of a steal or a
 *   defensive rebound — a window on the clock, not a tap, so a stopped clock
 *   makes it read high.
 */
export function advancedFor(g: GameState, split: Split, lines: Player[]): TeamAdvanced {
  const a: TeamAdvanced = {
    paint: 0, secondChance: 0, fastBreak: 0, offTurnovers: 0, bench: 0,
    biggestLead: 0, oppBiggestLead: 0, biggestRun: 0, oppBiggestRun: 0,
    leadChanges: 0, timesTied: 0, timeAhead: 0, ppp: null,
  };

  for (const p of lines) if (!p.starter) a.bench += p.stats.points;

  const len = lenOf(g);

  /* -- the possession windows -------------------------------------
   * Each is opened by the play that starts it and closed by the next thing
   * that ends a possession; only points inside an open window count. */
  let second = false;
  let steal = false;
  let breakAt: number | null = null;

  for (const e of g.events) {
    const mine = inSplit(e, split);
    const scored = (e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made';
    const t = absOf(e, len);

    if (scored && mine) {
      if (e.type === 'shot' && e.zone === 'paint') a.paint += e.value;
      if (second) a.secondChance += e.value;
      if (steal) a.offTurnovers += e.value;
      if (breakAt !== null && t - breakAt <= BREAK_WINDOW) a.fastBreak += e.value;
    }

    if (scored) {
      if (e.type === 'shot') second = false; // the possession ended with the shot
      steal = false;
      breakAt = null;
      continue;
    }
    switch (e.type) {
      case 'rebound':
        second = e.reboundType === 'offensive';
        steal = false;
        breakAt = e.reboundType === 'defensive' ? t : null;
        break;
      case 'steal':
        second = false;
        steal = true;
        breakAt = t;
        break;
      case 'turnover':
      case 'oppPoint':
        second = false;
        steal = false;
        breakAt = null;
        break;
      case 'foul':
        // a foul stops the break, but not the trip to the line it sends us on
        steal = false;
        breakAt = null;
        break;
      default:
        break;
    }
  }

  /* -- the shape of the score ------------------------------------- */
  const marks = scoreline(g.events, len);
  const now = gameElapsed(g);
  const from = split === null ? 0 : (split - 1) * len;
  const to = split === null ? Infinity : split * len;

  let run: { side: string; points: number } = { side: '', points: 0 };
  let prev: ScoreMark | null = null;

  for (const mk of marks) {
    const margin = mk.us - mk.them;
    const before = prev ? prev.us - prev.them : 0;
    const carry = mk.at < from; // the margin brought INTO the period

    if (split === null || mk.period === split || carry) {
      a.biggestLead = Math.max(a.biggestLead, margin);
      a.oppBiggestLead = Math.max(a.oppBiggestLead, -margin);
    }
    // a run and a lead change are things that HAPPEN, so neither is carried in
    if (!carry && (split === null || mk.period === split)) {
      if (mk.side) {
        if (run.side === mk.side) run.points += mk.value;
        else run = { side: mk.side, points: mk.value };
        if (mk.side === 'us') a.biggestRun = Math.max(a.biggestRun, run.points);
        else a.oppBiggestRun = Math.max(a.oppBiggestRun, run.points);
      }
      if (prev) {
        if (margin === 0 && before !== 0) a.timesTied++;
        else if (margin !== 0 && before !== 0 && Math.sign(margin) !== Math.sign(before))
          a.leadChanges++;
        else if (margin !== 0 && before === 0 && prev.side !== null) a.leadChanges++;
      }
    }

    // the stretch the PREVIOUS mark held, clipped to the window
    if (prev) {
      const lo = Math.max(prev.at, from);
      const hi = Math.min(mk.at, to, now);
      if (hi > lo && before > 0) a.timeAhead += hi - lo;
    }
    prev = mk;
  }
  if (prev) {
    const lo = Math.max(prev.at, from);
    const hi = Math.min(to, now);
    if (hi > lo && prev.us - prev.them > 0) a.timeAhead += hi - lo;
  }

  // possessions are a plain team counter with no event behind them, so they
  // cannot be attributed to a quarter — the whole game is the only honest slice
  if (split === null && g.possessions > 0) a.ppp = g.score / g.possessions;

  return a;
}

export interface Report {
  lines: Player[];
  team: Totals;
  zones: ZoneSplit;
  advanced: TeamAdvanced;
  /** our points and theirs IN this slice, which is what the header reads */
  us: number;
  them: number;
}

/** Everything the stats screen shows for one slice, built in one pass. */
export function report(g: GameState, split: Split): Report {
  const lines = linesFor(g, split);
  const events = eventsIn(g.events, split);
  const them =
    split === null
      ? g.oppScore
      : events.reduce((n, e) => n + (e.type === 'oppPoint' ? e.value : 0), 0);
  const team = totals(lines);
  return {
    lines,
    team,
    zones: zoneSplits(events),
    advanced: advancedFor(g, split, lines),
    us: split === null ? g.score : team.pts,
    them,
  };
}

/** The shot chart's marks for one slice, oldest first. */
export interface ShotMark {
  id: string;
  x: number;
  y: number;
  made: boolean;
  three: boolean;
}

export function shotsIn(events: GameEvent[], split: Split): ShotMark[] {
  return eventsIn(events, split).flatMap((e) =>
    e.type === 'shot'
      ? [
          {
            id: e.id,
            x: e.position.x,
            y: e.position.y,
            made: e.result === 'made',
            three: e.shotType === '3PT',
          },
        ]
      : [],
  );
}

/** Free throws all land on one spot, so the chart needs the count, not the list. */
export const freeThrowsIn = (events: GameEvent[], split: Split): { m: number; a: number } =>
  eventsIn(events, split).reduce(
    (n, e) => (e.type === 'freeThrow' ? { m: n.m + (e.result === 'made' ? 1 : 0), a: n.a + 1 } : n),
    { m: 0, a: 0 },
  );

/** The zone list with its numbers attached — the order the floor reads in. */
export const zoneRows = (z: ZoneSplit): { zone: Zone; m: number; a: number }[] =>
  ZONES.map((k) => ({ zone: k, m: z[k].m, a: z[k].a }));
