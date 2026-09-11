import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { availablePackages, billingUnavailable, hasAccess, purchases } from '../platform/purchases';
import { useBillingStore } from '../store/billingStore';

const publish = (info: CustomerInfo) => useBillingStore.getState().setEntitled(hasAccess(info));

/** One subscription listener for the app; returning from the store refreshes access. */
export function usePurchaseSync() {
  useEffect(() => {
    let active = true;
    let remove: (() => void) | undefined;
    const sync = async () => {
      try { const sdk = await purchases(); const info = await sdk.getCustomerInfo(); if (active) publish(info); }
      catch { if (active) useBillingStore.getState().finishLoading(); }
    };
    void purchases().then(sdk => {
      if (!active) return;
      const listener = (info: CustomerInfo) => { if (active) publish(info); };
      sdk.addCustomerInfoUpdateListener(listener);
      remove = () => { sdk.removeCustomerInfoUpdateListener(listener); };
      void sync();
    }).catch(() => { if (active) useBillingStore.getState().finishLoading(); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void sync(); });
    return () => { active = false; remove?.(); subscription.remove(); };
  }, []);
}

/** The custom paywall uses the actual store packages and localized prices. */
export function usePurchaseOptions() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const unavailable = billingUnavailable();
  const reload = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const next = await availablePackages();
      if (mounted.current) { setPackages(next); if (!next.length) setMessage('No subscription plans are available yet.'); }
    } catch { if (mounted.current) setMessage(unavailable || 'Could not load plans. Check your connection and try again.'); }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  const transact = async (pkg?: PurchasesPackage): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true); setMessage(null);
    try {
      const sdk = await purchases();
      const info = pkg ? (await sdk.purchasePackage(pkg)).customerInfo : await sdk.restorePurchases();
      publish(info);
      const active = hasAccess(info);
      if (!active && mounted.current) setMessage(pkg ? 'Your purchase has not activated access yet. Try restoring purchases shortly.' : 'No active subscription was found for this store account.');
      return active;
    } catch (error) {
      const cancelled = !!(error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled);
      if (!cancelled && mounted.current) setMessage('Could not complete this request. Check your connection and try again.');
      return false;
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  return { packages, loading, busy, message, unavailable, reload, transact };
}
