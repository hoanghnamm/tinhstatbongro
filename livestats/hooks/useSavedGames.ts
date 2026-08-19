import { useEffect, useState } from 'react';

import { useHistoryStore } from '../store/historyStore';
import type { GameState } from '../types';

/**
 * EVERY SAVED GAME, IN FULL, newest first — or `null` while they are being read.
 *
 * The index is enough for the shelf and for the lobby, and that is the whole
 * point of the two-key storage shape. It is NOT enough for anything that adds
 * stat lines up: a summary has a score and a date and no stats at all. So the
 * two screens that aggregate — the season and one competition's page — open
 * every row, and they do it through this one hook rather than each keeping
 * their own copy of the effect.
 *
 * It re-reads when the SHELF changes and not when zustand hands back a fresh
 * array of the same games, which is what the joined ids are for. A row that
 * will not parse is dropped rather than zeroing the season around it.
 *
 * Thirty rows off AsyncStorage, on screens nobody opens during a possession.
 */
export function useSavedGames(): GameState[] | null {
  const index = useHistoryStore((s) => s.index);
  const loadGame = useHistoryStore((s) => s.loadGame);

  const [games, setGames] = useState<GameState[] | null>(null);

  const ids = index.map((g) => g.id).join(',');

  useEffect(() => {
    let alive = true;
    setGames(null);
    void Promise.all(index.map((g) => loadGame(g.id))).then((loaded) => {
      if (alive) setGames(loaded.filter((g): g is GameState => g !== null));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, loadGame]);

  return games;
}
