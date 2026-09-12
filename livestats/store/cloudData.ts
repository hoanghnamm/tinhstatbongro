import { backupOf } from '../lib/backup';
import { validateCloudRestore } from '../lib/cloud';
import { gameKey } from '../lib/history';
import { Store } from '../platform/storage';
import { applyBackup } from './backup';
import { useTeamStore } from './teamStore';
import { useRosterStore } from './rosterStore';
import { useSquadStore } from './squadStore';
import { useHistoryStore } from './historyStore';

export const CLOUD_RECOVERY = 'hooplog-cloud-recovery';
export function cloudHydrated(): boolean {
  return [useTeamStore, useRosterStore, useSquadStore, useHistoryStore].every(s => s.persist.hasHydrated());
}

/** Read current store envelopes, including a just-saved game's memory copy. */
export async function captureCloud(includeLocalFiles = false): Promise<Record<string, string>> {
  if (!cloudHydrated()) throw new Error('Your saved data is still loading. Please try again.');
  const rows: Record<string, string> = {};
  for (const store of [useTeamStore, useRosterStore, useSquadStore, useHistoryStore]) {
    const options = store.persist.getOptions();
    const state = store.getState();
    const partialize = options.partialize as ((value: unknown) => unknown) | undefined;
    rows[options.name!] = JSON.stringify({ state: partialize ? partialize(state) : state, version: options.version ?? 0 });
  }
  // Local native image paths cannot survive a reinstall. Keep the profile and
  // let the crest fall back to its monogram; web's embedded image can travel.
  const team = JSON.parse(rows['hooplog-team']!);
  if (!includeLocalFiles && team.state.profile.logoUri && !team.state.profile.logoUri.startsWith('data:')) team.state.profile.logoUri = null;
  rows['hooplog-team'] = JSON.stringify(team);
  const index = JSON.parse(rows['hooplog-history']!).state.index as { id: string }[];
  for (const item of index) {
    const game = await useHistoryStore.getState().loadGame(item.id);
    if (!game) throw new Error('A saved game could not be read. Backup paused to keep your cloud copy safe.');
    rows[gameKey(item.id)] = JSON.stringify(game);
  }
  validateCloudRestore(rows);
  return rows;
}

export async function restoreCloud(rows: Record<string, string>): Promise<void> {
  validateCloudRestore(rows);
  // Keep an on-device recovery snapshot before any replacement. A failed or
  // interrupted restore leaves automatic uploads paused until explicitly retried.
  const recovery = await Store.getItem(CLOUD_RECOVERY);
  const before: Record<string, string> = recovery ? JSON.parse(recovery) : await captureCloud(true);
  validateCloudRestore(before);
  if (!recovery) await Store.write(CLOUD_RECOVERY, JSON.stringify(before));
  try {
    await applyBackup(backupOf(Object.entries(rows)));
  } catch (error) {
    await applyBackup(backupOf(Object.entries(before))).catch(() => {});
    throw error;
  }
}
