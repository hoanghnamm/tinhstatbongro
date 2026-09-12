import { randomInt } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { one, query, tx } from '../db.js';
import { Window } from '../lib/rate.js';
import { hashToken, mintToken, sameSecret, LOGIN_TTL_MS, SESSION_TTL_MS } from '../lib/tokens.js';
import { readEmail } from '../lib/wire.js';
import { send } from '../mail.js';
import { env } from '../env.js';
import { signedIn, type Signed } from '../session.js';

export const codes = new Hono<Signed>();
codes.use('*', bodyLimit({ maxSize: 16_384, onError: c => c.json({ error: 'Request too large' }, 413) }));
const emails = new Window({ burst: 3, windowMs: LOGIN_TTL_MS });
const addresses = new Window({ burst: 20, windowMs: LOGIN_TTL_MS });
setInterval(() => { emails.sweep(); addresses.sweep(); }, LOGIN_TTL_MS).unref();

codes.post('/code/request', async c => {
  const read = readEmail(await c.req.json().catch(() => null));
  if ('refusal' in read) return c.json({ error: read.refusal }, 400);
  if (!env.resendKey) return c.json({ error: 'Email sign-in is not configured yet.' }, 503);
  const address = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!addresses.take(address) || !emails.take(read.email))
    return c.json({ error: 'Too many codes. Try again in 15 minutes.' }, 429);
  const account = await one<{ id: string }>(
    'insert into accounts (email) values ($1) on conflict (email) do update set email = excluded.email returning id',
    [read.email],
  );
  if (!account) throw new Error('Account creation failed');
  const challenge = mintToken();
  const code = randomInt(0, 100_000_000).toString().padStart(8, '0');
  await query('delete from email_codes where expires_at < now()');
  await query(
    `insert into email_codes (hash, account_id, code_hash, expires_at)
     values ($1, $2, $3, now() + ($4::bigint * interval '1 millisecond'))`,
    [hashToken(challenge), account.id, hashToken(`${challenge}:${code}`), LOGIN_TTL_MS],
  );
  try {
    await send({ to: read.email, subject: 'Your HoopRec sign-in code',
      text: `Your sign-in code is ${code}.\n\nEnter it in HoopRec within 15 minutes.\nIf you did not request this code, ignore this email.` });
  } catch {
    await query('delete from email_codes where hash = $1', [hashToken(challenge)]);
    return c.json({ error: 'Could not send the code. Please try again.' }, 502);
  }
  return c.json({ challenge });
});

codes.post('/code/verify', async c => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.challenge !== 'string' || body.challenge.length > 100 ||
      typeof body?.code !== 'string' || !/^\d{8}$/.test(body.code))
    return c.json({ error: 'Enter the eight-digit code from your email.' }, 400);
  const session = mintToken();
  const accountId = await tx(async client => {
    // Atomic attempt increment serializes guesses and limits each code to five tries.
    const attempt = await client.query<{ account_id: string; code_hash: string }>(
      `update email_codes set attempts = attempts + 1
       where hash = $1 and used_at is null and expires_at > now() and attempts < 5
       returning account_id, code_hash`, [hashToken(body.challenge)]);
    const row = attempt.rows[0];
    if (!row || !sameSecret(row.code_hash, hashToken(`${body.challenge}:${body.code}`))) return null;
    await client.query('update email_codes set used_at = now() where hash = $1', [hashToken(body.challenge)]);
    await client.query(
      `insert into sessions (hash, account_id, device, expires_at)
       values ($1, $2, $3, now() + ($4::bigint * interval '1 millisecond'))`,
      [hashToken(session), row.account_id, 'HoopRec', SESSION_TTL_MS]);
    return row.account_id;
  });
  if (!accountId) return c.json({ error: 'Code incorrect or expired. Request a new code after five attempts.' }, 401);
  return c.json({ token: session, accountId });
});

codes.delete('/account', signedIn, async c => {
  const body = await c.req.json().catch(() => null);
  if (body?.confirmation !== 'DELETE') return c.json({ error: 'Confirm account deletion.' }, 400);
  // Delete retained webhook payloads too; the other account records cascade.
  await tx(async client => {
    await client.query('delete from billing_events where account_id = $1', [c.get('accountId')]);
    await client.query('delete from accounts where id = $1', [c.get('accountId')]);
  });
  return c.json({ deleted: true });
});
