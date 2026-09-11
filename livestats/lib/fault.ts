/**
 * WHAT HAPPENS WHEN THE DISK SAYS NO, and who gets told.
 *
 * Every store in this app persists fire-and-forget: zustand's `persist` drops
 * the promise its storage returns, `gameStore`'s debounced writer says `void
 * AsyncStorage.setItem(...)`, and `historyStore.saveGame` files a finished game
 * the same way. That is the right shape — a scorer mid-possession cannot wait
 * on a disk — but it means a REJECTED write is an unhandled rejection and
 * nothing else. No throw, no log, no toast. The board keeps taking taps and
 * none of them are being kept.
 *
 * That is not hypothetical on the web, where `AsyncStorage` IS `localStorage`
 * and the whole origin gets about 5MB: thirty saved games plus a club crest is
 * already most of it, and the first write past the line throws
 * `QuotaExceededError` for ever after. The scorer finds out the next morning.
 *
 * So the writes stay fire-and-forget and the FAILURE gets a channel of its own.
 * This module is that channel and it is deliberately tiny: a latch and a
 * listener, no React, no store, no platform. `platform/storage.ts` and
 * `platform/storage.web.ts` report into it; `hooks/useStorageFault.ts` is the
 * one reader and it turns a fault into the toast every other confirmation in
 * this app already uses.
 *
 * IT LATCHES, AND THAT IS THE POINT. A full disk fails every write, so a
 * listener called on each one would toast every two seconds for the rest of the
 * game — which is how a warning becomes wallpaper. The listener fires on the
 * EDGE only: clear → faulted, and faulted → clear when a write lands again.
 */

/**
 * The two ways a write fails, and they are two because the scorer can only do
 * something about one of them.
 *
 * `full` is out of room: saved games can be deleted, a crest can be dropped,
 * and the sentence that names it can say so. `blocked` is the browser refusing
 * storage at all — private browsing, site data switched off, a wiped origin —
 * where deleting things changes nothing and the only real answer is to export a
 * backup before closing the tab.
 */
export type Fault = 'full' | 'blocked';

/**
 * WHAT THE SCORER IS TOLD, in one line each — the same shape as
 * `GATE_PITCH` in `lib/billing.ts`, and here for the same reason: the sentence
 * belongs beside the thing it names, so the toast and the settings page cannot
 * drift into saying two different things about one fault.
 *
 * Both are phrased as WHAT IS HAPPENING rather than what to do, because the
 * toast is one line that lives for 2.6 seconds and an instruction that cannot
 * be read in that time is worse than a fact that can. The instruction is on
 * the settings page, under BACKUP, where there is room for it and a button
 * beside it.
 */
export const FAULT_NOTE: Record<Fault, string> = {
  full: 'Storage is full — nothing is being saved',
  blocked: 'Storage is blocked — nothing is being saved',
};

let current: Fault | null = null;
const listeners = new Set<(fault: Fault | null) => void>();

const publish = (): void => {
  for (const fn of listeners) fn(current);
};

/**
 * WHICH KIND OF NO. Browsers disagree about how to say "out of room" and the
 * disagreement is old: the standard name is `QuotaExceededError`, Chrome also
 * sets legacy code 22, and Safari raises `NS_ERROR_DOM_QUOTA_REACHED` with code
 * 1014 instead. All three mean the same thing to a scorer, so all three land on
 * `full`. Anything else — including a `DOMException` from a browser that will
 * not open a database at all — is `blocked`.
 */
export function classify(error: unknown): Fault {
  const e = error as { name?: unknown; code?: unknown } | null;
  if (!e || typeof e !== 'object') return 'blocked';
  const name = typeof e.name === 'string' ? e.name : '';
  const code = typeof e.code === 'number' ? e.code : 0;
  return name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
    ? 'full'
    : 'blocked';
}

/** A write failed. Only the EDGE is published; see the latch note above. */
export function reportFault(fault: Fault): void {
  if (current === fault) return;
  current = fault;
  publish();
}

/**
 * A write landed. Called on every success rather than only after a fault,
 * because it costs a comparison and it is what lets the warning go away on its
 * own once the scorer has deleted a game.
 */
export function clearFault(): void {
  if (current === null) return;
  current = null;
  publish();
}

/** What the storage is doing right now, or `null` while it is behaving. */
export const storageFault = (): Fault | null => current;

/** Subscribe. Returns the unsubscribe, so a hook can hand it straight back. */
export function onStorageFault(fn: (fault: Fault | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Back to a clean slate. `npm run check` is the only caller. */
export function resetFault(): void {
  current = null;
  listeners.clear();
}
