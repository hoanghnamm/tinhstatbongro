/**
 * READING WHAT ARRIVED, and refusing it whole rather than half.
 *
 * The same argument `readBackup` makes in the app: everything is checked before
 * anything is used, because a half-applied push is the one outcome worse than a
 * refused one. Hand-rolled rather than schema'd — there are three shapes on the
 * whole wire and a validation library is a dependency that has to be kept up to
 * date for as long as the server runs.
 */
import { MAX_PUSH_ROWS, MAX_ROW_BYTES, travels } from './keys.js';

/** One row as a client states it. `deleted` rows carry no value. */
export interface WireRow {
  key: string;
  /** the exact string the app has on its own disk, or null for a deletion */
  value: string | null;
  deleted: boolean;
}

export interface PushBody {
  /** the cursor this client has reconciled to */
  since: number;
  rows: WireRow[];
  /** which device says so, for the sessions list — never trusted for anything */
  device?: string;
}

/** A refusal is a sentence, not a code. The client prints it as it stands. */
export type Refusal = string;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function readPush(body: unknown): { push: PushBody } | { refusal: Refusal } {
  if (!isObj(body)) return { refusal: 'That request is not an object' };

  const since = body.since;
  if (typeof since !== 'number' || !Number.isInteger(since) || since < 0)
    return { refusal: 'That request carries no cursor' };

  if (!Array.isArray(body.rows)) return { refusal: 'That request carries no rows' };
  if (body.rows.length > MAX_PUSH_ROWS)
    return { refusal: `A push carries at most ${MAX_PUSH_ROWS} rows` };

  const rows: WireRow[] = [];
  const seen = new Set<string>();
  for (const raw of body.rows) {
    if (!isObj(raw)) return { refusal: 'A row is not an object' };
    const key = raw.key;
    if (typeof key !== 'string' || !key) return { refusal: 'A row has no key' };
    if (!travels(key)) return { refusal: `That key does not sync: ${key}` };
    // A push naming one key twice has no defined order, so it is a refusal
    // rather than a last-one-wins, which would depend on JSON key order.
    if (seen.has(key)) return { refusal: `That push names ${key} twice` };
    seen.add(key);

    const deleted = raw.deleted === true;
    const value = deleted ? null : raw.value;
    if (!deleted) {
      if (typeof value !== 'string') return { refusal: `The row ${key} has no value` };
      if (Buffer.byteLength(value, 'utf8') > MAX_ROW_BYTES)
        return { refusal: `The row ${key} is too large` };
    }
    rows.push({ key, value: deleted ? null : (value as string), deleted });
  }

  const device = typeof body.device === 'string' ? body.device.slice(0, 64) : undefined;
  return { push: { since, rows, ...(device ? { device } : {}) } };
}

/** An email, to the only standard worth applying: it has one `@` and no spaces. */
export function readEmail(body: unknown): { email: string } | { refusal: Refusal } {
  if (!isObj(body) || typeof body.email !== 'string')
    return { refusal: 'That request carries no email address' };
  const email = body.email.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /\s/.test(email))
    return { refusal: 'That is not an email address' };
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@') || at === email.length - 1)
    return { refusal: 'That is not an email address' };
  if (!email.slice(at + 1).includes('.')) return { refusal: 'That is not an email address' };
  return { email };
}
