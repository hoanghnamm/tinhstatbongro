/**
 * PULL AND PUSH, and between them they are the whole of sync.
 *
 * Both are plain JSON over one connection. There is no long poll, no socket and
 * no push notification: a scorer's device syncs when the app opens, when a game
 * is saved, and when they ask — three moments, all of them ones where a person
 * is already looking at the screen. A live channel would be the right answer for
 * a shared scoreboard and is the wrong one for a backup.
 */
import { Hono } from 'hono';

import { one, query, tx } from '../db.js';
import { changesIn, isCurrent, summarise, type StoredRow } from '../lib/sync.js';
import { readPush } from '../lib/wire.js';
import { signedIn, type Signed } from '../session.js';

export const sync = new Hono<Signed>();
sync.use('*', signedIn);

interface DbRow {
  key: string;
  value: string | null;
  deleted: boolean;
  rev: string;
}

const asStored = (r: DbRow): StoredRow => ({
  key: r.key,
  value: r.value,
  deleted: r.deleted,
  rev: Number(r.rev),
});

async function revOf(accountId: string): Promise<number> {
  const row = await one<{ rev: string }>('select rev from accounts where id = $1', [accountId]);
  return Number(row?.rev ?? 0);
}

/** Everything stamped above the cursor. `since=0` is a whole account. */
sync.get('/', async (c) => {
  const accountId = c.get('accountId');
  const since = Number(c.req.query('since') ?? 0);
  if (!Number.isInteger(since) || since < 0) return c.json({ error: 'That cursor is not a number' }, 400);

  const rows = await query<DbRow>(
    'select key, value, deleted, rev from rows where account_id = $1 and rev > $2 order by rev, key',
    [accountId, since],
  );
  return c.json({ cursor: await revOf(accountId), rows: rows.map(asStored) });
});

/**
 * A PUSH IS ALL OF IT OR NONE OF IT, and a stale one is refused.
 *
 * `409` carries the cursor and every row that moved, so the answer to a
 * rejection is one round trip and not a second request: reconcile against what
 * came back, push again.
 */
sync.post('/', async (c) => {
  const accountId = c.get('accountId');
  const read = readPush(await c.req.json().catch(() => null));
  if ('refusal' in read) return c.json({ error: read.refusal }, 400);
  const { push } = read;

  const result = await tx(async (client) => {
    // The account row is locked for the length of the push, which is what makes
    // "read the rev, decide, stamp the rows" one decision rather than three.
    const locked = await client.query<{ rev: string }>(
      'select rev from accounts where id = $1 for update',
      [accountId],
    );
    const rev = Number(locked.rows[0]?.rev ?? 0);

    if (!isCurrent(push.since, rev)) {
      const moved = await client.query<DbRow>(
        'select key, value, deleted, rev from rows where account_id = $1 and rev > $2 order by rev, key',
        [accountId, push.since],
      );
      return { stale: true as const, cursor: rev, rows: moved.rows.map(asStored) };
    }

    const held = new Map<string, StoredRow>();
    if (push.rows.length) {
      const existing = await client.query<DbRow>(
        'select key, value, deleted, rev from rows where account_id = $1 and key = any($2::text[])',
        [accountId, push.rows.map((r) => r.key)],
      );
      for (const row of existing.rows) held.set(row.key, asStored(row));
    }

    const changes = changesIn(push.rows, held);
    if (!changes.length) return { stale: false as const, cursor: rev, applied: 0 };

    const next = rev + 1;
    for (const row of changes) {
      await client.query(
        `insert into rows (account_id, key, value, deleted, rev, updated_at, device)
         values ($1, $2, $3, $4, $5, now(), $6)
         on conflict (account_id, key) do update
           set value = excluded.value,
               deleted = excluded.deleted,
               rev = excluded.rev,
               updated_at = excluded.updated_at,
               device = excluded.device`,
        [accountId, row.key, row.value, row.deleted, next, push.device ?? null],
      );
    }
    await client.query('update accounts set rev = $2 where id = $1', [accountId, next]);
    return { stale: false as const, cursor: next, applied: changes.length };
  });

  if (result.stale) return c.json({ error: 'This device is behind', ...result }, 409);
  return c.json(result);
});

/** What is up there, in the two figures a scorer would recognise. */
sync.get('/summary', async (c) => {
  const accountId = c.get('accountId');
  const rows = await query<DbRow>('select key, value, deleted, rev from rows where account_id = $1', [
    accountId,
  ]);
  const last = await one<{ at: Date | null }>(
    'select max(updated_at) as at from rows where account_id = $1',
    [accountId],
  );
  return c.json({
    cursor: await revOf(accountId),
    ...summarise(rows.map(asStored)),
    lastPushAt: last?.at ?? null,
  });
});
