# HoopRec web release

Requested distribution: install from a website on Android and iPhone, with paid
access and payments received in Vietnam. Use the existing Expo app as a PWA.

## Current status

The web build includes install metadata, the existing app icon, and a versioned
offline cache of the exported app, fonts and images. Browser club logos are
stored as bounded PNG data URIs. Pending game edits flush on page hide even when
the clock is stopped. Native app behavior is preserved.

Web storage is IndexedDB, not `localStorage`, and existing installs migrate on
first launch. A failed write is reported to the scorer instead of being dropped
silently. Settings carries a backup block: save the club, roster and saved games
to a file, and restore one by replacing what is on the device. Backups never
carry entitlement. See the storage section in `docs/DECISIONS.md`.

The Sites project is registered in `livestats/.openai/hosting.json`. It has **not
been deployed or opened to public access**. Registration is not a live URL.

**Real checkout and account recovery are not implemented.** The existing native
and development purchase button remains a prototype. Production web deliberately
disables it and states that paid access is not available. Do not publish this as
a paid product until the integration below is complete.

## Build and verify

Run from `livestats`:

```sh
npm run check
npm run typecheck
npm run build:web
npm run check:web
```

`build:web` prepares `public/index.html` and the manifest from the palette, exports
Expo's single-page web app, and generates `dist/sw.js` from all exported app
resources. Generated public files and `dist` are ignored by Git. No dependency
was added. The existing 1024px native icon is copied unchanged.

`check:web` checks the actual exported metadata and PNG dimensions and executes
the generated worker with a simulated cache/network. It verifies cached deep
routes and resources, a pinned release while the server changes, and bypasses
for account/payment paths. This is not a substitute for physical-device testing.

Host the **contents of `dist`** at an HTTPS origin's root. Configure SPA fallback
to `index.html` for app routes, but serve missing assets as 404. Revalidate
`sw.js`, HTML and the manifest; hashed Expo assets can be immutable. Future
server routes must take precedence over SPA fallback.

## Installation and updates

- Android: open the HTTPS app link in Chrome, then use Install app / Add to home
  screen when offered.
- iPhone: open it in Safari, use Share → Add to Home Screen, and enable Open as
  Web App if offered.
- Open the app online and allow its first offline cache to finish before taking
  it courtside. Confirm offline reopening on the actual device before launch.
- Updates wait until all HoopRec tabs and home-screen windows are closed. An
  ordinary refresh intentionally keeps an active release; no update reloads a
  scoring session. Cache cleanup never deletes game storage.
- Games and roster data stay in that browser on that origin. There is no cloud
  backup or cross-device sync. Clearing site data removes local stats, and moving
  to a new domain creates a separate storage area. Choose the launch domain before
  onboarding paying users.
- **Adding the app to the home screen is a data-safety requirement, not a
  convenience.** Safari clears script-writable storage for a site the reader has
  not opened in seven days; a home-screen web app is exempt. Verify this on a
  physical iPhone before onboarding paying users, and make the install step part
  of onboarding rather than a suggestion.
- The backup file in Settings is the only recovery path that needs no account,
  no network and no server. Tell paying users to take one after each match day.
- Still open: `navigator.storage.persist()` is not requested, the web crest is
  still a PNG data URI capped at 800,000 characters, and nothing syncs.

## Paid release dependency

Paddle is a candidate for this Vietnam-based software business, subject to seller
and website approval. Vietnam is not on its excluded supplier list, and its
billing API supports VND subscriptions. This does not establish that a particular
seller account is approved or that every Vietnamese local payment method works.

Sources checked on 2026-09-09:

- [Paddle supplier countries](https://www.paddle.com/help/legal/sanctions/which-countries-are-supported-by-paddle)
- [VND subscriptions](https://developer.paddle.com/changelog/2024/vietnamese-dong-vnd-supported-currency/)
- [Payment and payout currencies](https://developer.paddle.com/concepts/sell/supported-currencies/)
- [Expo PWA support](https://docs.expo.dev/guides/progressive-web-apps/)
- [iPhone web app installation](https://support.apple.com/en-tm/guide/iphone/iphea86e5236/ios)

Next steps for the paid implementation:

1. The owner creates the provider account and completes seller/payout setup.
   Owner identity, payout details and provider agreements must be supplied by
   the owner. Never paste secret API keys into chat or client-side Expo variables.
2. Confirm the existing displayed plans (99,000 VND/month and 999,000 VND/year),
   including tax display, before creating live products.
3. Add customer authentication, server-side entitlement records and purchase
   recovery. A local boolean cannot verify a subscription. Use authenticated
   server checkout sessions and verified, replay-safe payment webhooks; a browser
   redirect or client callback never grants paid access by itself.
4. Implement cancellation, renewal, refund and payment-failure handling, with a
   defined offline access period so courtside scoring does not depend on a live
   checkout request. Recovery of paid access does not imply cloud sync of stats.
5. Add the owner's support contact and accurate privacy, terms and refund pages
   required for the chosen provider. Complete website approval and configure
   live server secrets through the host's secret settings.
6. Validate sandbox purchases, interrupted checkout, duplicate/out-of-order
   webhooks, cancellation/refund, paid-access recovery and offline reopening.
   Verify Safari on iPhone and Chrome on Android, including orientation, logo
   persistence, scoring, game save/reopen, PDF export and a pending app update.
7. Publish the validated paid release to the selected public audience and verify
   installation from its final HTTPS origin.
