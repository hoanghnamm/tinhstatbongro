/**
 * WHO IS ASKING — the one middleware, and everything past `/auth` wears it.
 */
import type { Context, Next } from 'hono';

import { one, query } from './db.js';
import { bearer, hashToken, SESSION_TOUCH_MS, SESSION_TTL_MS } from './lib/tokens.js';

export interface Signed {
  Variables: {
    accountId: string;
  };
}

export interface Account {
  id: string;
  email: string;
  rev: string;
  entitled: boolean;
  entitled_until: Date | null;
  trial_used_at: Date | null;
}

export async function accountFor(token: string): Promise<Account | null> {
  const hash = hashToken(token);
  const row = await one<Account & { expires_at: Date; last_seen_at: Date }>(
    `select a.id, a.email, a.rev, a.entitled, a.entitled_until, a.trial_used_at,
            s.expires_at, s.last_seen_at
       from sessions s join accounts a on a.id = s.account_id
      where s.hash = $1`,
    [hash],
  );
  if (!row) return null;
  if (row.expires_at.getTime() <= Date.now()) {
    await query('delete from sessions where hash = $1', [hash]);
    return null;
  }

  // Renewed on use, but not on every request — a scorer tapping through a game
  // would otherwise write a row per sync.
  if (Date.now() - row.last_seen_at.getTime() > SESSION_TOUCH_MS) {
    await query(
      `update sessions set last_seen_at = now(), expires_at = now() + ($2::bigint * interval '1 millisecond')
        where hash = $1`,
      [hash, SESSION_TTL_MS],
    );
  }
  return row;
}

export async function signedIn(c: Context<Signed>, next: Next) {
  const token = bearer(c.req.header('authorization'));
  if (!token) return c.json({ error: 'Sign in to sync' }, 401);
  const account = await accountFor(token);
  if (!account) return c.json({ error: 'That session has expired' }, 401);
  c.set('accountId', account.id);
  return next();
}
