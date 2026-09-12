/** Failure-path checks with a fake database client: no database or network. */
import assert from 'node:assert/strict';
import type pg from 'pg';

process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
const { pool, tx, migrate } = await import('./db.js');
const calls: string[] = [];
let released = 0;
let failSql = false;
let applied = false;
const client = {
  async query(sql: string) {
    calls.push(sql);
    if (failSql && sql.includes('create extension')) throw new Error('migration failure');
    return { rows: sql === 'select name from migrations' && applied ? [{ name: '001_init.sql' }, { name: '002_email_codes.sql' }] : [] };
  },
  release() { released++; },
} as unknown as pg.PoolClient;
pool.connect = (async () => client) as typeof pool.connect;

assert.equal(await tx(async () => 42), 42);
assert.deepEqual(calls.splice(0), ['begin', 'commit']);
await assert.rejects(tx(async () => { throw new Error('write failed'); }), /write failed/);
assert.deepEqual(calls.splice(0), ['begin', 'rollback']);
assert.equal(released, 2);

assert.deepEqual(await migrate(), ['001_init.sql', '002_email_codes.sql']);
assert.equal(calls[0], 'begin');
assert.equal(calls[1], 'select pg_advisory_xact_lock(724019, 1)');
assert.ok(calls.findIndex((sql) => sql.includes('create table if not exists migrations')) > 1);
assert.equal(calls.at(-1), 'commit');
calls.length = 0;
applied = true;
assert.deepEqual(await migrate(), []);
assert.equal(calls.some((sql) => sql.includes('create extension')), false);
calls.length = 0;
applied = false;
failSql = true;
await assert.rejects(migrate(), /migration failure/);
assert.equal(calls.at(-1), 'rollback');
assert.equal(calls.some((sql) => sql.startsWith('insert into migrations')), false);
assert.equal(released, 5);

const originalError = console.error;
const errors: unknown[][] = [];
try {
  console.error = (...args) => { errors.push(args); };
  assert.doesNotThrow(() => pool.emit('error', new Error('connection lost')));
  assert.equal(errors.length, 1);
} finally {
  console.error = originalError;
  await pool.end();
}
console.log('runtimecheck: transactions, migration locking/order/rollback, and idle errors passed');
