/**
 * THE MERGE RULE, AND IT IS THAT THERE IS NO MERGE.
 *
 * ## THE ACCOUNT HAS ONE CLOCK
 *
 * Every push that changes anything bumps the account's `rev` by exactly one,
 * and every row it touched is stamped with that number. A client's cursor is
 * the last rev it has seen. Pulling is therefore "every row stamped above my
 * cursor", which is one indexed query and needs no timestamps, no clock
 * agreement between a phone and a server, and no ordering guesswork when two
 * devices push in the same second.
 *
 * ## A STALE PUSH IS REFUSED, NOT APPLIED
 *
 * If the account has moved on since the cursor a push was built against, the
 * push is rejected with `409` and the rows that moved. It is not applied and
 * nothing is overwritten.
 *
 * The alternative — per-row last-writer-wins — reads as the obvious answer and
 * loses seasons. `hooplog-history` is the index that makes every saved game
 * REACHABLE: a device that has been offline a week and pushes its own index
 * would leave the games saved elsewhere sitting on the server unreachable,
 * present and invisible, which is the worst shape data loss can take. The
 * server cannot fix that because it will not parse the index — so the client,
 * which has `GameSummary` and every migration, reconciles and pushes again.
 *
 * That is the same call `applyBackup` made when it chose replace over merge,
 * and the same call `readBackup` made when it refused a file whole.
 *
 * ## A GAME ROW NEVER CHANGES
 *
 * Saved games are written once and deleted, never edited — so the only row two
 * devices can genuinely disagree about is one of the four singletons. This is
 * stated because it is what makes the refusal above cheap in practice: the
 * common case, two devices each filing their own games, touches disjoint keys
 * and reconciles without a person ever seeing anything.
 */
import { GAME_PREFIX } from './keys.js';
import type { WireRow } from './wire.js';

/** A row as the server holds it. */
export interface StoredRow {
  key: string;
  value: string | null;
  deleted: boolean;
  rev: number;
}

/** What a pull hands back. `cursor` is what to send as `since` next time. */
export interface Pull {
  cursor: number;
  rows: StoredRow[];
}

/** Is this push built against the account as it now stands? */
export function isCurrent(since: number, accountRev: number): boolean {
  return since >= accountRev;
}

/**
 * WHAT A PUSH ACTUALLY CHANGES, which is not always what it carries.
 *
 * A client that pushes a row byte-for-byte identical to the one already here —
 * a rehydrate, a retry after a dropped response, a second device that restored
 * the same backup — has changed nothing, and stamping it with a fresh rev would
 * hand every other device a pull that turns out to be empty. So the push is
 * filtered against what is held, and a push that changes nothing consumes no
 * rev at all.
 */
export function changesIn(push: WireRow[], held: Map<string, StoredRow>): WireRow[] {
  return push.filter((row) => {
    const at = held.get(row.key);
    if (!at) return !row.deleted; // deleting what was never here is not a change
    if (row.deleted) return !at.deleted;
    return at.deleted || at.value !== row.value;
  });
}

/** Game keys among these rows, for the count a client is told. */
export const gameKeys = (keys: Iterable<string>): string[] =>
  [...keys].filter((k) => k.startsWith(GAME_PREFIX));

/**
 * WHAT A DEVICE IS TOLD ABOUT ITS OWN ACCOUNT, in the two figures a scorer
 * would recognise: how many games are up there, and when the last push landed.
 * Deleted rows are tombstones — they stay so a second device learns of the
 * deletion — and they are not counted as games.
 */
export function summarise(rows: StoredRow[]): { games: number; keys: number } {
  const live = rows.filter((r) => !r.deleted);
  return { games: gameKeys(live.map((r) => r.key)).length, keys: live.length };
}
