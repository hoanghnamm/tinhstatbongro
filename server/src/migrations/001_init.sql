-- THE WHOLE SHAPE OF THE SERVER, and there are five tables in it.
--
-- `rows` is the one that matters: an account's storage, key by key, holding the
-- exact strings the app wrote. Nothing here knows what a game is.

create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),

  -- THE ACCOUNT'S OWN CLOCK. Every push that changes anything bumps this by
  -- one and stamps its rows with the new value, so a pull is one indexed range
  -- scan and two devices pushing in the same second still order deterministically.
  rev bigint not null default 0,

  -- what the store says, never what a client says
  entitled boolean not null default false,
  entitled_until timestamptz,
  entitlement_updated_at timestamptz,

  -- THE TRIAL LIVES HERE, not on the device. One free saved game per PERSON is
  -- what was meant; one per install is what a local flag can enforce, and a
  -- reinstall resets it. `lib/billing.ts` keeps the rule, this keeps the fact.
  trial_used_at timestamptz
);

create table login_tokens (
  hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index login_tokens_account on login_tokens (account_id);

create table sessions (
  hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  device text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_account on sessions (account_id);

create table rows (
  account_id uuid not null references accounts(id) on delete cascade,
  key text not null,

  -- the exact string the app has on its own disk. NOT jsonb: this server does
  -- not parse it, must not reformat it, and a round trip through jsonb would
  -- reorder keys and change the bytes a client compares against its own.
  value text,

  -- a tombstone, so a second device learns of a deletion rather than pushing
  -- the row back up on its next sync
  deleted boolean not null default false,

  rev bigint not null,
  updated_at timestamptz not null default now(),
  device text,

  primary key (account_id, key)
);
create index rows_since on rows (account_id, rev);

-- Every webhook RevenueCat has ever sent, kept whole. Idempotency by the
-- event's own id, and the raw body beside it because the one question nobody
-- can answer afterwards is "what did the store actually tell us".
create table billing_events (
  id text primary key,
  account_id uuid references accounts(id) on delete set null,
  type text not null,
  app_user_id text,
  environment text,
  body jsonb not null,
  received_at timestamptz not null default now()
);
create index billing_events_account on billing_events (account_id, received_at desc);
