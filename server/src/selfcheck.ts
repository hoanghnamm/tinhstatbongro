/**
 * THE WHOLE TEST SUITE, and it is one script with asserts in it.
 *
 * The app's `lib/selfcheck.ts` is the precedent and the argument is the same:
 * every rule that matters is a plain function over plain data, so exercising
 * them needs no framework, no database and no network — it needs node. Run it
 * with `npm run check`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { entitlementFrom, readEvent, REVOKING, stillEntitled } from './lib/entitlement.js';
import { GAME_PREFIX, MAX_PUSH_ROWS, NEVER_TRAVELS, SYNC_KEYS, travels } from './lib/keys.js';
import { Window } from './lib/rate.js';
import { changesIn, isCurrent, summarise, type StoredRow } from './lib/sync.js';
import { bearer, hashToken, mintToken, sameSecret } from './lib/tokens.js';
import { readEmail, readPush } from './lib/wire.js';

const here = dirname(fileURLToPath(import.meta.url));
let checks = 0;
const check = (what: string, run: () => void) => {
  run();
  checks++;
  void what;
};

/* ---------------------------------------------------------------- keys -- */

check('the sync list and the backup list are the same list', () => {
  // READ OUT OF THE SOURCE, not imported — the app is a separate package with
  // its own dependencies, and the point is to catch the two drifting apart.
  const app = readFileSync(join(here, '../../livestats/lib/backup.ts'), 'utf8');
  const block = app.match(/export const BACKUP_KEYS = \[([\s\S]*?)\];/);
  assert.ok(block, 'BACKUP_KEYS not found in livestats/lib/backup.ts');
  // the block carries a comment with an apostrophe in it, so the comments go
  // before the strings are read out
  const bare = block[1]!.replace(/\/\/.*$/gm, '');
  const theirs = [...bare.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert.deepEqual([...SYNC_KEYS].sort(), theirs.sort());
});

check('what travels, and what never does', () => {
  assert.ok(travels('hooplog-team'));
  assert.ok(travels('hooplog-roster'));
  assert.ok(travels('hooplog-squads'));
  assert.ok(travels('hooplog-history'));
  assert.ok(travels(`${GAME_PREFIX}abc123`));
  for (const key of NEVER_TRAVELS) assert.equal(travels(key), false, key);
  // the entitlement most of all: a client that could push one could grant itself one
  assert.equal(travels('hooplog-billing'), false);
  assert.equal(travels('hooplog-game'), false, 'the prefix without an id is not a row');
});

/* ---------------------------------------------------------------- wire -- */

const push = (rows: unknown[], since = 0) => readPush({ since, rows });

check('a push is refused whole', () => {
  assert.ok('refusal' in readPush(null));
  assert.ok('refusal' in readPush({ rows: [] }), 'no cursor');
  assert.ok('refusal' in readPush({ since: -1, rows: [] }));
  assert.ok('refusal' in readPush({ since: 1.5, rows: [] }));
  assert.ok('refusal' in push([{ key: 'hooplog-billing', value: '{}' }]), 'a key that does not sync');
  assert.ok('refusal' in push([{ key: 'hooplog-team' }]), 'a row with no value');
  assert.ok('refusal' in push([{ key: 'hooplog-team', value: 3 }]), 'a value that is not a string');
  assert.ok(
    'refusal' in
      push([
        { key: 'hooplog-team', value: 'a' },
        { key: 'hooplog-team', value: 'b' },
      ]),
    'one key named twice has no defined order',
  );
  assert.ok(
    'refusal' in
      push(
        Array.from({ length: MAX_PUSH_ROWS + 1 }, (_, i) => ({
          key: `${GAME_PREFIX}${i}`,
          value: 'x',
        })),
      ),
  );
});

check('a deletion carries no value and needs none', () => {
  const read = push([{ key: `${GAME_PREFIX}g1`, deleted: true }]);
  assert.ok('push' in read);
  assert.equal(read.push.rows[0]!.value, null);
  assert.equal(read.push.rows[0]!.deleted, true);
});

check('an email is an email', () => {
  assert.deepEqual(readEmail({ email: '  Scorer@Club.VN ' }), { email: 'scorer@club.vn' });
  for (const bad of ['', 'nope', 'a@b', '@b.com', 'a@', 'a b@c.com', 'a@@b.com'])
    assert.ok('refusal' in readEmail({ email: bad }), bad);
});

/* ---------------------------------------------------------------- sync -- */

check('a stale push is not current', () => {
  assert.equal(isCurrent(7, 7), true);
  assert.equal(isCurrent(6, 7), false, 'the account moved on');
  assert.equal(isCurrent(0, 0), true, 'a new account');
});

check('a push that changes nothing consumes no rev', () => {
  const held = new Map<string, StoredRow>([
    ['hooplog-team', { key: 'hooplog-team', value: '{"name":"Lions"}', deleted: false, rev: 4 }],
  ]);
  assert.equal(
    changesIn([{ key: 'hooplog-team', value: '{"name":"Lions"}', deleted: false }], held).length,
    0,
  );
  assert.equal(
    changesIn([{ key: 'hooplog-team', value: '{"name":"Tigers"}', deleted: false }], held).length,
    1,
  );
  assert.equal(changesIn([{ key: `${GAME_PREFIX}new`, value: 'x', deleted: false }], held).length, 1);
});

check('deleting what was never here is not a change', () => {
  assert.equal(
    changesIn([{ key: `${GAME_PREFIX}gone`, value: null, deleted: true }], new Map()).length,
    0,
  );
  const held = new Map<string, StoredRow>([
    [`${GAME_PREFIX}g1`, { key: `${GAME_PREFIX}g1`, value: 'x', deleted: false, rev: 2 }],
  ]);
  assert.equal(changesIn([{ key: `${GAME_PREFIX}g1`, value: null, deleted: true }], held).length, 1);
  const tomb = new Map<string, StoredRow>([
    [`${GAME_PREFIX}g1`, { key: `${GAME_PREFIX}g1`, value: null, deleted: true, rev: 3 }],
  ]);
  assert.equal(changesIn([{ key: `${GAME_PREFIX}g1`, value: null, deleted: true }], tomb).length, 0);
});

check('a tombstone is not a game', () => {
  const rows: StoredRow[] = [
    { key: 'hooplog-team', value: '{}', deleted: false, rev: 1 },
    { key: `${GAME_PREFIX}a`, value: 'x', deleted: false, rev: 2 },
    { key: `${GAME_PREFIX}b`, value: null, deleted: true, rev: 3 },
  ];
  assert.deepEqual(summarise(rows), { games: 1, keys: 2 });
});

/* -------------------------------------------------------------- tokens -- */

check('a token is not guessable and is stored as a hash', () => {
  const a = mintToken();
  const b = mintToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 43, 'at least 256 bits of base64url');
  assert.match(a, /^[A-Za-z0-9_-]+$/, 'urlsafe, so it survives being a query param');
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), a, 'the token itself is never what is stored');
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
});

