import { useEffect, useMemo, useState } from 'react';

import { useHistoryStore } from '../store/historyStore';
import type { GameSummary } from '../lib/history';
import type { GameState } from '../types';

/**
 * ONE SAVED GAME, WITH THE ROW IT WAS FILED UNDER.
 *
 * A `GameState` carries no id — the id belongs to the SHELF, which is what the
 * two-key storage shape means — so anything that has to open a game it has
 * just read needs the summary beside it rather than a second lookup that can
 * only match on guesswork.
 */
export interface SavedGame {
  id: string;
  summary: GameSummary;
  game: GameState;
}

/**
 * EVERY SAVED GAME, IN FULL, newest first — or `null` while they are being read.
 *
 * The index is enough for the shelf and for the lobby, and that is the whole
 * point of the two-key storage shape. It is NOT enough for anything that adds
 * stat lines up: a summary has a score and a date and no stats at all. So the
 * screens that aggregate — the season, one competition's page, the last game's
 * analysis — open every row, and they do it through this one hook rather than
 * each keeping their own copy of the effect.
 *
 * It re-reads when the SHELF changes and not when zustand hands back a fresh
 * array of the same games, which is what the joined ids are for. A row that
 * will not parse is DROPPED WITH ITS SUMMARY rather than zeroing the season
 * around it — pairing them here is what makes that safe, where a caller
 * zipping two arrays by index would silently shift every game onto the wrong
 * row the first time one failed to load.
 *
 * Thirty rows off AsyncStorage, on screens nobody opens during a possession.
 */
export function useSavedRows(): SavedGame[] | null {
  const index = useHistoryStore((s) => s.index);
  const loadGame = useHistoryStore((s) => s.loadGame);

  const [rows, setRows] = useState<SavedGame[] | null>(null);

  const ids = index.map((g) => g.id).join(',');

  useEffect(() => {
    let alive = true;
    setRows(null);
    void Promise.all(
      index.map(async (summary) => {
        const game = await loadGame(summary.id);
        return game ? { id: summary.id, summary, game } : null;
      }),
    ).then((loaded) => {
      if (alive) setRows(loaded.filter((r): r is SavedGame => r !== null));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, loadGame]);

  return rows;
}

/**
 * The same read, as the bare games — what the two aggregating screens want,
 * since neither of them opens anything.
 *
 * It is `useSavedRows` narrowed rather than a second effect: two hooks reading
 * the same thirty rows off disk would be thirty reads twice on any screen that
 * happened to want both.
 */
export function useSavedGames(): GameState[] | null {
  const rows = useSavedRows();
  return useMemo(() => (rows ? rows.map((r) => r.game) : null), [rows]);
}
