/**
 * The roster rules, as plain functions over plain data — the same split the
 * game rules already have in `actions.ts`, and for the same reason: every one
 * of them is exercised by `npm run check` without React, Zustand or a device.
 *
 * The line this file draws is the point of the store split. A roster entry is
 * a jersey and a name and outlives any number of games; a `Player` is that
 * plus one game's worth of stats. `buildPlayers` is the ONLY crossing, it runs
 * exactly once per game, and it copies — so editing the team after tip-off
 * cannot reach the game being played.
 */
import { COURT_POSITIONS, zeroStats } from '../constants/game';
import type { CourtPosition, Player, RosterPlayer } from '../types';

/** Five rail rows and a bench; past this the picker stops being a picker. */
export const ROSTER_CAP = 15;
/** The board is five rows — a game cannot start without five to put in them. */
export const STARTERS = 5;
/** The rail truncates anyway, so the field says no before the row has to. */
export const NAME_MAX = 20;

export const validNumber = (n: number): boolean =>
  Number.isInteger(n) && n >= 0 && n <= 99;

export const cleanName = (name: string): string => name.trim().slice(0, NAME_MAX);

/**
 * Who already wears this number, ignoring the entry being edited. Returned
 * whole rather than as a boolean because the error names the holder — "#12 IS
 * TAKEN BY bd" is actionable and "number in use" is not.
 */
export function numberHolder(
  roster: RosterPlayer[],
  number: number,
  exceptId: string | null,
): RosterPlayer | null {
  return roster.find((p) => p.number === number && p.id !== exceptId) ?? null;
}

/**
 * The number a row starts on when `+ ADD PLAYER` writes one straight into the
 * store: the lowest 0-99 nobody already wears.
 *
 * There is no form left to fill a number in on — the row IS the editor — and
 * `number` is not optional, so a new entry has to arrive wearing something.
 * The lowest free one is the only answer that cannot collide with a sibling
 * and needs no explaining. `ROSTER_CAP` is 15, so the 0-99 space can never
 * actually run out; the fallback is 0 rather than a throw.
 */
export function nextFreeNumber(roster: RosterPlayer[]): number {
  const taken = new Set(roster.map((p) => p.number));
  for (let n = 0; n <= 99; n++) if (!taken.has(n)) return n;
  return 0;
}

/**
 * Every player who can be picked for a game. It is the ONE reading of
 * `available` in the app: an unavailable player is hidden from the picker and
 * therefore never reaches `buildPlayers`, which is the whole mechanism. There
 * is no second check on the board, because a game that has started no longer
 * has an opinion about who was injured before it.
 */
export const availableIn = (roster: RosterPlayer[]): RosterPlayer[] =>
  roster.filter((p) => p.available);

/**
 * What a roster loaded off disk has to be put through.
 *
 * `available` was added after the first builds shipped, so a persisted entry
 * can be missing it — and missing is falsy, which would hide every player from
 * the picker and read as the whole team vanishing. The migration is written
 * here rather than inline in the store so `npm run check` can run it, and it
 * defaults to TRUE: a roster that has never heard of availability is a roster
 * where everyone is available.
 */
export const migrateRoster = (players: unknown): RosterPlayer[] => {
  if (!Array.isArray(players)) return [];
  return players.map((raw) => {
    const p = raw as Partial<RosterPlayer>;
    return {
      id: String(p.id),
      number: Number(p.number),
      name: String(p.name ?? ''),
      // an unknown string is dropped rather than kept: the field is a label out
      // of a fixed list, and a sixth value would have nothing to render
      position: COURT_POSITIONS.includes(p.position as CourtPosition)
        ? (p.position as CourtPosition)
        : undefined,
      available: p.available !== false,
    };
  });
};

/**
 * A fresh game's `players`, built from the durable roster.
 *
 * Every field is written here rather than spread from the roster entry, so a
 * key added to `RosterPlayer` cannot silently arrive in a game state, and
 * every stat line is a NEW object — sharing one would put two players on the
 * same counters.
 */
export function buildPlayers(roster: RosterPlayer[], starterIds: string[]): Player[] {
  const starting = new Set(starterIds);
  return roster.map((r) => ({
    id: r.id,
    number: r.number,
    name: r.name,
    status: starting.has(r.id) ? 'active' : 'bench',
    starter: starting.has(r.id),
    stats: zeroStats(),
  }));
}

/** A roster id that cannot collide with `p${number}` or with a sibling tap. */
let seq = 0;
export const newRosterId = (): string =>
  'r' + Date.now().toString(36) + (seq++).toString(36);
