/**
 * THE BACKUP FILE, as plain rules over plain data.
 *
 * It is on the same side of the line as `actions.ts`, `history.ts` and
 * `billing.ts` — nothing here opens a file, asks a store or touches React, so
 * `npm run check` exercises the whole shape of a backup without a device.
 * `components/settings/Backup.tsx` is the phone half, the way
 * `components/stats/ExportButton.tsx` is the phone half of `lib/pdf.ts`.
 *
 * ## WHY THIS EXISTS AT ALL
 *
 * Every game this app has ever recorded lives in one browser, on one origin,
 * on one device, and nothing syncs anywhere. On the web that store is subject
 * to a browser that is allowed to throw it away: Safari clears script-writable
 * storage for a site the reader has not opened in seven days unless it was
 * added to the home screen, "clear website data" takes everything with no
 * per-site question, and a phone low on disk may have its best-effort storage
 * reclaimed. Moving to a different domain is a different storage area again.
 *
 * A file the scorer holds is the only one of those a scorer can control, and
 * it is worth more than any of the cleverer answers because it needs no
 * account, no network and no server. This is the insurance; sync, if it ever
 * comes, is the convenience.
 *
 * ## IT IS A KEY DUMP, NOT A MODEL
 *
 * The obvious shape — read the roster, read the games, write a typed document
 * — is the wrong one, because it would be a THIRD copy of every store's shape,
 * beside the store and its migration, drifting the first time a field is
 * added. What travels instead is the raw rows exactly as they sit on the disk:
 * the same strings `platform/storage.ts` wrote, restored by writing them back.
 *
 * That means a backup restores through each store's OWN migration — a file
 * written by an older build lands on a newer one and `migrateRoster` does what
 * it already does for an upgrade in place. Nothing here has to know what a
 * `Player` is.
 *
 * ## THREE KEYS TRAVEL AND THE REST DO NOT
 *
 * A backup is THE CLUB, THE POOL, THE TEAMS AND THE SAVED GAMES, and it says
 * so on the page. What is left out is left out for a reason each:
 *
 * - **`hooplog-billing`** — an entitlement that can be restored from a file the
 *   scorer wrote is not an entitlement. Whether somebody has paid is a fact
 *   about their account and never a fact about their disk.
 * - **`livestats-game`** — the board mid-possession. A game in progress is not
 *   a record yet, and dropping one onto a device that has its own game open is
 *   the one restore that could destroy something live.
 * - **`hooplog-tutorial`** — a stash that exists for two minutes during the
 *   walkthrough and means nothing outside it.
 * - **`hooplog-intro`** — whether this install has been through the door. It is
 *   about the INSTALL, not about the club, and restoring it would skip a first
 *   run that is meant to happen once per device.
 */
import { gameKey } from './history';

/** The rows a backup carries, as prefixes — `hooplog-game:` matches many. */
export const BACKUP_KEYS = [
  'hooplog-team',
  'hooplog-roster',
  // THE TEAMS TRAVEL WITH THE POOL THEY POINT AT, and they have to: a team is
  // a list of pool ids and nothing else, so a backup carrying the roster
  // without them would restore a club whose three sheets had collapsed back
  // into one. They are the club's, exactly as the roster is — not the
  // install's, which is the line `hooplog-intro` is on the wrong side of.
  'hooplog-squads',
  'hooplog-history',
  'hooplog-game:',
];

/** Does this storage key travel? The `game:` prefix is why this is not a set. */
export const travels = (key: string): boolean =>
  BACKUP_KEYS.some((k) => (k.endsWith(':') ? key.startsWith(k) : key === k));

/**
 * The format number, and it is not the app's version.
 *
 * It goes up only when the FILE's own shape changes — the envelope below —
 * which is a different question from a store changing shape, because that is
 * already handled by the store's own migration on the way back in. A reader
 * that meets a number it does not know refuses rather than guessing.
 */
export const BACKUP_FORMAT = 1;

