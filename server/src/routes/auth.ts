/**
 * THE DOOR: ask for a link, spend the link, get a session.
 *
 * ## ASKING NEVER SAYS WHETHER THE ACCOUNT EXISTS
 *
 * `POST /auth/request` answers the same way for an address that has an account
 * and one that does not, because the alternative turns this endpoint into a
 * tool for finding out who uses the app. The account is created on first ask
 * rather than on first sign-in for the same reason: there is no branch a caller
 * can observe.
 */
import { Hono } from 'hono';

import { one, query } from '../db.js';
import { env } from '../env.js';
import { LINK_LIMIT, Window } from '../lib/rate.js';
import { hashToken, LOGIN_TTL_MS, mintToken, SESSION_TTL_MS } from '../lib/tokens.js';
import { readEmail } from '../lib/wire.js';
import { send, signInMail } from '../mail.js';
import { accountFor, signedIn, type Signed } from '../session.js';
import { stillEntitled } from '../lib/entitlement.js';

const byEmail = new Window(LINK_LIMIT);
const byAddress = new Window({ burst: 20, windowMs: 15 * 60 * 1000 });
setInterval(() => {
  byEmail.sweep();
  byAddress.sweep();
}, 5 * 60 * 1000).unref();

export const auth = new Hono<Signed>();

auth.post('/request', async (c) => {
  const read = readEmail(await c.req.json().catch(() => null));
  if ('refusal' in read) return c.json({ error: read.refusal }, 400);
  const { email } = read;

  const from = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!byEmail.take(email) || !byAddress.take(from))
    return c.json({ error: 'Too many sign-in links. Try again in a few minutes.' }, 429);

  const account = await one<{ id: string }>(
    `insert into accounts (email) values ($1)
       on conflict (email) do update set email = excluded.email
       returning id`,
    [email],
  );
  if (!account) return c.json({ error: 'Could not start a sign-in' }, 500);

  const token = mintToken();
  await query(
    `insert into login_tokens (hash, account_id, expires_at)
     values ($1, $2, now() + ($3::bigint * interval '1 millisecond'))`,
    [hashToken(token), account.id, LOGIN_TTL_MS],
  );

  const link = `${env.appLinkBase}?token=${token}`;
  try {
    await send({ to: email, ...signInMail(link, Math.round(LOGIN_TTL_MS / 60000)) });
  } catch (error) {
    console.error('[auth] mail failed', error);
    return c.json({ error: 'Could not send the link. Try again.' }, 502);
  }

  // The link only ever comes back over HTTP on a box that has said it may.
  return c.json({ sent: true, ...(env.devLogin ? { link } : {}) });
});

auth.post('/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { token?: unknown; device?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token) return c.json({ error: 'That link is not a sign-in link' }, 400);

  // SPENT ONCE: the update is what claims it, so two taps on the same link in
  // a mail client that prefetches cannot both succeed.
  const claimed = await one<{ account_id: string }>(
    `update login_tokens set used_at = now()
      where hash = $1 and used_at is null and expires_at > now()
      returning account_id`,
    [hashToken(token)],
  );
  if (!claimed) return c.json({ error: 'That link has expired or has already been used' }, 401);

  const device = typeof body?.device === 'string' ? body.device.slice(0, 64) : null;
  const session = mintToken();
  await query(
    `insert into sessions (hash, account_id, device, expires_at)
     values ($1, $2, $3, now() + ($4::bigint * interval '1 millisecond'))`,
    [hashToken(session), claimed.account_id, device, SESSION_TTL_MS],
  );

  const me = await accountFor(session);
  return c.json({
    token: session,
    account: me
      ? {
          id: me.id,
          email: me.email,
          cursor: Number(me.rev),
          entitled: stillEntitled(me.entitled_until, me.entitled),
          trialUsed: !!me.trial_used_at,
        }
      : null,
  });
});

auth.post('/signout', signedIn, async (c) => {
  const token = c.req.header('authorization')?.split(' ')[1] ?? '';
  if (token) await query('delete from sessions where hash = $1', [hashToken(token)]);
  return c.json({ signedOut: true });
});
