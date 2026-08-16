import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from './gameStore';
import type { Player } from '../types';

/**
 * Every list selector goes through `useShallow`: zustand v5 compares snapshots
 * by identity, and a fresh `.filter()` array on each render would otherwise
 * loop forever. The elements themselves are stable, so shallow is enough.
 */
export const useByIdLookup = () =>
  useGameStore(useShallow((s) => s.players)) as Player[];

export const usePlayer = (id: string | null): Player | undefined =>
  useGameStore((s) => (id ? s.players.find((p) => p.id === id) : undefined));

export const useOnCourt = () =>
  useGameStore(useShallow((s) => s.players.filter((p) => p.status === 'active')));

export const useOnBench = () =>
  useGameStore(useShallow((s) => s.players.filter((p) => p.status === 'bench')));

export const useFouledOut = () =>
  useGameStore(useShallow((s) => s.players.filter((p) => p.status === 'out')));

/**
 * The rail always shows five. If fouling out has left fewer than five on the
 * floor, the disqualified fill the gap so the column keeps its rhythm and the
 * player stays reachable for a substitution; past that the rail pads with
 * empty rows itself.
 */
export const useRailPlayers = () =>
  useGameStore(
    useShallow((s) =>
      s.players
        .filter((p) => p.status === 'active')
        .concat(s.players.filter((p) => p.status === 'out'))
        .slice(0, 5),
    ),
  );

/** Step 2 of every flow lists the floor, then the fouled-out as disabled tiles. */
export const useWhoList = () =>
  useGameStore(
    useShallow((s) =>
      s.players
        .filter((p) => p.status === 'active')
        .concat(s.players.filter((p) => p.status === 'out')),
    ),
  );
