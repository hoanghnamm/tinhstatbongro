import { Store } from '../platform/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Entitlement } from '../lib/billing';

/** Paid access is published only from RevenueCat CustomerInfo, never a local purchase flag. */
export interface BillingState extends Entitlement {
  ready: boolean;
  setEntitled(entitled: boolean): void;
  finishLoading(): void;
  useTrial(): void;
  resetBilling(): void;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set) => ({
      entitled: false,
      trialUsed: false,
      ready: false,
      setEntitled: (entitled) => set({ entitled, ready: true }),
      finishLoading: () => set({ ready: true }),
      useTrial: () => set({ trialUsed: true }),
      resetBilling: () => { if (__DEV__) set({ entitled: false, trialUsed: false }); },
    }),
    {
      name: 'hooplog-billing',
      storage: createJSONStorage(() => Store),
      // RevenueCat owns its offline cache; the old local unlock must not survive migration.
      partialize: (s) => ({ trialUsed: s.trialUsed }),
      version: 2,
      migrate: (persisted) => ({ trialUsed: !!(persisted as Partial<Entitlement> | undefined)?.trialUsed }),
      merge: (persisted, current) => ({ ...current, trialUsed: !!(persisted as Partial<Entitlement> | undefined)?.trialUsed }),
    },
  ),
);
