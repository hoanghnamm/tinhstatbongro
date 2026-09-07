/**
 * Every mutation the board can make, as plain functions over a GameState.
 *
 * They live here rather than in the store so the basketball rules can be run
 * and checked without React, Zustand or a device. The store's only job is to
 * snapshot before one of these, call it, and publish the result.
 */
import { FOULS, FOUL_KINDS, PERIOD_LEN, TALLY } from '../constants/game';
import { FT_SPOT, zoneFor } from './court';
import { mmss } from './format';
import { STARTERS } from './roster';
import type {
  EventBody,
  FoulKindKey,
  FoulOutcome,
  GameState,
  Player,
  Position,
  ShotNote,
  ShotType,
  TallyType,
} from '../types';

export const byId = (g: GameState, id: string): Player | undefined => g.players.find((p) => p.id === id);
export const onCourt = (g: GameState): Player[] => g.players.filter((p) => p.status === 'active');
export const onBench = (g: GameState): Player[] => g.players.filter((p) => p.status === 'bench');
export const fouledOut = (g: GameState): Player[] => g.players.filter((p) => p.status === 'out');

/** Ids come off the event count, so undo rewinds the sequence with the log. */
function log(g: GameState, ev: EventBody): void {
  g.events.push({
    id: 'event-' + String(g.events.length + 1).padStart(3, '0'),
    period: g.period,
    gameClock: mmss(g.remaining),
    timestamp: Date.now(),
    ...ev,
  });
}

/** Every point scored is credited to whoever is standing on the floor. */
export function creditOnCourt(g: GameState, value: number): void {
  for (const p of onCourt(g)) p.stats.onCourtPoints += value;
}

/**
 * The other half of the same idea, and the reason +/- is a real number here.
 * The opponent has no roster, but a plus-minus never needed one: the three OPP
 * buttons are tapped while play is in front of you, so the five standing on the
 * floor at that moment are exactly the five the basket went against.
 */
export function debitOnCourt(g: GameState, value: number): void {
  for (const p of onCourt(g)) p.stats.onCourtOppPoints += value;
}

function need(g: GameState, id: string): Player {
  const p = byId(g, id);
  if (!p) throw new Error('no such player: ' + id);
  return p;
}

export function recordShot(
  g: GameState,
  playerId: string,
  position: Position,
  shotType: ShotType,
  made: boolean,
  assistId: string | null,
  shotNote: ShotNote | null,
): void {
  const p = need(g, playerId),
    s = p.stats,
    three = shotType === '3PT';
  const zone = zoneFor(position.x, position.y);
  s.fgAttempted++;
  if (three) s.threeAttempted++;
  else s.twoAttempted++;

  if (!made) {
    log(g, {
      type: 'shot', playerId, position, zone, shotType, shotNote,
      result: 'miss', value: 0, assistPlayerId: null,
    });
    return;
  }

  s.fgMade++;
  if (three) s.threeMade++;
  else s.twoMade++;
  const value = three ? 3 : 2;
  s.points += value;
  g.score += value;
  creditOnCourt(g, value);
  log(g, {
    type: 'shot', playerId, position, zone, shotType, shotNote,
    result: 'made', value, assistPlayerId: assistId,
  });
  if (assistId) {
    need(g, assistId).stats.assists++;
    log(g, { type: 'assist', playerId: assistId, position, shotPlayerId: playerId });
  }
}

/** The opponent's whole model: a number and an undoable event. */
export function recordOppPoint(g: GameState, points = 1): void {
  g.oppScore += points;
  debitOnCourt(g, points);
  log(g, { type: 'oppPoint', playerId: null, position: null, value: points });
}

/**
 * A whole trip to the line in one entry, so one undo reverses the trip — while
 * still logging one event per attempt for the play-by-play. Quick mode calls
 * this once per attempt, and therefore counts one ftTrip per attempt; nothing
 * renders that counter, so it is left alone rather than given a flag.
 *
 * Every attempt is logged at FT_SPOT so the chart can mark it, and every one of
 * them with `zone: null` — see FT_SPOT. Free throws touch ftAttempted / ftMade
 * / ftTrips and NOTHING on the field-goal side.
 */
export function recordFreeThrowTrip(
  g: GameState,
  playerId: string,
  results: boolean[],
  andOne: boolean,
): void {
  const s = need(g, playerId).stats;
  s.ftTrips++;
  for (const made of results) {
    s.ftAttempted++;
    if (made) {
      s.ftMade++;
      s.points++;
      g.score++;
      creditOnCourt(g, 1);
    }
    log(g, {
      type: 'freeThrow', playerId, position: FT_SPOT, zone: null,
      result: made ? 'made' : 'miss', value: made ? 1 : 0, andOne,
    });
  }
}

export function recordRebound(
  g: GameState,
  playerId: string,
  position: Position | null,
  kind: 'offensive' | 'defensive',
): void {
  const s = need(g, playerId).stats;
  if (kind === 'offensive') s.offensiveRebounds++;
  else s.defensiveRebounds++;
  log(g, { type: 'rebound', playerId, position, reboundType: kind });
}

/** turnover / steal / block / foul drawn: one tally, one event. */
export function recordTally(
  g: GameState,
  playerId: string,
  position: Position | null,
  type: TallyType,
): void {
  const s = need(g, playerId).stats;
  const key = TALLY[type];
  (s[key] as number)++;
  log(g, { type, playerId, position });
}

/**
 * Returns 'ok' | 'out' (this foul disqualified them) | 'denied' (already out).
 * The caller MUST branch on it — silently swallowing a denial is how the
 * earlier version lost fouls past the limit.
 */