check('a secret compare does not throw on a length mismatch', () => {
  assert.equal(sameSecret('abc', 'abc'), true);
  assert.equal(sameSecret('abc', 'abcd'), false);
  assert.equal(sameSecret('', ''), true);
});

check('a bearer header is read, and anything else is not', () => {
  assert.equal(bearer('Bearer abc'), 'abc');
  assert.equal(bearer('bearer abc'), 'abc');
  assert.equal(bearer('Basic abc'), null);
  assert.equal(bearer('abc'), null);
  assert.equal(bearer(undefined), null);
  assert.equal(bearer('Bearer '), null);
});

/* --------------------------------------------------------- entitlement -- */

const rc = (event: Record<string, unknown>) => readEvent({ api_version: '1.0', event });

check('an event is read or refused', () => {
  assert.ok('refusal' in readEvent(null));
  assert.ok('refusal' in readEvent({}));
  assert.ok('refusal' in rc({ type: 'RENEWAL' }), 'no id');
  assert.ok('refusal' in rc({ id: 'e1' }), 'no type');
  const read = rc({
    id: 'e1',
    type: 'RENEWAL',
    app_user_id: 'u1',
    entitlement_ids: ['pro'],
    expiration_at_ms: 10,
  });
  assert.ok('event' in read);
  assert.equal(read.event.appUserId, 'u1');
  assert.deepEqual(read.event.entitlementIds, ['pro']);
});

