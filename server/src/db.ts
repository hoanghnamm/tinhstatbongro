/**
 * THE ONE DOOR TO POSTGRES, and the migrations that shape what is behind it.
 *
 * `platform/storage.ts` is the precedent: one module owns the connection, every
 * caller goes through it, and nothing else in the tree imports the driver.
 *
 * Migrations run at boot in one locked transaction, recorded in a table so a
 * second instance starting at the same moment does not run them twice. They are
 * plain `.sql` files applied in name order — no migration framework, for the
 * same reason there is no test framework in the app: the whole mechanism is
 * forty lines and can be read in one sitting.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { env } from './env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // Railway's Postgres presents a certificate its own proxy signs.
  ssl: env.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  idle_in_transaction_session_timeout: 15_000,
  idleTimeoutMillis: 30_000,
});

// pg removes the failed idle connection; handling the event keeps the process
// alive so the next request can establish a new connection.
pool.on('error', (error) => {
  console.error('[db] idle connection failed', error.message);
});

export type Row = Record<string, unknown>;

/**
 * The generic is UNCONSTRAINED on purpose. `pg`'s own `QueryResultRow` demands
 * an index signature, which every hand-written result interface in this tree
 * would then have to carry — a shape declared to satisfy the driver rather than
 * to describe the query. The cast is here, once, instead.
 */
export async function query<T = Row>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows as T[];
}

/** One row or null — the shape most reads here actually want. */
export async function one<T = Row>(text: string, values: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

/**
 * A TRANSACTION, and every write that touches more than one row is inside one.
 * A push that applied four rows out of six is the half-restore `applyBackup`
 * exists to prevent, and here it is prevented by the database rather than by
 * ordering.
 */
export async function tx<T>(run: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await run(client);
    await client.query('commit');
    return out;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(): Promise<string[]> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  if (!files.length) throw new Error('No SQL migrations found in the server build');

  return tx(async (client) => {
    // Lock BEFORE creating even the tracking table. Every startup uses the same
    // transaction lock, released automatically on commit or rollback.
    await client.query('select pg_advisory_xact_lock(724019, 1)');
    await client.query(`
      create table if not exists migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const done = new Set((await client.query<{ name: string }>('select name from migrations')).rows.map((r) => r.name));

    const ran: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      await client.query(sql);
      await client.query('insert into migrations (name) values ($1)', [file]);
      ran.push(file);
    }
    return ran;
  });
}
