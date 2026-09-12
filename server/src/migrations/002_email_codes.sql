create table email_codes (
  hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index email_codes_expiry on email_codes (expires_at);
