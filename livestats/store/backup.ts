import { type Backup, backupOf, travels } from '../lib/backup';
import { gameKey } from '../lib/history';
import { Store } from '../platform/storage';
import { useHistoryStore } from './historyStore';
import { useRosterStore } from './rosterStore';
import { useTeamStore } from './teamStore';

/**
 * READING AND WRITING THE WHOLE SHELF AT ONCE — the two operations the backup
 * page performs, and the only place in the app that goes at storage sideways
 * rather than through a store.
 *
 * It is here rather than in `lib/` because it touches the disk and three
 * stores, and it is here rather than in the screen because it is not a
 * rendering concern. `store/selectors.ts` is the precedent for a file in this
 * folder that is not itself a store.
 */

/** Every row that travels, as it sits on the disk. */
async function rows(): Promise<[string, string][]> {
  const keys = (await Store.keys()).filter(travels);
  const out: [string, string][] = [];
  for (const key of keys) {
    const value = await Store.getItem(key);
    if (value !== null) out.push([key, value]);
  }
  return out;
}

/** The file's contents. Pretty-printed: a backup is a thing people open. */
export async function makeBackup(): Promise<string> {
  return JSON.stringify(backupOf(await rows()), null, 2);
}

/**
 * PUT A BACKUP BACK, AND IT REPLACES RATHER THAN MERGES.
 *
 * Merging two shelves sounds kinder and is not: the same game saved on two
 * devices has two different ids, so a merge produces duplicates it cannot
 * detect, and two rosters with the same jersey numbers have no answer at all.
 * Replace is the operation a scorer actually wants from a backup — this device
 * lost its season, put the season back — and it is the only one that can be
 * described in one sentence on the button. The page says so before it runs.
 *
 * ## IT WRITES BEFORE IT DELETES, AND THE ORDER IS THE SAFETY OF IT
 *
 * The obvious shape — clear the shelf, then fill it — loses BOTH seasons if the
 * disk fills up half way through, which on the web is not a remote possibility
 * but the exact condition a scorer reaches for a backup in. So the new rows go
 * down FIRST, and the old game rows are dropped only once every one of them has
 * landed. A failure part way through leaves this device's own index still in
 * place, still pointing at its own games, still readable: some orphaned rows
 * are left behind, and the next successful restore sweeps them.
 *
 * The sweep itself is not optional. The index that lands names the games it
 * knows about, so any game row here that it does not name is unreachable the
 * moment it is written — the same leak `historyStore` is careful about when it
 * drops a summary past `HISTORY_CAP`, and a season's worth of it on the one
 * platform that measures its room in megabytes.
 *
 * ## EVERY WRITE IS A `write`, NOT A `setItem`
 *
 * `Store.setItem` reports a fault and resolves, which is right for persistence
 * that nobody is waiting on and wrong for this: a restore that quietly wrote
 * half a season and said "Restored 12 games" is the failure this whole file
 * exists to prevent. `write` rejects, the screen catches it, and the scorer is
 * told that nothing they can rely on happened.
 *
 * ## THE STORES ARE REHYDRATED, NOT THE APP RELOADED
 *
 * The three stores are already in memory holding what they read at launch, so
 * writing underneath them changes nothing a screen can see. `persist.rehydrate`
 * is zustand's own re-read and it runs each store's migration on the way — the
 * same path an upgrade in place takes, which is what lets an old backup land on
 * a new build. A reload would also work in a browser and there is no reload on
 * a phone, so this is the door that exists on both.
 */
export async function applyBackup(backup: Backup): Promise<void> {
  const before = await Store.keys();

  // everything the file carries, and a rejection here leaves this device's own
  // shelf standing rather than half replaced
  for (const [key, value] of Object.entries(backup.rows)) await Store.write(key, value);

  // and only now the game rows the new index cannot reach
  const arriving = new Set(Object.keys(backup.rows));
  for (const key of before)
    if (key.startsWith(gameKey('')) && !arriving.has(key)) await Store.removeItem(key);

  await Promise.all([
    useTeamStore.persist.rehydrate(),
    useRosterStore.persist.rehydrate(),
    useHistoryStore.persist.rehydrate(),
  ]);
}
