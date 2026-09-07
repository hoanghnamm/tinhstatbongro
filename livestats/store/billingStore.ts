import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Entitlement } from '../lib/billing';

/**
 * THE SEVENTH STORE, AND IT HOLDS TWO BOOLEANS.
 *
 * It is its own store rather than two more keys on `gameStore` because it is
 * its own KIND of thing and it outlives every game: `gameStore` is cleared by
 * `startGame`, and an entitlement that a new game could wipe is an entitlement
 * a scorer would have to buy twice. The same argument that split `teamStore`
 * off `rosterStore` — a record with its own lifecycle belongs in its own file.
 *
 * **The rules are not here.** `lib/billing.ts` decides what `entitled` and
 * `trialUsed` mean for any given gate, on the same side of the line as
 * `lib/actions.ts`, so `npm run check` can walk the whole table without a
 * device. This file only remembers the two answers.
 *
 * ## THIS IS THE SEAM WHERE REAL BILLING GOES
 *
 * There is no store, no receipt and no network here yet — `unlock()` simply
 * sets the flag. When StoreKit / Play Billing lands, it lands BEHIND this
 * interface: `unlock()` becomes the thing that runs after a purchase resolves,
 * a `restore()` joins it, and NOT ONE consumer changes, because no screen in
 * the app asks anything but "am I entitled". Keeping that boundary now is the
 * whole reason the gates were built against a store rather than against a
 * purchase callback.
 *
 * It is persisted plainly, like the roster: two booleans written a handful of
 * times in an install's life, not 600 times a quarter.
 */
export interface BillingState extends Entitlement {
  /**
   * PAID. Today this is the debug unlock and the paywall's own button; later it
   * is what a resolved purchase calls. Nothing else in the app may write it.
   */
  unlock(): void;

  /**
   * The free game has been filed. Called ONCE, by `EndGamePanel`, in the same
   * breath as `saveGame` — the trial is spent on a game that reached the shelf,
   * so the call sits next to the thing that puts it there rather than next to
   * the thing that starts it.
   *
   * It is idempotent by construction: setting a `true` to `true` costs a render
   * that changes nothing, and it means a second END GAME cannot deduct twice.
   */
  useTrial(): void;

  /**
   * BACK TO A FRESH INSTALL. It exists so the paywall and every gate can
   * actually be walked through more than once on one device — without it,
   * testing the wall means deleting the app. It has no control in the UI and
   * is not reachable by a scorer.
   */
  resetBilling(): void;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set) => ({
      entitled: false,
      trialUsed: false,

      unlock: () => set({ entitled: true }),
      useTrial: () => set({ trialUsed: true }),
      resetBilling: () => set({ entitled: false, trialUsed: false }),
    }),
    {
      name: 'hooplog-billing',
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * ONLY THE TWO FACTS ARE WRITTEN. The actions are functions and would be
       * dropped by JSON anyway; naming the two keys explicitly is what stops a
       * later field being persisted by accident.
       */
      partialize: (s) => ({ entitled: s.entitled, trialUsed: s.trialUsed }),
      /**
       * BOTH DEFAULT TO FALSE ON A RECORD THAT PREDATES THEM, and the direction
       * matters: an install from before the paywall existed comes back as a
       * scorer who has NOT paid and has NOT used their trial, so they get their
       * free game rather than being locked out of an app they were already
       * using. `undefined` is falsy, so this is what happens anyway — it is
       * written down because the OTHER default would have been a bug that only
       * appeared on an upgrade.
       */
      version: 1,
    },
  ),
);
