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
import { zeroStats } from '../constants/game';
import type { Player, RosterPlayer } from '../types';

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
