# Sign-in and cloud backup

The app backs up the club profile (without native crest photos), player roster,
squads, and saved games. The current game, board settings and purchase flags do not
travel. The existing saved-game shelf limit still applies. Backup is available to
signed-in accounts without a subscription gate.

## Configure Railway

Deploy this repository's `server/` directory with `npm run build` and `npm start`.
Set these variables on the server service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Reference your Postgres service, e.g. `${{Postgres.DATABASE_URL}}` |
| `RESEND_API_KEY` | Private Resend sending key |
| `MAIL_FROM` | A sender at your verified Resend domain, e.g. `HoopRec <login@example.com>` |
| `ALLOW_DEV_LOGIN` | `false` |
| `REVENUECAT_ENTITLEMENT_ID` | `pro`, matching the mobile app |
| `REVENUECAT_WEBHOOK_SECRET` | Your private webhook Authorization value |

The new `002_email_codes.sql` migration runs automatically on startup. Do not
manually rerun the initial migration. Existing accounts and backups remain.

Find the server's public URL under Settings → Networking → Public Networking.
Generate a domain if needed. Open `https://YOUR-DOMAIN/health` and confirm
`{"ok":true}`. Use the server service, not the database's private hostname.

Email-code sign-in uses `/auth/code/request` and `/auth/code/verify`. It requires
Resend and a verified sender; it never logs or returns the code to the caller.
The old magic-link endpoints remain for compatibility, but this app does not
need `APP_LINK_BASE` or a universal-link domain to sign in using a code.

## Configure the app build

Add `EXPO_PUBLIC_API_URL=https://YOUR-DOMAIN` to the app's local environment and
to the EAS production build environment. Use the HTTPS origin without `/health`.
The variable is compiled into the app; changing Railway variables alone cannot
change an already-built app. Never place DATABASE_URL or private keys in Expo
public variables.

SecureStore is a new native dependency. Make a new development or production
native build before testing; an update to JavaScript alone is not sufficient for
an older binary. Native session credentials are stored in SecureStore; browser
sessions use sessionStorage and end with the tab.

Keep the existing RevenueCat SDK keys and offering settings. After sign-in the
app identifies the account UUID to RevenueCat before purchases. RevenueCat can
then deliver account-linked events to `/billing/revenuecat`. Configure its
Authorization header to match the server secret exactly. The SDK still supplies
paid access and its offline cache; cloud backup does not depend on webhook delivery.

## First backup

1. Open Settings → Account and cloud backup → Sign in.
2. Enter your email and the eight-digit code. Codes expire in 15 minutes and allow
   five attempts; requesting a new code is rate-limited.
3. If the account is empty, choose Back up this device.
4. Wait for “Roster and saved games backed up” and a confirmation time.

Changes to the team, roster, squads and saved-game index schedule another backup
after two seconds. Foregrounding the app and a one-minute timer also retry while
the account is associated and online. Work remains local when offline. A deleted
app cannot upload unsent changes, so wait for a confirmed backup before uninstalling.

## Reinstall or a second device

1. On the first onboarding step, choose Already have a backup? Sign in.
2. Use the same email address and enter a new code.
3. Review the cloud game count and choose Restore cloud backup, then Confirm.
4. Return to your team and games.

Fresh installs cannot automatically upload their blank roster over an existing
account. Restoring replaces local roster/squads/saved games, requires the current
game to be finished, and keeps a local recovery snapshot until the restore succeeds.
It validates the snapshot, writes game records before the index, and reloads all
four stores. The cloud copy is never deleted by restoring it.

## Conflicts and uncertain uploads

This release is automatic backup with explicit restore, not collaborative live
sync. When another device changes the cloud revision, uploads stop. Choose to
restore the cloud backup or explicitly replace it with this device. There is no
silent merge of conflicting rosters or game indexes.

If an upload's reply is lost, it may have committed. Automatic upload stays paused;
Check cloud backup retrieves the server's current state before a choice is made.
Sign-out keeps local data but disables automatic upload. A different account must
explicitly choose before those local records are uploaded.

## Account deletion

Delete account and cloud data requires confirmation. The server deletes email
codes, sessions, backups, account-linked webhook records and the account. Local
data stays on the device. Apple/Google subscriptions are not cancelled by account
deletion and must be managed in the store.

## Release verification

Run the app and server `npm run check` and `npm run typecheck`; build the server.
The tests cover snapshot validation, account/revision isolation, code consumption,
attempt limits, migration locking, and simulated database/email paths. They do
not verify live Resend delivery or real PostgreSQL behavior.

Before releasing, test on a native device against a staging server: request a real
email, save a roster and game, confirm backup, uninstall/reinstall, sign in again,
restore, and compare every player and game. Also test offline edits, two-device
conflicts, sign-out/account switching, deletion, and RevenueCat purchase restoration.
Enable Railway database backups separately: application sync is not disaster recovery.
