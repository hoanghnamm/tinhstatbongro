/**
 * WHAT THE STORE SAYS, ARRIVING AND BEING ASKED.
 *
 * Two endpoints facing opposite ways: RevenueCat posts here, and the app reads
 * `/me`. Between them the entitlement stops being a fact about a device.
 */
import { Hono } from 'hono';

import { one, query } from '../db.js';
import { env } from '../env.js';
import { entitlementFrom, readEvent, stillEntitled, TRANSFER } from '../lib/entitlement.js';
import { sameSecret } from '../lib/tokens.js';
import { accountFor, signedIn, type Signed } from '../session.js';

export const billing = new Hono<Signed>();

/**
 * THE WEBHOOK, AND IT ANSWERS 200 TO ALMOST EVERYTHING.
 *
 * RevenueCat retries on anything that is not a 2xx, so a non-2xx must mean
 * "send this again" and nothing else. An event we understand and choose to
 * ignore — another entitlement, a sandbox event on a production box — is a 200,
 * because asking to be sent it again would not change the answer. Only a
 * genuine failure on our side (the database is down) is a 500.
 *
 * IDEMPOTENT BY EVENT ID: retries are expected and a replayed event must not
 * move anything twice.
 */
billing.post('/revenuecat', async (c) => {
  if (env.revenueCatWebhookSecret) {
    const sent = c.req.header('authorization') ?? '';
    if (!sameSecret(sent, env.revenueCatWebhookSecret)) return c.json({ error: 'no' }, 401);
  } else {
    // Refusing is the only safe answer: an unauthenticated webhook endpoint is
    // a form for granting yourself a subscription.
    console.error('[billing] REVENUECAT_WEBHOOK_SECRET is not set — refusing');
    return c.json({ error: 'not configured' }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const read = readEvent(body);
  if ('refusal' in read) {
    console.warn('[billing] unreadable event:', read.refusal);
    return c.json({ ok: true, ignored: read.refusal });
  }
  const { event } = read;

  if (event.environment === 'SANDBOX' && !env.acceptSandbox)
    return c.json({ ok: true, ignored: 'sandbox' });

  // The join. `app_user_id` is the account id the client set with
  // `Purchases.logIn` — an anonymous id (RevenueCat writes those as
  // `$RCAnonymousID:…`) belongs to nobody and cannot be attached afterwards.
  const accountId = /^[0-9a-f-]{36}$/i.test(event.appUserId) ? event.appUserId : null;
  const account = accountId
    ? await one<{ id: string }>('select id from accounts where id = $1', [accountId])
    : null;

  const stored = await one<{ id: string }>(
    `insert into billing_events (id, account_id, type, app_user_id, environment, body)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do nothing
     returning id`,
    [event.id, account?.id ?? null, event.type, event.appUserId, event.environment, body],
  );
  if (!stored) return c.json({ ok: true, ignored: 'already seen' });

  if (!account) {
    console.warn(`[billing] ${event.type} for unknown app_user_id ${event.appUserId}`);
    return c.json({ ok: true, ignored: 'unknown account' });
  }

  // A TRANSFER takes the entitlement OFF the accounts it came from before it
  // lands on the one it went to, or two accounts both read as paid.
  if (event.type === TRANSFER && event.transferredFrom.length) {
    await query(
      `update accounts set entitled = false, entitled_until = null, entitlement_updated_at = now()
        where id = any($1::uuid[])`,
      [event.transferredFrom.filter((id) => /^[0-9a-f-]{36}$/i.test(id))],
    );
  }

  const next = entitlementFrom(event, env.entitlementId);
  if (!next) return c.json({ ok: true, ignored: 'another entitlement' });

  await query(
    `update accounts
        set entitled = $2, entitled_until = $3, entitlement_updated_at = now()
      where id = $1`,
    [account.id, next.entitled, next.until],
  );
  return c.json({ ok: true, applied: event.type });
});

/**
 * WHO THE APP IS TALKING TO, and everything the gates need in one read.
 *
 * `entitled` is computed rather than read, because a subscription that ran out
 * while nobody was looking gets no webhook until the store notices.
 */
billing.get('/me', signedIn, async (c) => {
  const token = c.req.header('authorization')?.split(' ')[1] ?? '';
  const me = await accountFor(token);
  if (!me) return c.json({ error: 'That session has expired' }, 401);
  return c.json({
    id: me.id,
    email: me.email,
    cursor: Number(me.rev),
    entitled: stillEntitled(me.entitled_until, me.entitled),
    entitledUntil: me.entitled_until,
    trialUsed: !!me.trial_used_at,
    /** the id to hand `Purchases.logIn` — stated so the client cannot guess */
    revenueCatUserId: me.id,
  });
});

/**
 * THE TRIAL IS SPENT, and it is spent HERE as well as on the device.
 *
 * `EndGamePanel` spends it locally beside `saveGame` and that stays — the app
 * must work with no network. This is the copy that survives a reinstall. It is
 * one-way and a second call changes nothing.
 */
billing.post('/trial', signedIn, async (c) => {
  const accountId = c.get('accountId');
  await query('update accounts set trial_used_at = coalesce(trial_used_at, now()) where id = $1', [
    accountId,
  ]);
  return c.json({ trialUsed: true });
});
