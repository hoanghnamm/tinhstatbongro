import { Store } from '../platform/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SEED_ROSTER } from '../constants/game';
import { ROSTER_CAP, cleanName, migrateRoster, newRosterId } from '../lib/roster';
import type { RosterPlayer } from '../types';

/**
 * The team, which is not the game.
 *
 * `gameStore` used to hold both: eight hardcoded players carrying stat lines,
 * so there was no way to add a twelfth without inventing a stat line for them
 * and no way to fix a spelling without touching a live box score. This store
 * holds the durable half — a jersey and a name — and `gameStore.startGame`
 * copies whichever entries the scorer picked into fresh `Player`s.
 *
 * Nothing here reaches a game in progress. That is not a convention: the only
 * crossing is `buildPlayers`, it runs once at tip-off, and it copies field by
 * field. `npm run check` asserts it.
 *
 * Persisted plainly rather than through `gameStore`'s debounced storage — a
 * roster is edited a handful of times a season, not 600 times a quarter.
 */
export interface RosterState {
  players: RosterPlayer[];

  /**
   * Refused past `ROSTER_CAP`; the ADD button is disabled there anyway.
   * `available` is optional here and nowhere else — the form has a switch for
   * it, but a caller that does not care means "on the team".
   *
   * IT RETURNS THE NEW ID, or null when it refused, because the id is minted
   * in here and the TEAM tab has to draft the player it just created onto the
   * sheet it is looking at. Finding them again by jersey number afterwards
   * would be a lookup that is wrong the moment two rows share a number for one
   * keystroke, which is a state the number field deliberately allows.
   */
  add(p: Omit<RosterPlayer, 'id' | 'available'> & { available?: boolean }): string | null;
  update(id: string, patch: Partial<Omit<RosterPlayer, 'id'>>): void;
  remove(id: string): void;
}

export const useRosterStore = create<RosterState>()(
  persist(
    (set, get) => ({
      // the eight that used to be hardcoded in `gameStore`, migrated here as
      // the first-run default — an empty first run would strand NEW GAME
      players: SEED_ROSTER.map((p) => ({ ...p })),

      add: (p) => {
        const players = get().players;
        if (players.length >= ROSTER_CAP) return null;
        const id = newRosterId();
        set({
          players: [
            ...players,
            {
              id,
              number: p.number,
              name: cleanName(p.name),
              position: p.position,
              // the form's default, and the only sane one: a player is added
              // because they are on the team, not because they are injured
              available: p.available ?? true,
            },
          ],
        });
        return id;
      },

      update: (id, patch) =>
        set({
          players: get().players.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  name: patch.name === undefined ? p.name : cleanName(patch.name),
                }
              : p,
          ),
        }),

      remove: (id) => set({ players: get().players.filter((p) => p.id !== id) }),
    }),
    {
      name: 'hooplog-roster',
      storage: createJSONStorage(() => Store),
      /**
       * 1 → 2 added `position` and `available`.
       *
       * The migration is not optional politeness: `available` is read as a
       * filter by the starter picker, `undefined` is falsy, and a roster
       * rehydrated without it would put an empty picker in front of a scorer
       * at tip-off. `migrateRoster` defaults it to true and lives in `lib/`,
       * so `npm run check` runs the real thing.
       */
      version: 2,
      migrate: (persisted, _version) => ({
        players: migrateRoster((persisted as Partial<RosterState> | undefined)?.players),
      }),
    },
  ),
);
