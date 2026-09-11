/**
 * WHICH ROWS CROSS THE WIRE — and this list is the client's, not the server's.
 *
 * `livestats/lib/backup.ts` already answered this question once, for the backup
 * file, and the answer is the same one here for the same reasons: sync is a
 * backup that happens continuously. The list is repeated rather than imported
 * because the two packages ship separately and a server that trusted the app's
 * copy would be trusting whatever build last deployed. `npm run check` on both
 * sides asserts the two lists agree.
 *
 * ## THE SERVER NEVER PARSES WHAT IT CARRIES
 *
 * A row is a key and the exact string the app wrote, which means adding a field
 * to `Player` needs no migration here, no deploy here, and no version skew
 * between a phone on the old build and a phone on the new one. It also means
 * the server cannot merge two versions of a row — it does not know what is
 * inside one — which is why `sync.ts` refuses a stale push instead of guessing.
 */

/** The rows a synced account holds. A trailing `:` is a prefix, not a key. */
export const SYNC_KEYS = [
  'hooplog-team',
  'hooplog-roster',
  'hooplog-squads',
  'hooplog-history',
  'hooplog-game:',
] as const;

/** Does this key belong on the server? */
export const travels = (key: string): boolean =>
  SYNC_KEYS.some((k) => (k.endsWith(':') ? key.startsWith(k) : key === k));

/**
 * WHAT DOES NOT TRAVEL, stated rather than implied, so the reason survives.
 *
 * - `hooplog-billing` — whether somebody has paid is a fact about their
 *   ACCOUNT, and the account lives here. A client that could push an
 *   entitlement up could grant itself one. It is refused at both ends.
 * - `livestats-game` — the board mid-possession. A game in progress is not a
 *   record yet, and pushing one at a second device that has its own game open
 *   is the one sync that could destroy something live.
 * - `hooplog-intro`, `hooplog-tutorial` — facts about an INSTALL, not about a
 *   club. A new device is meant to see the door.
 * - `hooplog-sync` — the cursor itself, which is per device by definition.
 */
export const NEVER_TRAVELS = [
  'hooplog-billing',
  'livestats-game',
  'hooplog-intro',
  'hooplog-tutorial',
  'hooplog-sync',
] as const;

/** A game row's key names one saved game. Mirrors `gameKey` in the app. */
export const GAME_PREFIX = 'hooplog-game:';

/** The largest single row we will accept, in bytes of UTF-8. */
export const MAX_ROW_BYTES = 2_000_000;

/** The most rows one push may carry. A full season restore is well under this. */
export const MAX_PUSH_ROWS = 200;
