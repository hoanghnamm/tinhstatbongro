import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SEED_ROSTER } from '../constants/game';
import { ROSTER_CAP, cleanName, newRosterId } from '../lib/roster';
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

  /** Refused past `ROSTER_CAP`; the ADD button is disabled there anyway. */
  add(p: Omit<RosterPlayer, 'id'>): void;
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
        if (players.length >= ROSTER_CAP) return;
        set({
          players: [...players, { id: newRosterId(), number: p.number, name: cleanName(p.name) }],
        });
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
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
