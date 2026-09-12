/**
 * A MOCK SEASON, DROPPED ONTO THE DISK AT LAUNCH — for testing, and nothing
 * else. **Delete this folder and the one line in `app/_layout.tsx` when it has
 * served its purpose.**
 *
 * ## WHY IT IS A BACKUP FILE AND NOT A FIXTURE
 *
 * `mockSeason.json` is a real `lib/backup.ts` file, and this module hands it to
 * the real `readBackup` and the real `applyBackup`. That is deliberate: a dev
 * seed that wrote the stores directly would be a SECOND way into storage
 * beside the one the app ships, and the first thing it would do is drift —
 * a key renamed, a persist version bumped, and the seed quietly writes rows
 * nothing reads. Going in through the front door means this file cannot
 * disagree with the app about what a saved game is, and it means the mock data
 * lands through each store's own migration exactly as a scorer's own backup
 * would.
 *
 * It also means the seed is subject to the refusals a real file is: a corrupted
 * `mockSeason.json` is REFUSED whole rather than half-restored.
 *
 * ## IT REPLACES, BECAUSE `applyBackup` REPLACES
 *
 * The club, the roster and the shelf are overwritten — see `applyBackup`, which
 * is a replace and not a merge on purpose. So this runs ONCE PER INSTALL and
 * leaves a marker behind: without one it would fire on every reload and eat
 * whatever you had just tapped in while testing, which is the opposite of
 * useful. Flip `RESEED` when you actually want the season put back.
 *
 * The marker key does not `travels()`, so it never ends up inside a real
 * backup, and `applyBackup` only sweeps `hooplog-game:` rows, so it survives
 * the restore that writes it.
 *
 * ## WHAT IT DOES NOT TOUCH
 *
 * `hooplog-intro`, for the same reason a backup does not carry it: whether this
 * install has been through the door is a fact about the INSTALL. A fresh Expo
 * Go install therefore still opens on the door, with the mock season already
 * behind it.
 */
import { readBackup } from '../lib/backup';
import { Store } from '../platform/storage';
import { applyBackup } from '../store/backup';
import mockSeason from './mockSeason.json';

/** Off switch. The whole thing is `__DEV__`-gated as well. */
export const SEED_MOCK = false;

/**
 * Put the season back even though this install has already been seeded.
 *
 * It fires on EVERY reload while it is true, and every one of those throws away
 * the club, the roster and the shelf — so turn it on, reload once, turn it off.
 */
export const RESEED = false;

/** Not a `hooplog-` key, so nothing in the app is tempted to read it. */
const MARKER = 'dev-mock-seeded';

export async function seedMock(): Promise<void> {
  if (!__DEV__ || !SEED_MOCK) return;

  try {
    if (!RESEED && (await Store.getItem(MARKER))) return;

    const read = readBackup(JSON.stringify(mockSeason));
    if ('fault' in read) {
      console.warn('[dev] the mock season was refused: ' + read.fault);
      return;
    }

    await applyBackup(read.backup);
    await Store.setItem(MARKER, String(Date.now()));
    console.log('[dev] mock season seeded — 10 matches, 12 players');
  } catch (e) {
    // a seed that cannot land is a testing inconvenience, never a crash on
    // launch: the app is perfectly usable with an empty shelf
    console.warn('[dev] the mock season could not be seeded', e);
  }
}
