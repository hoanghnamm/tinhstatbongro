import AsyncStorage from '@react-native-async-storage/async-storage';

import { classify, clearFault, reportFault } from '../lib/fault';

/**
 * THE ONE DOOR TO THE DISK, and there are two of these files.
 *
 * This is the NATIVE one and it is a thin wrapper over `AsyncStorage`, which is
 * what every store used to import directly. `platform/storage.web.ts` is the
 * other, resolved by Metro's platform extension on web, and it is a different
 * database entirely — see the long note at the top of that file for why
 * `localStorage` could not stay.
 *
 * Nothing else about persistence changed: the stores still call
 * `createJSONStorage(() => Store)`, `gameStore` still debounces, and the
 * walkthrough's `pausePersist` still drops writes. What this seam buys is that
 * a FAILED write is now reported instead of vanishing — see `lib/fault.ts`.
 *
 * ## `setItem` NEVER REJECTS, AND `write` ALWAYS DOES
 *
 * Two methods for one operation, because there are two kinds of caller and
 * giving them one method got the failure swallowed either way.
 *
 * Persistence is fire-and-forget by design — zustand's `persist` drops the
 * promise it gets back, and `gameStore`'s writer says `void`. Handing those an
 * operation that can REJECT produces an unhandled rejection and nothing else,
 * which is the bug this whole seam exists to close. So `setItem` reports the
 * fault and resolves: the write failed, somebody was told, and no caller has to
 * remember to catch.
 *
 * `write` is the same write for the one caller that must BRANCH on it —
 * `teamStore.setLogo`, which will not replace a club's crest until it knows the
 * new one is on the disk. It reports the fault too, and then rejects.
 */
export interface KeyStore {
  getItem(key: string): Promise<string | null>;
  /** best effort: reports a fault, never rejects */
  setItem(key: string, value: string): Promise<void>;
  /** the same write, for a caller that must know — reports AND rejects */
  write(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** every key this app owns, for the backup file */
  keys(): Promise<string[]>;
}

/** `hooplog-*` is everything but the live board, which predates the rename. */
export const OURS = /^(?:hooplog-|livestats-)/;

export const Store: KeyStore = {
  getItem: (key) => AsyncStorage.getItem(key),

  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
      clearFault();
    } catch (error) {
      reportFault(classify(error));
    }
  },

  write: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
      clearFault();
    } catch (error) {
      reportFault(classify(error));
      throw error;
    }
  },

  // A REMOVAL THAT FAILS IS NOT A FAULT. It is the one operation that makes
  // room rather than taking it, and a scorer told "storage is full" while
  // deleting a game to fix exactly that would be told the wrong thing.
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* nothing to tell */
    }
  },

  keys: async () => {
    try {
      return (await AsyncStorage.getAllKeys()).filter((k) => OURS.test(k));
    } catch {
      return [];
    }
  },
};
