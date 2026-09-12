import { create } from 'zustand';
import { api, ApiError } from '../platform/api';
import { SessionVault } from '../platform/session';
import { Store } from '../platform/storage';
import { cloudAssociated, cloudChanges, cloudRestoreBlocked, readCloud, type CloudSnapshot } from '../lib/cloud';
import { captureCloud, restoreCloud, CLOUD_RECOVERY } from './cloudData';
import { useGameStore } from './gameStore';
import { useBillingStore } from './billingStore';
import { useIntroStore } from './introStore';
import { setPurchaseAccount } from '../platform/purchases';

interface Account { id: string; email: string; trialUsed: boolean }
interface CloudState {
  account: Account | null;
  ready: boolean;
  busy: boolean;
  enabled: boolean;
  lastBackup: number | null;
  message: string;
  pending: CloudSnapshot | null;
}
export const useCloudStore = create<CloudState>(() => ({
  account: null, ready: false, busy: false, enabled: false, lastBackup: null, message: '', pending: null,
}));
const META = 'hooplog-cloud-state';
let token: string | null = null;
let cursor: number | null = null;
let initialized: Promise<void> | undefined;
let revision = 0;
export function cloudChanged(): void {
  revision++;
  if (useCloudStore.getState().enabled) useCloudStore.setState({ message: 'Changes are waiting to back up.' });
}
const set = useCloudStore.setState;
function requireToken(): string {
  if (!token) throw new Error('Sign in to back up your data.');
  return token;
}
async function run(action: () => Promise<void>): Promise<void> {
  if (useCloudStore.getState().busy) return;
  set({ busy: true, message: '' });
  try { await action(); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      set({ enabled: false });
      // Verification-code errors happen before an account exists.
      if (useCloudStore.getState().account) set({ message: 'Your session expired. Sign out and sign in again.' });
      else set({ message: error.message });
    } else set({ message: error instanceof Error ? error.message : 'Connection failed. Please try again.' });
  } finally { set({ busy: false, ready: true }); }
}
async function remote(): Promise<CloudSnapshot> { return readCloud(await api('/sync?since=0', requireToken())); }
async function remember(enabled: boolean, lastBackup: number | null): Promise<void> {
  await Store.write(META, JSON.stringify({ accountId: useCloudStore.getState().account?.id, cursor, enabled, lastBackup }));
}
async function identify(): Promise<void> {
  const account = await api<Account>('/billing/me', requireToken());
  if (!account?.id || !account.email) throw new Error('The server returned an invalid account.');
  set({ account });
  // Purchase identity failures must not destroy a successfully authenticated backup account.
  void setPurchaseAccount(account.id).catch(() => {});
  if (account.trialUsed) useBillingStore.setState({ trialUsed: true });
  const raw = await Store.getItem(META);
  let saved: { accountId?: string; cursor?: number; enabled?: boolean; lastBackup?: number } = {};
  try { saved = raw ? JSON.parse(raw) ?? {} : {}; } catch { /* unassociated install */ }
  const snapshot = await remote();
  const recovering = !!await Store.getItem(CLOUD_RECOVERY);
  const associated = !recovering && cloudAssociated(saved, account.id, snapshot.cursor);
  cursor = associated ? snapshot.cursor : null;
  set({ enabled: !!associated, pending: associated ? null : snapshot,
    lastBackup: associated ? saved.lastBackup ?? null : null,
    message: recovering ? 'A restore was interrupted. Restore the cloud backup again before enabling automatic backup.' : associated ? 'Automatic backup is on.' : Object.keys(snapshot.rows).length
      ? 'A cloud backup is ready. Restore it, or choose to replace it with this device.'
      : 'No cloud backup yet. Back up this device to keep your roster and saved games.' });
}
export function initializeCloud(): Promise<void> {
  if (!initialized) initialized = run(async () => {
    const raw = await SessionVault.get();
    if (raw) {
      const saved = JSON.parse(raw) as { token: string; accountId: string; email: string };
      if (!saved.token || !saved.accountId || !saved.email) throw new Error('Please sign in again.');
      token = saved.token;
      set({ account: { id: saved.accountId, email: saved.email, trialUsed: false } });
      void setPurchaseAccount(saved.accountId).catch(() => {});
      await identify();
    }
  });
  return initialized;
}
export async function requestCode(email: string): Promise<string | null> {
  let challenge: string | null = null;
  await run(async () => {
    const result = await api<{ challenge: string }>('/auth/code/request', undefined, { email });
    if (typeof result.challenge !== 'string') throw new Error('The server did not return a sign-in request.');
    challenge = result.challenge;
    set({ message: 'Check your email for an eight-digit code. It expires in 15 minutes.' });
  });
  return challenge;
}
export async function verifyCode(challenge: string, code: string, email: string): Promise<void> {
  await run(async () => {
    const result = await api<{ token: string; accountId: string }>('/auth/code/verify', undefined, { challenge, code });
    if (typeof result.token !== 'string' || !result.token || typeof result.accountId !== 'string') throw new Error('The server returned an invalid session.');
    await SessionVault.set(JSON.stringify({ token: result.token, accountId: result.accountId, email: email.trim().toLowerCase() }));
    token = result.token;
    set({ account: { id: result.accountId, email: email.trim().toLowerCase(), trialUsed: false } });
    await identify();
  });
}
export async function refreshCloud(): Promise<void> {
  await run(async () => { if (token) await identify(); });
}

