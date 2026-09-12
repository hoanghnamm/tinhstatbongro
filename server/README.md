# HoopRec server

Accounts, cloud backup and the entitlement — the three things a phone cannot hold on its own.

The app in `livestats/` still works with no network and no account. This is addition, not
foundation: a scorer who never signs in loses nothing they had.

## What it is

**A row store, not a model of games.** `lib/backup.ts` in the app already decided that a backup is
a key dump — the raw strings each store wrote, restored by writing them back, so a file lands
through each store's own migration. Sync is that idea with an account behind it.

The consequence is the whole design: **the server never parses a `GameState`.** Adding a field to
`Player` needs no migration here and no deploy here, and a phone on an old build and a phone on a
new one sync with each other without either knowing. It also means the server cannot merge two
versions of a row, which is why a stale push is refused rather than resolved — see below.

Five rows per account:

| key | what |
|---|---|
| `hooplog-team` | the club — name, crest, coaches |
| `hooplog-roster` | the pool |
| `hooplog-squads` | the club's teams |
| `hooplog-history` | the index of saved games |
| `hooplog-game:<id>` | one saved game, one row each |

`hooplog-billing` never travels — an entitlement a client could push is an entitlement a client
could grant itself. Nor do `livestats-game` (the board mid-possession), `hooplog-intro` or
`hooplog-tutorial` (facts about an install, not a club). `src/lib/keys.ts` holds the list and
`npm run check` asserts it still matches the app's.

## The sync protocol

The account has one clock: `accounts.rev`. A push that changes anything bumps it by one and stamps
every row it touched. A client's cursor is the last rev it has seen.

```
GET  /sync?since=<cursor>   -> { cursor, rows: [{ key, value, deleted, rev }] }
POST /sync { since, rows }  -> { cursor, applied }          200
                            -> { cursor, rows, error }      409  this device is behind
```

**A stale push is refused, not applied.** If the account moved on since the cursor the push was
built against, nothing is written and the `409` carries the rows that moved — one round trip, not a
second request.

Per-row last-writer-wins looks like the obvious answer and loses seasons. `hooplog-history` is the
index that makes saved games *reachable*: a device offline for a week that pushed its own index
would leave games filed elsewhere sitting on the server unreachable — present and invisible, the
worst shape data loss takes. The server cannot fix that because it will not parse the index, so the
client reconciles, where `GameSummary` and every migration already live.

In practice the refusal is rare: two devices each filing their own games touch disjoint keys, and
saved games are written once and deleted, never edited. The only rows two devices genuinely
disagree about are the four singletons.

## Auth

Magic link. No passwords — the app never holds a secret a person reuses elsewhere — and no
third-party sign-in, which also keeps Sign in with Apple from becoming mandatory on iOS.

```
POST /auth/request { email }           -> { sent: true }
POST /auth/verify  { token, device }   -> { token, account }
POST /auth/signout                     -> { signedOut: true }
```

Sessions are opaque random strings stored as SHA-256 hashes, so a database dump hands nobody a
working session. They last a year and renew on use: being asked to sign in again at courtside two
minutes before a tip-off is the app failing at the one moment it is needed. They are revocable,
which is what a signed token could not give.

`/auth/request` answers identically whether or not the address has an account, and creates one on
first ask — there is no branch a caller can observe, so this is not a tool for finding out who uses
the app.

## Billing

```
POST /billing/revenuecat   the webhook (shared secret in `authorization`)
GET  /billing/me           who the app is talking to, and whether they have paid
POST /billing/trial        the trial is spent — the copy that survives a reinstall
```

The entitlement stops being a fact about a device. The RevenueCat SDK's cache becomes what it
should always have been: the offline fallback.

**One ordering constraint, and it is not recoverable if missed.** RevenueCat identifies a payer by
`app_user_id`. Left alone the SDK invents an anonymous one per install, which can never be joined
to an account afterwards. The client must call `Purchases.logIn(accountId)` with the id from
`/billing/me` **before the first purchase** — a payment made under an anonymous id is attached to a
device and no webhook can repair it later.

