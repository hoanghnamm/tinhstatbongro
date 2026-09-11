import { Store } from '../platform/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  SQUAD_CAP,
  cleanSquadName,
  migrateSquads,
  newSquadId,
  nextSquadName,
  squadsIn,
  toggleDraft,
} from '../lib/squads';
import { useRosterStore } from './rosterStore';
import type { Squad } from '../types';

/**
 * THE TEAMS — the tenth store, and the third durable half of "my club".
 *
 * The split is the one `teamStore` and `rosterStore` already made and it is
 * made for the same reason: these are three different kinds of thing to keep.
 * A club is a record with a file attached; a pool is a list with a cap and a
 * duplicate rule; a team is a NAME and a SELECTION over that pool, and there
 * are at most three of them.
 *
 * NOTHING HERE HOLDS A PLAYER. `playerIds` points into `rosterStore`, so a
 * spelling fixed on the pool row is fixed on every team at once and a player
 * can be on two teams without being two people. `lib/squads.ts` is the whole
 * rule set — every writer below is a snapshot, one pure function, and a
 * publish, the same shape `gameStore` uses over `lib/actions.ts`.
 *
 * ## THE DERIVED FIRST TEAM, AND WHY THE STORE STARTS EMPTY
 *
 * `squads` is `[]` on a fresh install and on every install that upgraded into
 * this build. It is NOT drawn that way: `squadsIn` supplies one team called
 * `Team 1` holding the whole pool, which is exactly what a club that has never
 * split into teams already had. That keeps two stores out of a rehydration
 * race — nothing here has to wait for the roster to land — and it means the
 * upgrade path is no path at all.
 *
 * Every writer materialises that derived team FIRST, through `withSquads`, so
 * the moment anybody renames a team or drafts a player the list on disk says
 * what the screen was already showing. The pool is read off `rosterStore` at
 * write time rather than at rehydrate for the same reason: by the time a thumb
 * lands on a chip, both stores are long since up.
 */
export interface SquadState {
  squads: Squad[];
  /** the team every other screen follows; `''` means "the first one" */
  activeId: string;

  setActive(id: string): void;
  /** Refused past `SQUAD_CAP`; the `+` is gone there anyway. Returns the new id. */
  create(): string | null;
  rename(id: string, name: string): void;
  /**
   * Deleting is the CALLER's decision to make — `canRemoveSquad` is the rule
   * and it lives in `lib/`, because it needs the shelf and this store has no
   * business reading one.
   */
  remove(id: string): void;
  /** Draft, or un-draft. Refused at `SQUAD_SIZE`; see `toggleDraft`. */
  draft(squadId: string, playerId: string): void;
}

/** The pool as it stands right now — see the header for why this is not a subscription. */
const pool = () => useRosterStore.getState().players;

export const useSquadStore = create<SquadState>()(
  persist(
    (set, get) => {
      /** Materialise the derived first team, then apply one pure rule to it. */
      const withSquads = (fn: (squads: Squad[]) => Squad[]): void => {
        set({ squads: fn(squadsIn(get().squads, pool())) });
      };

      return {
        squads: [],
        activeId: '',

        setActive: (id) => set({ activeId: id }),

        create: () => {
          const squads = squadsIn(get().squads, pool());
          if (squads.length >= SQUAD_CAP) return null;
          const id = newSquadId();
          // A NEW TEAM IS EMPTY, deliberately. The first team holds the whole
          // pool because that is what the club already was; a second one is a
          // sheet the scorer is about to pick, and pre-filling it with twenty
          // names would mean un-picking nineteen.
          set({
            squads: [...squads, { id, name: nextSquadName(squads), playerIds: [] }],
            activeId: id,
          });
          return id;
        },

        rename: (id, name) =>
          withSquads((squads) =>
            squads.map((s) =>
              // a blank field is held as blank on the row and never written —
              // the same call `teamStore.setProfile` makes about the club name
              s.id === id ? { ...s, name: cleanSquadName(name) || s.name } : s,
            ),
          ),

        remove: (id) => {
          const squads = squadsIn(get().squads, pool()).filter((s) => s.id !== id);
          set({ squads, activeId: get().activeId === id ? '' : get().activeId });
        },

        draft: (squadId, playerId) => withSquads((squads) => toggleDraft(squads, squadId, playerId)),
      };
    },
    {
      name: 'hooplog-squads',
      storage: createJSONStorage(() => Store),
      version: 1,
      // THE POOL IS NOT CONSULTED HERE, and that is deliberate. This runs while
      // `rosterStore` may still be reading its own row, so a pool checked now
      // could be empty and would empty every team with it. `migrateSquads`
      // folds the invariants it can decide on its own — duplicates, the two
      // caps, a missing name — and `membersOf` resolves the ids against the
      // pool on the way out, where the pool is certainly there.
      onRehydrateStorage: () => (s) => {
        if (!s) return;
        s.squads = migrateSquads(s.squads);
      },
    },
  ),
);
