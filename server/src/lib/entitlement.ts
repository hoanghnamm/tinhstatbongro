/**
 * WHO HAS PAID, AND THE ANSWER COMES FROM THE STORE, NOT FROM THE APP.
 *
 * `livestats/lib/billing.ts` is the rulebook for what is BEHIND the wall and it
 * stays exactly where it is — this file is the other half of that sentence in
 * `store/billingStore.ts`: "paid access is published only from RevenueCat
 * CustomerInfo, never a local purchase flag". Until now the client asked the
 * RevenueCat SDK directly, which is correct and is also a fact that lives only
 * on that device. An entitlement that lives on a device does not survive a
 * reinstall, does not reach a second phone, and cannot be looked at when
 * somebody writes in to say they paid and it is gone.
 *
 * So RevenueCat's webhook lands here, the account carries the answer, and the
 * SDK's own cache becomes what it should have been all along: the offline
 * fallback. The client keeps working with no network — it just stops being the
 * only place the truth exists.
 *
 * ## THE JOIN IS `app_user_id`, AND IT HAS TO BE SET BEFORE ANY MONEY MOVES
 *
 * RevenueCat identifies a payer by `app_user_id`. Left alone the SDK invents an
 * anonymous one per install, which can never be joined to an account
 * afterwards. The client must call `Purchases.logIn(accountId)` with the id
 * this server minted, and it must do so BEFORE the first purchase — a payment
 * made under an anonymous id is attached to a device and not to a person, and
 * no webhook can repair it later. That is the one ordering constraint in the
 * whole billing path.
 *
 * ## NOTHING HERE OPENS A SOCKET
 *
 * The same line `lib/actions.ts` draws: these are plain functions over a plain
 * payload, so `npm run check` walks every event type without a database, a
 * network or a RevenueCat account.
 */

/** What the server concludes about an account after an event. */
export interface Entitlement {
  /** when paid access runs out; null means it does not (a lifetime purchase) */
  until: Date | null;
  /** granted at all — `until` in the past is not */
  entitled: boolean;
}

/** The fields of a RevenueCat event this server reads. It ignores the rest. */
export interface RcEvent {
  id: string;
  type: string;
  appUserId: string;
  /** the ids this event is about; an event for another entitlement is not ours */
  entitlementIds: string[];
  expiresAt: number | null;
  /** a TRANSFER moves an entitlement between users and names both sides */
  transferredFrom: string[];
  transferredTo: string[];
  environment: string;
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * READ THE ENVELOPE, and refuse it rather than half-read it — a webhook whose
 * shape we do not recognise must not be acknowledged as understood, because
 * RevenueCat stops retrying once it is.
 */
export function readEvent(body: unknown): { event: RcEvent } | { refusal: string } {
  if (!body || typeof body !== 'object') return { refusal: 'not an object' };
  const outer = body as Record<string, unknown>;
  const raw = outer.event;
  if (!raw || typeof raw !== 'object') return { refusal: 'no event' };
  const e = raw as Record<string, unknown>;

  if (typeof e.id !== 'string' || !e.id) return { refusal: 'no event id' };
  if (typeof e.type !== 'string' || !e.type) return { refusal: 'no event type' };

  // A TRANSFER carries no `app_user_id` of its own — it names two lists.
  const appUserId =
    typeof e.app_user_id === 'string'
      ? e.app_user_id
      : asStrings(e.transferred_to)[0] ?? '';

  return {
    event: {
      id: e.id,
      type: e.type,
      appUserId,
      entitlementIds: asStrings(e.entitlement_ids),
      expiresAt: typeof e.expiration_at_ms === 'number' ? e.expiration_at_ms : null,
      transferredFrom: asStrings(e.transferred_from),
      transferredTo: asStrings(e.transferred_to),
      environment: typeof e.environment === 'string' ? e.environment : 'PRODUCTION',
    },
  };
}

/**
 * THE EVENTS THAT TAKE ACCESS AWAY, and every other event grants it.
 *
 * Stated as the short list rather than the long one, because the long one grows
 * — RevenueCat adds event types, and a new type that means "they are still
 * paying" must not lock somebody out because this file had not heard of it yet.
 * Failing open on an unknown event is the right way round: the worst case is a
 * scorer keeps access they have stopped paying for until the next renewal date
 * passes, and `expiresAt` closes that by itself.
 *
 * CANCELLATION is deliberately NOT here. A cancelled subscription is one that
 * will not renew — it has been paid for to the end of its term, and taking the
 * app away the moment somebody cancels takes away something they bought.
 */
export const REVOKING = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);

/** A TRANSFER moves the entitlement off one account and onto another. */
export const TRANSFER = 'TRANSFER';

/**
 * WHAT THIS EVENT MEANS FOR THE ACCOUNT IT NAMES.
 *
 * `null` means the event is not about us at all — another entitlement, or a
 * sandbox event on a production server — and the caller stores it and moves on.
 */
export function entitlementFrom(
  event: RcEvent,
  entitlementId: string,
  now: number = Date.now(),
): Entitlement | null {
  // An event listing entitlements that do not include ours is somebody else's
  // product. An event listing NONE is a store-level event (a refund, say) and
  // is taken at face value.
  if (event.entitlementIds.length && !event.entitlementIds.includes(entitlementId)) return null;

  if (REVOKING.has(event.type)) return { until: null, entitled: false };

  const until = event.expiresAt === null ? null : new Date(event.expiresAt);
  // A lifetime purchase has no expiry; a subscription whose expiry has already
  // passed by the time the webhook lands is not access.
  const entitled = until === null || until.getTime() > now;
  return { until, entitled };
}

/** Is a stored entitlement still good? The one question every gate asks. */
export function stillEntitled(until: Date | null, entitled: boolean, now: number = Date.now()): boolean {
  if (!entitled) return false;
  return until === null || until.getTime() > now;
}