check('a transfer names both sides and takes the id from the receiving one', () => {
  const read = rc({ id: 'e2', type: 'TRANSFER', transferred_from: ['a'], transferred_to: ['b'] });
  assert.ok('event' in read);
  assert.equal(read.event.appUserId, 'b');
  assert.deepEqual(read.event.transferredFrom, ['a']);
});

check('an event for another entitlement is not ours', () => {
  const read = rc({ id: 'e3', type: 'RENEWAL', app_user_id: 'u1', entitlement_ids: ['coach'] });
  assert.ok('event' in read);
  assert.equal(entitlementFrom(read.event, 'pro'), null);
});

check('the revoking events revoke, and cancellation is not one of them', () => {
  assert.ok(REVOKING.has('EXPIRATION'));
  assert.ok(REVOKING.has('REFUND'));
  assert.equal(REVOKING.has('CANCELLATION'), false, 'a cancelled term is still a paid term');
  for (const type of REVOKING) {
    const read = rc({ id: `r-${type}`, type, app_user_id: 'u1', entitlement_ids: ['pro'] });
    assert.ok('event' in read);
    assert.deepEqual(entitlementFrom(read.event, 'pro'), { until: null, entitled: false }, type);
  }
});

check('an unknown event grants rather than revokes', () => {
  const soon = Date.now() + 86_400_000;
  const read = rc({
    id: 'e4',
    type: 'SOMETHING_NEW',
    app_user_id: 'u1',
    entitlement_ids: ['pro'],
    expiration_at_ms: soon,
  });
  assert.ok('event' in read);
  assert.equal(entitlementFrom(read.event, 'pro')?.entitled, true);
});

check('an expiry already passed is not access, and no expiry is', () => {
  const past = rc({
    id: 'e5',
    type: 'RENEWAL',
    app_user_id: 'u1',
    entitlement_ids: ['pro'],
    expiration_at_ms: 1000,
  });
  assert.ok('event' in past);
  assert.equal(entitlementFrom(past.event, 'pro')?.entitled, false);

  const lifetime = rc({
    id: 'e6',
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: 'u1',
    entitlement_ids: ['pro'],
  });
  assert.ok('event' in lifetime);
  const out = entitlementFrom(lifetime.event, 'pro');
  assert.equal(out?.until, null);
  assert.equal(out?.entitled, true);
});

check('a stored entitlement runs out on its own', () => {
  const now = 1_000_000;
  assert.equal(stillEntitled(null, true, now), true);
  assert.equal(stillEntitled(new Date(now + 1), true, now), true);
  assert.equal(stillEntitled(new Date(now - 1), true, now), false);
  assert.equal(stillEntitled(null, false, now), false);
});

/* ---------------------------------------------------------------- rate -- */

check('the window lets the burst through and then stops', () => {
  const w = new Window({ burst: 3, windowMs: 1000 });
  assert.deepEqual(
    [w.take('a', 0), w.take('a', 1), w.take('a', 2), w.take('a', 3)],
    [true, true, true, false],
  );
  assert.equal(w.take('b', 3), true, 'another caller is unaffected');
  assert.equal(w.take('a', 1002), true, 'the window has moved on');
  w.sweep(10_000);
  assert.equal(w.size, 0, 'nothing accumulates');
});

console.log(`selfcheck: ${checks} checks passed`);