export function recordFoul(
  g: GameState,
  playerId: string,
  position: Position | null,
  kindKey: FoulKindKey,
): FoulOutcome {
  const kind = FOUL_KINDS[kindKey] ?? FOUL_KINDS.personal;
  const p = need(g, playerId),
    s = p.stats;
  if (kind.dq && s.fouls >= FOULS) return 'denied';

  if (kind.dq) s.fouls++;
  if (kindKey === 'technical') s.technicals++;
  if (kindKey === 'flagrant') s.flagrants++;
  if (kindKey === 'offensive') s.offensiveFouls++;
  if (kindKey === 'shooting') s.shootingFouls++;
  log(g, { type: 'foul', playerId, position, foulKind: kindKey });

  if (kind.dq && s.fouls >= FOULS) {
    // 'out' removes them from onCourt and onBench permanently
    p.status = 'out';
    log(g, { type: 'foulOut', playerId, position: null });
    return 'out';
  }
  return 'ok';
}

/**
 * Returns whether the substitution happened, and it can refuse: A PLAYER WHO
 * HAS FOULED OUT MAY NOT BE PUT BACK IN THE LINEUP. Every picker already draws
 * them as a disabled tile, but a disabled tile is a fact about a panel and this
 * is a fact about the game, so the rule lives here where `npm run check` can
 * read it and no future caller can walk around it. A refusal logs nothing and
 * changes nothing, which is what lets the store drop its snapshot.
 */
export function substitute(g: GameState, outId: string, inId: string): boolean {
  const out = need(g, outId);
  const on = need(g, inId);
  if (on.status === 'out') return false;
  if (out.status === 'active') out.status = 'bench'; // a fouled-out player stays out
  on.status = 'active';
  log(g, { type: 'substitution', playerId: inId, outPlayerId: outId });
  return true;
}

/**
 * THE BOARD OWES A SUBSTITUTION: the floor is short of five and there is
 * somebody on the bench to fill it.
 *
 * A disqualified player used to sit in the rail dimmed for as long as the
 * scorer left them there, which meant the column said five while the floor had
 * four on it. So the replacement question is asked at the moment of the fifth
 * foul, and while this is true it is not a question the scorer may walk away
 * from — see `FouledOutPanel` and `PanelHost`. It is asked of the GAME and not
 * of a player, because the debt is the empty place on the floor rather than the
 * person who vacated it, and it goes false the only two honest ways: somebody
 * comes on, or there is nobody left to come on and the team really is short.
 */
export function owesSub(g: GameState): boolean {
  return onCourt(g).length < STARTERS && onBench(g).length > 0;
}

/**
 * One possession, counted by hand. Deliberately not an event and not a player
 * stat: a possession belongs to the team, and inventing a playerId for it would
 * put a number on the box score that nobody tapped. It goes through the store's
 * `edit()` like every other mutation, so UNDO takes it back.
 */
export function addPossession(g: GameState, n = 1): void {
  g.possessions = Math.max(0, g.possessions + n);
}

/**
 * One timeout, counted by hand — a team counter like `addPossession`, with no
 * player to hang it on, AND a mark on the clock.
 *
 * The mark is the one place the two counters part company, and it is not a
 * play-by-play line for its own sake: a timeout is the only thing on this board
 * that a coach DID, and the only question worth asking about it is whether the
 * team played better after it. That question needs a period and a clock reading
 * — see `timeoutRun` in `lib/analysis.ts` — and the log is where this app keeps
 * times. Nothing is credited to anybody, so no box score moves.
 *
 * It is logged only when the count actually rose: `n` is clamped at zero, and a
 * clamped tap is a tap that did nothing.
 *
 * It is the default half of the footer's fourth cell where possessions are the
 * opt-in half; see `Options.poss`. Same `edit()`, and the snapshot carries the
 * log, so one UNDO takes back both the number and the mark.
 */
export function addTimeout(g: GameState, n = 1): void {
  const was = g.timeouts;
  g.timeouts = Math.max(0, g.timeouts + n);
  if (g.timeouts > was) log(g, { type: 'timeout', playerId: null, position: null });
}

/**
 * The buzzer: the next period, a full clock, stopped.
 *
 * It goes through the store's `edit()` like a basket does, because END QUARTER
 * is one tap next to END GAME on the same panel and a mis-tap costs a whole
 * period otherwise — SET can put 10:00 back but nothing can put the quarter
 * back. It is the one mutation whose damage is entirely CLOCK, which is why
 * the snapshot it pushes is the one that carries the clock; see `Snapshot` in
 * `store/gameStore.ts`.
 *
 * It logs no event and touches no player, so a quarter that was ended and
 * undone leaves nothing behind in the play-by-play. `periodsOf` reads the log,
 * so a period nobody logged anything in simply is not there.
 */
export function nextPeriod(g: GameState): void {
  g.running = false;
  g.period += 1;
  // the game's own length, not the constant: it was stamped at tip-off and an
  // overtime is played to the same clock the quarters were
  g.remaining = g.periodLen || PERIOD_LEN;
}

/** One second of game clock: minutes accrue only for players on the floor. */
export function tickSeconds(g: GameState, seconds: number): void {
  // never credit past the buzzer: the clock is what minutes are made of
  const s = Math.min(Math.max(0, seconds), g.remaining);
  if (s <= 0) return;
  g.remaining -= s;
  for (const p of onCourt(g)) p.stats.secondsPlayed += s;
}
