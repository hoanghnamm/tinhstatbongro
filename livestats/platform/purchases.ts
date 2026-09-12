import { revenueCatAccess } from '../lib/billing';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

export const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';
const offeringId = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID;
const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;

export function billingUnavailable(): string | null {
  if (Platform.OS === 'web') return 'Subscriptions are available in the iOS and Android app.';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return 'Purchases require the development build or store app.';
  if (!apiKey) return 'Subscriptions are not available yet.';
  return null;
}

let ready: Promise<typeof import('react-native-purchases')['default']> | undefined;
let accountId: string | null = null;
let identityWork: Promise<void> = Promise.resolve();
export async function setPurchaseAccount(id: string | null): Promise<void> {
  accountId = id;
  if (billingUnavailable()) return;
  await purchases();
}
export async function purchases() {
  const unavailable = billingUnavailable();
  if (unavailable) return Promise.reject(new Error(unavailable));
  if (!ready) ready = import('react-native-purchases').then(async ({ default: sdk }) => {
    if (!await sdk.isConfigured()) sdk.configure({ apiKey: apiKey! });
    return sdk;
  }).catch(error => { ready = undefined; throw error; });
  const sdk = await ready;
  identityWork = identityWork.catch(() => {}).then(async () => {
    const desired = accountId;
    const current = await sdk.getAppUserID();
    if (desired && current !== desired) await sdk.logIn(desired);
    else if (!desired && !await sdk.isAnonymous()) await sdk.logOut();
  });
  await identityWork;
  return sdk;
}

export const hasAccess = (info: CustomerInfo): boolean => revenueCatAccess(info.entitlements.active, entitlementId);

export async function availablePackages(): Promise<PurchasesPackage[]> {
  const sdk = await purchases();
  const offerings = await sdk.getOfferings();
  const offering = offeringId ? offerings.all[offeringId] : offerings.current;
  return offering ? [offering.monthly, offering.annual].filter((p): p is PurchasesPackage => !!p) : [];
}