/** A conflict always stops uploads; it never chooses a winner silently. */
export async function backupNow(replace = false): Promise<void> {
  if (!replace && !useCloudStore.getState().enabled) return;
  await run(async () => {
    const state = useCloudStore.getState();
    if (await Store.getItem(CLOUD_RECOVERY)) throw new Error('Complete the interrupted restore before uploading this device.');
    const expected = replace ? state.pending?.cursor : cursor;
    const snapshot = await remote();
    if (expected === undefined || expected === null || snapshot.cursor !== expected) {
      set({ enabled: false, pending: snapshot });
      await remember(false, state.lastBackup);
      throw new Error('The cloud backup changed on another device. Review it before continuing.');
    }
    const began = revision;
    const local = await captureCloud();
    if (began !== revision) throw new Error('Your data changed while preparing the backup. It will retry shortly.');
    const changes = cloudChanges(local, snapshot.rows);
    // Persist the pause BEFORE sending. If the reply is lost, the next launch
    // cannot overwrite a newer cloud revision with stale local data.
    await remember(false, state.lastBackup);
    set({ enabled: false });
    try {
      const result = await api<{ cursor: number }>('/sync', requireToken(), { since: snapshot.cursor, rows: changes });
      if (!Number.isSafeInteger(result.cursor) || result.cursor < snapshot.cursor) throw new Error('Invalid backup confirmation.');
      cursor = result.cursor;
      const at = Date.now();
      await remember(true, at);
      set({ enabled: true, pending: null, lastBackup: at, message: began === revision ? 'Roster and saved games backed up.' : 'Backup saved. New changes are waiting.' });
      // Trial usage is server-owned and travels through its own endpoint.
      if (useBillingStore.getState().trialUsed) await api('/billing/trial', requireToken(), {}).catch(() => {});
    } catch (error) {
      // Keep the local snapshot intact. The next explicit refresh resolves an
      // uncertain upload without assuming that the server did not commit it.
      set({ pending: null, message: 'Backup was not confirmed. Check the cloud before retrying.' });
      throw error;
    }
  });
}
export async function restoreFromCloud(): Promise<void> {
  await run(async () => {
    if (cloudRestoreBlocked(useGameStore.getState()))
      throw new Error('Finish the current game before restoring a backup.');
    const state = useCloudStore.getState();
    if (!state.pending) throw new Error('Check the cloud backup first.');
    const snapshot = await remote();
    if (snapshot.cursor !== state.pending.cursor) {
      set({ pending: snapshot });
      throw new Error('The backup changed. Review it and restore again.');
    }
    const began = revision;
    set({ enabled: false });
    await remember(false, state.lastBackup);
    if (began !== revision) throw new Error('Local data changed. Please try restoring again.');
    await restoreCloud(snapshot.rows);
    cursor = snapshot.cursor;
    // removeItem is best effort; clearing this marker must be confirmed.
    await Store.write(CLOUD_RECOVERY, '');
    await remember(true, Date.now());
    useIntroStore.getState().finish();
    set({ enabled: true, pending: null, lastBackup: Date.now(), message: 'Your roster and saved games are restored.' });
  });
}
async function forgetSession(): Promise<void> {
  await SessionVault.clear();
  token = null;
  cursor = null;
  set({ account: null, enabled: false, pending: null, lastBackup: null, message: 'Signed out. Data on this device is unchanged.' });
  void setPurchaseAccount(null).catch(() => {});
  await Store.write(META, JSON.stringify({ enabled: false }));
}
export async function signOutCloud(): Promise<void> {
  await run(async () => {
    if (token) await api('/auth/signout', token, {}).catch(() => {});
    await forgetSession();
  });
}
export async function deleteCloudAccount(): Promise<void> {
  await run(async () => {
    await api('/auth/account', requireToken(), { confirmation: 'DELETE' }, 'DELETE');
    await forgetSession();
    set({ message: 'Account and cloud backup deleted. Local data is unchanged. Any store subscription must be cancelled separately.' });
  });
}
