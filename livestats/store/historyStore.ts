import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  HISTORY_CAP,
  gameKey,
  newGameId,
  pushSummary,
  reviveGame,
  summarise,
  type GameSummary,
} from '../lib/history';
import type { GameState } from '../types';

/**
 * The games that are over.
 *
 * A fourth store, and the split is the same one the roster already made: the
 * live game is `gameStore` and there is exactly one of it, while a finished
 * game is a record and there are up to thirty. Nothing here ever writes to
 * `gameStore`, and clearing the live game — which is what NEW GAME does — does
 * not touch a saved copy.
 *
 * ONLY THE INDEX IS IN THE STORE. The summaries are what HOME and the GAMES
 * list render, they are small, and they are persisted with the store the
 * ordinary way. The full games are written straight to AsyncStorage under
 * their own keys by `saveGame` and read back by `loadGame`, so opening one is
 * a single row and rendering the list is none — see `lib/history.ts` for why
 * that is not a premature optimisation.
 */
export interface HistoryState {
  /** newest first, capped at `HISTORY_CAP` */
  index: GameSummary[];

  /**
   * Called ONCE, on END GAME confirm. Returns the id it saved under so the
   * caller can go straight to it. Writing the game is fire-and-forget: the
   * index is what the UI reads, and a failed row is a game that cannot be
   * reopened rather than a broken app.
   */
  saveGame(state: GameState): string;
  loadGame(id: string): Promise<GameState | null>;
  removeGame(id: string): void;
}

const writeGame = (id: string, g: GameState): void => {
  void AsyncStorage.setItem(gameKey(id), JSON.stringify(g));
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      index: [],

      saveGame: (state) => {
        const at = Date.now();
        const id = newGameId(at);
        const { index, dropped } = pushSummary(get().index, summarise(state, id, at), HISTORY_CAP);
        writeGame(id, state);
        // the oldest game's ROW goes with its summary — an index that forgets a
        // game while its key survives is a leak that only ever grows
        for (const g of dropped) void AsyncStorage.removeItem(gameKey(g.id));
        set({ index });
        return id;
      },

      loadGame: async (id) => {
        try {
          const raw = await AsyncStorage.getItem(gameKey(id));
          return raw ? reviveGame(JSON.parse(raw) as unknown) : null;
        } catch {
          // a row that will not parse is a row that is gone, and the list is
          // the wrong place to find that out — the detail screen says so
          return null;
        }
      },

      removeGame: (id) => {
        void AsyncStorage.removeItem(gameKey(id));
        set({ index: get().index.filter((g) => g.id !== id) });
      },
    }),
    {
      name: 'hooplog-history',
      storage: createJSONStorage(() => AsyncStorage),
      // the three methods are not state; only the index is persisted
      partialize: (s) => ({ index: s.index }),
    },
  ),
);
