/**
 * TOKENS, AND WHY THEY ARE NOT JWTs.
 *
 * A session here is an opaque random string, stored as a SHA-256 hash beside
 * the account it belongs to. That costs one indexed lookup per request and buys
 * the thing a signed token cannot give: revocation. A scorer who loses a phone
 * at a tournament can have that device's session dropped, and a session that is
 * dropped is dropped immediately rather than at the end of its own lifetime.
 *
 * The hash is what is stored, never the token, so a dump of the database does
 * not hand anybody a working session — the same reason a password is not
 * stored. There is no password here to store, which is the other half of why
 * magic links were chosen: the app never holds a secret a person reuses
 * elsewhere.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 bytes of urlsafe base64 — 256 bits, which is not guessable. */
export function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What goes in the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A constant-time compare, for secrets that arrive in a header. */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * A MAGIC LINK LIVES FIFTEEN MINUTES AND IS SPENT ONCE.
 *
 * Long enough to walk to the inbox on a bad arena connection, short enough that
 * a link left sitting in a forwarded mail thread is not a key to a season.
 */
export const LOGIN_TTL_MS = 15 * 60 * 1000;

/**
 * A SESSION LIVES A YEAR, AND THAT IS DELIBERATE.
 *
 * This app is used at courtside, standing up, minutes before a tip-off, often
 * on an arena connection that barely works. Being asked to sign in again at
 * that moment is the app failing at the exact instant it is needed. The session
 * is renewed on use, so an account in regular use never expires at all.
 */
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** How often a used session's expiry is pushed out. Not every request. */
export const SESSION_TOUCH_MS = 24 * 60 * 60 * 1000;

/** The bearer token on a request, or null. */
export function bearer(header: string | undefined | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}
