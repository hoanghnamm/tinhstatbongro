/**
 * THE SERVER, and it is routes and nothing else.
 *
 * Every rule lives in `src/lib/` on the far side of the line `lib/actions.ts`
 * draws in the app: plain functions over plain data, exercised by
 * `npm run check` with no database, no network and no Hono. What is left here
 * is wiring, and it should stay that way.
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { migrate, pool } from './db.js';
import { env } from './env.js';
import { auth } from './routes/auth.js';
import { codes } from './routes/codes.js';
import { billing } from './routes/billing.js';
import { sync } from './routes/sync.js';
import type { Signed } from './session.js';

const app = new Hono<Signed>();

/**
 * CORS IS FOR THE WEB BUILD ALONE. The phone is not a browser and sends no
 * origin; a browser that is not on the list is refused rather than allowed with
 * a warning, because `ALLOWED_ORIGINS` empty means "there is no web build yet".
 */
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin && env.origins.includes(origin)) {
    c.header('access-control-allow-origin', origin);
    c.header('vary', 'origin');
    c.header('access-control-allow-headers', 'authorization,content-type');
    c.header('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
    c.header('access-control-max-age', '86400');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  return next();
});

app.onError((error, c) => {
  // What went wrong goes to the log with its stack; what the caller is told is
  // a sentence. The same split `lib/fault.ts` makes between the fault and the
  // note printed for it.
  console.error('[error]', c.req.method, c.req.path, error);
  return c.json({ error: 'Something went wrong here. Try again.' }, 500);
});

app.get('/health', async (c) => {
  try {
    await pool.query('select 1');
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

app.route('/auth', codes);
app.route('/auth', auth);
app.route('/sync', sync);
app.route('/billing', billing);

let server: ReturnType<typeof serve> | undefined;
let stopping = false;

const started = async () => {
  const ran = await migrate();
  if (stopping) return;
  if (ran.length) console.log(`[db] applied ${ran.join(', ')}`);
  server = serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, ({ port }) =>
    console.log(`[hooprec] listening on ${port}`),
  );
  server.on('error', (error) => {
    console.error('[http] failed', error.message);
    void stop(1);
  });
};

started().catch((error) => {
  console.error('[boot] failed', error);
  void stop(1);
});

// Railway stops a container with SIGTERM; finishing the in-flight push is the
// difference between a scorer retrying and a scorer seeing an error.
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 20_000);
  deadline.unref();
  // Stop accepting requests, let active responses finish, then close Postgres.
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await pool.end().catch(() => {});
  clearTimeout(deadline);
  process.exit(code);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
