/** Exercise the real Hono email-code endpoints; fake only Postgres and email transport. */
import assert from 'node:assert/strict';
import type pg from 'pg';
process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
process.env.RESEND_API_KEY = 'test-only';
const { pool } = await import('./db.js');
const { codes } = await import('./routes/codes.js');
interface CodeRow { account_id: string; code_hash: string; attempts: number; used: boolean }
let records = new Map<string, CodeRow>();
let transactionSnapshot: Map<string, CodeRow> | undefined;
let sessions = 0;
let failSession = false;
let emailText = '';
const accountId = '22222222-2222-4222-8222-222222222222';
const fakeQuery = async (sql: string, values: unknown[] = []) => {
  if (sql === 'begin') transactionSnapshot = new Map([...records].map(([k, v]) => [k, { ...v }]));
  if (sql === 'rollback' && transactionSnapshot) records = transactionSnapshot;
  if (sql.startsWith('insert into accounts')) return { rows: [{ id: accountId }] };
  if (sql.includes('insert into email_codes')) records.set(String(values[0]), { account_id: accountId, code_hash: String(values[2]), attempts: 0, used: false });
  if (sql.includes('set attempts = attempts + 1')) {
    const row = records.get(String(values[0]));
    if (!row || row.used || row.attempts >= 5) return { rows: [] };
    row.attempts++;
    return { rows: [row] };
  }
  if (sql.includes('update email_codes set used_at')) records.get(String(values[0]))!.used = true;
  if (sql.includes('insert into sessions')) {
    if (failSession) throw new Error('simulated database failure');
    sessions++;
  }
  return { rows: [] };
};
pool.query = fakeQuery as typeof pool.query;
pool.connect = (async () => ({ query: fakeQuery, release() {} }) as unknown as pg.PoolClient) as typeof pool.connect;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_url, init) => {
  emailText = JSON.parse(String(init?.body)).text;
  return new Response('{}', { status: 200 });
}) as typeof fetch;
codes.onError(() => new Response('failed', { status: 500 }));
const post = (path: string, body: unknown) => codes.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
try {
  assert.equal((await post('/code/request', { email: 'bad' })).status, 400);
  const request = await post('/code/request', { email: 'test@example.com' });
  assert.equal(request.status, 200);
  const { challenge, ...extra } = await request.json() as { challenge: string };
  assert.deepEqual(extra, {}, 'the response must not disclose the code');
  const code = emailText.match(/\b\d{8}\b/)?.[0];
  assert.ok(code);
  assert.equal((await post('/code/verify', { challenge, code: 'not-code' })).status, 400);
  failSession = true;
  assert.equal((await post('/code/verify', { challenge, code })).status, 500);
  failSession = false;
  const verified = await post('/code/verify', { challenge, code });
  assert.equal(verified.status, 200, 'failed session creation must roll back code consumption');
  const result = await verified.json() as { token: string; accountId: string };
  assert.equal(result.accountId, accountId);
  assert.ok(result.token.length >= 43);
  assert.equal((await post('/code/verify', { challenge, code })).status, 401, 'codes are single use');
  assert.equal(sessions, 1);
  const next = await (await post('/code/request', { email: 'other@example.com' })).json() as { challenge: string };
  const actual = emailText.match(/\b\d{8}\b/)![0];
  const wrong = actual === '00000000' ? '11111111' : '00000000';
  for (let i = 0; i < 5; i++) assert.equal((await post('/code/verify', { challenge: next.challenge, code: wrong })).status, 401);
  assert.equal((await post('/code/verify', { challenge: next.challenge, code: actual })).status, 401, 'five guesses exhaust the challenge');
  assert.equal((await codes.request('/account', { method: 'DELETE', body: JSON.stringify({ confirmation: 'DELETE' }) })).status, 401);
  console.log('codecheck: email delivery, token privacy, verification, rollback, single-use, attempt limit and deletion auth passed');
} finally {
  globalThis.fetch = originalFetch;
  await pool.end();
}
