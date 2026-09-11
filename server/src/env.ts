/**
 * THE CONFIGURATION, READ ONCE AND CHECKED ONCE.
 *
 * A server that starts happily and fails on the first request that needs a
 * setting is a server that fails in front of somebody. Everything required is
 * read here at boot and the process refuses to start without it — the same
 * argument `readBackup` makes about checking everything before returning
 * anything.
 */

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const flag = (name: string): boolean => process.env[name] === 'true';

export const env = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: need('DATABASE_URL'),

  /** where a magic link points — the app's own https link, not this server */
  appLinkBase: process.env.APP_LINK_BASE || 'https://hooprec.app/signin',

  /** Resend, or nothing — see `mail.ts`. Without it links go to the log. */
  resendKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'HoopRec <login@hooprec.app>',

  /** must match the entitlement id the app ships with */
  entitlementId: process.env.REVENUECAT_ENTITLEMENT_ID || 'pro',
  /** the shared secret RevenueCat sends in `Authorization` on every webhook */
  revenueCatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET || '',
  /** accept SANDBOX events — on by default off production */
  acceptSandbox: flag('REVENUECAT_ACCEPT_SANDBOX'),

  /**
   * DEV ONLY: hand the magic link back in the response instead of mailing it.
   * Guarded by its own flag rather than by `NODE_ENV`, because a staging box
   * that quietly returns login tokens is a staging box that hands out accounts.
   */
  devLogin: flag('ALLOW_DEV_LOGIN'),

  /** browser origins allowed to call this — the web build's, in a list */
  origins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