/** The envelope. `rows` is storage key to the exact string that was stored. */
export interface Backup {
  /** so a file dropped in from somewhere else is refused by name */
  app: 'hooplog';
  format: number;
  savedAt: number;
  rows: Record<string, string>;
}

/** What a backup turns out to hold, for the sentence over the confirm button. */
export interface BackupCounts {
  games: number;
  club: boolean;
  roster: boolean;
}

/**
 * SAVED GAMES ARE COUNTED BY THEIR OWN ROWS, not by reading the index.
 *
 * The index is a store's persisted envelope and parsing it here would be the
 * modelling this file exists to avoid. One row per game is a fact about the
 * storage layout — `gameKey` owns it, and it is asserted in `npm run check`.
 */
export function countsOf(backup: Backup): BackupCounts {
  const keys = Object.keys(backup.rows);
  return {
    games: keys.filter((k) => k.startsWith(gameKey(''))).length,
    club: keys.includes('hooplog-team'),
    roster: keys.includes('hooplog-roster'),
  };
}

/** The file, from whatever the disk handed back. Only what travels is kept. */
export function backupOf(entries: [string, string][], at: number = Date.now()): Backup {
  const rows: Record<string, string> = {};
  for (const [key, value] of entries) if (travels(key)) rows[key] = value;
  return { app: 'hooplog', format: BACKUP_FORMAT, savedAt: at, rows };
}

/**
 * WHY A FILE WAS REFUSED, in the scorer's own words — and `null` means it is
 * good. Phrased as what is wrong with the FILE, never as what the scorer did.
 */
export type BackupFault = 'notJson' | 'notOurs' | 'tooNew' | 'empty';

export const BACKUP_REFUSAL: Record<BackupFault, string> = {
  notJson: 'That file is not a backup',
  notOurs: 'That backup is from a different app',
  tooNew: 'That backup was written by a newer version',
  empty: 'That backup has nothing in it',
};

/**
 * READ A FILE BACK, and refuse it rather than half-restore it.
 *
 * Everything is checked before anything is returned, because a partial restore
 * is the one outcome worse than a refused one: half a season and a roster that
 * does not match it is a state no migration can straighten out. Rows that do
 * not travel are DROPPED rather than refused — a file written by a future
 * build that carries more than this one restores may still restore what it
 * knows, and the entitlement row is dropped here as well as at write time so
 * that a hand-edited file cannot smuggle one in.
 */
export function readBackup(raw: string): { backup: Backup } | { fault: BackupFault } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { fault: 'notJson' };
  }
  if (!parsed || typeof parsed !== 'object') return { fault: 'notJson' };

  const b = parsed as Partial<Backup>;
  if (b.app !== 'hooplog') return { fault: 'notOurs' };
  if (typeof b.format !== 'number') return { fault: 'notOurs' };
  if (b.format > BACKUP_FORMAT) return { fault: 'tooNew' };
  if (!b.rows || typeof b.rows !== 'object') return { fault: 'empty' };

  const rows: Record<string, string> = {};
  for (const [key, value] of Object.entries(b.rows))
    if (travels(key) && typeof value === 'string') rows[key] = value;

  if (!Object.keys(rows).length) return { fault: 'empty' };

  return {
    backup: {
      app: 'hooplog',
      format: b.format,
      savedAt: typeof b.savedAt === 'number' ? b.savedAt : 0,
      rows,
    },
  };
}

/**
 * THE FILE'S NAME, and it is what a scorer picks one of six out of a mail
 * thread by — the same argument `reportFileName` makes in `lib/pdf.ts`.
 *
 * Digits only and no locale, for the reason `numDateLabel` is: a file listed on
 * a phone, a laptop and a mail client should read the same on all three. The
 * date is written big-endian here rather than day-first, because a folder of
 * these sorts itself into order that way and that is what a backup folder is
 * for.
 */
export function backupFileName(at: number = Date.now()): string {
  const d = new Date(at);
  const dd = (n: number): string => String(n).padStart(2, '0');
  return `hooprec-${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}.json`;
}
