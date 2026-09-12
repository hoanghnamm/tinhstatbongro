import { travels } from './backup';
import { gameKey, reviveGame } from './history';

export interface CloudSnapshot { cursor: number; rows: Record<string, string> }
export interface CloudChange { key: string; value: string | null; deleted: boolean }
export const CLOUD_SINGLETONS = ['hooplog-team', 'hooplog-roster', 'hooplog-squads', 'hooplog-history'];
export const cloudRestoreBlocked = (game: { events: unknown[]; running: boolean; ended: boolean }): boolean =>
  !game.ended && (game.running || game.events.length > 0);

/** A fresh install or different account must choose before uploading anything. */
export function cloudAssociated(saved: unknown, accountId: string, remoteCursor: number): boolean {
  if (!saved || typeof saved !== 'object') return false;
  const value = saved as Record<string, unknown>;
  return value.accountId === accountId && value.enabled === true &&
    Number.isSafeInteger(value.cursor) && value.cursor === remoteCursor;
}

/** Validate the whole response before any row can reach storage. */
export function readCloud(raw: unknown): CloudSnapshot {
  const r = raw as { cursor?: unknown; rows?: unknown } | null;
  if (!r || !Number.isSafeInteger(r.cursor) || (r.cursor as number) < 0 || !Array.isArray(r.rows))
    throw new Error('The server returned an unreadable backup.');
  const rows: Record<string, string> = {};
  const seen = new Set<string>();
  for (const row of r.rows) {
    if (!row || typeof row.key !== 'string' || !travels(row.key) || seen.has(row.key) ||
        !Number.isSafeInteger(row.rev) || row.rev > (r.cursor as number) || typeof row.deleted !== 'boolean')
      throw new Error('The server returned an invalid backup row.');
    seen.add(row.key);
    if (!row.deleted) {
      if (typeof row.value !== 'string') throw new Error('The backup has a missing value.');
      rows[row.key] = row.value;
    }
  }
  return { cursor: r.cursor as number, rows };
}

/** Keep original strings; never reconstruct a roster from summary data. */
export function validateCloudRestore(rows: Record<string, string>): void {
  for (const key of CLOUD_SINGLETONS) {
    const value = rows[key];
    if (!value) throw new Error('This cloud backup is incomplete. Nothing was restored.');
    const envelope = JSON.parse(value);
    if (!envelope?.state || typeof envelope.state !== 'object') throw new Error('Invalid backup data.');
    const supported = key === 'hooplog-roster' ? 2 : key === 'hooplog-history' ? 0 : 1;
    if ((envelope.version ?? 0) > supported) throw new Error('Update the app before restoring this backup.');
  }
  const roster = JSON.parse(rows['hooplog-roster']!).state.players;
  const profile = JSON.parse(rows['hooplog-team']!).state.profile;
  const squads = JSON.parse(rows['hooplog-squads']!).state.squads;
  const index = JSON.parse(rows['hooplog-history']!).state.index;
  if (!Array.isArray(roster) || !profile || typeof profile.name !== 'string' || !Array.isArray(squads) || !Array.isArray(index))
    throw new Error('The cloud backup has invalid club data.');
  for (const summary of index) {
    if (!summary || typeof summary.id !== 'string' || !rows[gameKey(summary.id)] ||
        !reviveGame(JSON.parse(rows[gameKey(summary.id)]!)))
      throw new Error('A saved game is missing from this backup. Nothing was restored.');
  }
}

/** A full snapshot diff includes tombstones so intentional deletions travel. */
export function cloudChanges(local: Record<string, string>, remote: Record<string, string>): CloudChange[] {
  const changes: CloudChange[] = [];
  for (const [key, value] of Object.entries(local))
    if (travels(key) && remote[key] !== value) changes.push({ key, value, deleted: false });
  for (const key of Object.keys(remote))
    if (travels(key) && !(key in local)) changes.push({ key, value: null, deleted: true });
  return changes;
}
