# RevenueCat setup

The native integration is implemented for iOS and Android. Store configuration and sandbox purchase testing are still required. The app retains its custom paywall and one-free-saved-game rule. Web checkout is not enabled.

## Dashboard and stores

1. Create a RevenueCat project for HoopLog. Add an Apple App Store app with bundle ID `com.n2937.hooplog`.
2. In App Store Connect, create the app if needed and complete the agreements, tax and banking setup. Create one auto-renewable subscription group with monthly and yearly products. Choose the prices there; the app displays the localized store prices.
3. Connect the Apple app to RevenueCat using the credentials requested in its dashboard. Upload Apple private keys directly to RevenueCat, never to this repository or chat.
4. Import the products into RevenueCat. Create an entitlement with identifier `pro` and attach both products.
5. Create an offering, mark it current, and attach the monthly product to the Monthly package and the yearly product to the Annual package. RevenueCat-hosted paywall design is unnecessary because the app uses its existing UI.
6. Copy `livestats/.env.example` to `livestats/.env.local`. Set the Apple public SDK key and entitlement ID. Leave offering ID empty to use the current offering, or enter the exact identifier. Set public Privacy Policy and Terms of Use URLs before release.
7. For Android, obtain a Google Play Console account, create the same application ID, configure subscriptions and base plans, and connect the Play app to RevenueCat. Attach those products to the same entitlement and offering, then set the Google public SDK key.

The names `pro` and the current offering are configurable defaults, not resources created by the code. Never place RevenueCat secret API keys in `EXPO_PUBLIC_*` variables. Use the same environment values for local development and EAS builds.

## Test on an iPhone

The existing `development` profile builds an iOS simulator app. Windows users testing an actual iPhone should use the new `development-device` profile:

```powershell
cd livestats
npx eas-cli build --platform ios --profile development-device
npx expo start --dev-client
```

EAS will require Apple signing/device setup. No cloud build was submitted as part of the integration. Real purchases require a native build; Expo Go remains usable but its checkout is disabled. Android uses the same development-device profile with `--platform android`.

Before release, test monthly and yearly sandbox purchases, cancellation, pending approval, restoration, renewal and expiration, an offline relaunch, and an offering/network error. Verify that the displayed prices match the store, cancelled purchases do not grant access, expired entitlements revoke access, and the trial flag survives purchase/restore operations. Supply working legal URLs and check the subscription disclosures for both stores.

## Implementation

- `platform/purchases.ts`: lazy native SDK initialization, public configuration, offerings and entitlement mapping. Anonymous RevenueCat identity is used because HoopLog has no login system. Store restoration can recover purchases on the same store account; cross-platform identity sharing is not provided.
- `hooks/usePurchases.ts`: app-wide CustomerInfo listener, foreground refresh, package loading, purchase and restore operations. Missing setup, Expo Go, and web cannot unlock through a fake purchase.
- `store/billingStore.ts`: only `trialUsed` persists. Legacy local paid flags are discarded; RevenueCat owns its CustomerInfo/offline cache.
- `app/paywall.tsx`: real package prices, purchase state, restore/retry actions and optional configured legal links.
- `hooks/useGate.ts`: launch paywall waits for initial subscription loading. Existing feature gate rules remain unchanged.

Official setup reference: https://www.revenuecat.com/docs/getting-started/installation/expo