The webhook answers `200` to almost everything, because RevenueCat retries on anything else and a
non-2xx must mean "send it again". It is idempotent by event id, and it **refuses every request
until `REVENUECAT_WEBHOOK_SECRET` is set** — an unauthenticated webhook endpoint is a form for
granting yourself a subscription.

`CANCELLATION` deliberately does not revoke: a cancelled subscription has been paid for to the end
of its term. An event type this file has never heard of grants rather than revokes, and
`expiration_at_ms` closes that by itself.

## Running it

```
cd server
npm install
cp .env.example .env        # point DATABASE_URL at a local Postgres
npm run dev                 # migrations run at boot
npm run check               # the whole test suite — no database, no network
npm run typecheck
```

`npm run check` is one assert script, like the app's. Every rule lives in `src/lib/` as plain
functions over plain data; `src/index.ts` and `src/routes/` are wiring and should stay that way.

With no `RESEND_API_KEY` sign-in links are printed to the log. Set `ALLOW_DEV_LOGIN=true` to have
`/auth/request` hand the link back in the response — its own flag rather than a `NODE_ENV` check,
because a staging box that quietly returns login tokens is a staging box that hands out accounts.

## Deploying to Railway

1. **Set the service's Root Directory to `server`.** This is a monorepo and the repo root has no
   `package.json`; without this the build fails before it starts.
2. Add a PostgreSQL database to the same Railway project and environment (`+ New` → Database →
   PostgreSQL). Then open the **server service** → **Variables** and add a reference variable:
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Replace `Postgres` with the database service's exact
   name, or select its `DATABASE_URL` through Railway's variable reference picker. Creating the
   database does **not** automatically add this variable to the server service. Railway supplies
   the server's `PORT` separately. Apply the variable changes and redeploy.
3. Set the rest from `.env.example` — at minimum `REVENUECAT_WEBHOOK_SECRET` and `APP_LINK_BASE`,
   plus `RESEND_API_KEY` before anyone outside the team signs in.
4. In RevenueCat: Integrations → Webhooks → the deployed URL + `/billing/revenuecat`, with the same
   secret as the `Authorization` header value.

`railway.json` carries the build and start commands and points the health check at `/health`.
**The build command is `npm run build` and must not install.** Nixpacks installs in its own
earlier phase and attaches a build cache at `node_modules/.cache`; an `npm ci` in the BUILD
phase wipes `node_modules` first, cannot remove that live mount, and dies `EBUSY`.
Migrations run at boot inside one transaction protected by a PostgreSQL advisory lock, including
creation of the migration tracking table, so simultaneous instances cannot apply the same schema.
Failure rolls the pending batch back. Database connections time out after 5 seconds and SQL
statements after 15 seconds. Idle connection errors are logged without terminating the server.
Shutdown stops incoming HTTP requests before closing the database, with a 20-second deadline.
Email requests time out after 10 seconds.

`npm run check` also exercises transaction rollback, migration ordering and idle connection errors
with a fake database client. This does not replace a live PostgreSQL deployment smoke test.

If startup says `DATABASE_URL is not set`, check the **server service's** variables in the
environment being deployed. A variable on the database service alone, or in a local `.env`,
does not configure the deployed server. Do not use the example's `localhost` URL in production.
This server uses PostgreSQL (`pg` and SQL migrations); Firebase is not required. Tables are
created by migrations at startup. Once deployed, open `/health` on the server's public URL.
Keep the database URL in server variables, never in an `EXPO_PUBLIC_` app variable or Git.

## App sign-in and backup

The app now has email-code sign-in in Settings and on the first onboarding step.
`POST /auth/code/request` sends an eight-digit code through Resend;
`POST /auth/code/verify` exchanges its challenge and code for a session. Codes
expire after fifteen minutes, permit five attempts, and are consumed atomically
with session creation. They are never logged or returned in a response.
`DELETE /auth/account` requires a session and `{ "confirmation": "DELETE" }`.

`livestats/store/cloudStore.ts` coordinates automatic backups and explicit restores.
A fresh install and a revision conflict cannot upload without an explicit choice.
Sessions use SecureStore on native, and account UUIDs identify RevenueCat customers.
Paid access still comes from RevenueCat CustomerInfo; the server trial flag is
reported separately. See [the setup and reinstall test guide](../docs/CLOUD-BACKUP.md).
