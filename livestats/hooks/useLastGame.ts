import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '../store/gameStore';
import { useHistoryStore } from '../store/historyStore';
import type { GameState } from '../types';

/**
 * The last game that FINISHED, wherever it happens to be living.
 *
 * IT HAS NO CALLER, and it is left standing rather than deleted, exactly as
 * `app/stats.tsx` is. Its one caller was the lobby's LAST GAME strip, and the
 * lobby is two blocks now — the MVP and the current competition — neither of
 * which is about one game. Nothing routes here today; the last game's own line
 * is on the MATCHES shelf, on its own page.
 *
 * There are two places it can be, and only two:
 *
 *   - `gameStore`, when the game on the board is the one that ended. That state
 *     persists across a restart, so a scorer who ends a game and comes back
 *     tomorrow still opens on it — and it is the live copy, so UNDO after the
 *     buzzer is still reflected here.
 *   - `historyStore`, once a NEW game has replaced it on the board. Only the
 *     summaries are in memory, so the full state is read back off its own key —
 *     one row, on mount, and only when there is something to read.
 *
 * `live` is which of the two, because it decides where FINAL STATS goes: the
 * live copy has the whole stats screen behind it, a saved one has its own.
 */
export interface LastGame {
  state: GameState;
  /** null when it is the live copy — a saved game is addressed by its id */
  id: string | null;
  live: boolean;
}

export function useLastGame(): LastGame | null {
  const g = useGameStore(
    useShallow(
      (s): GameState => ({
        team: s.team,
        squadId: s.squadId,
        squadName: s.squadName,
        kind: s.kind,
        competition: s.competition,
        opponent: s.opponent,
        note: s.note,
        score: s.score,
        oppScore: s.oppScore,
        periods: s.periods,
        periodLen: s.periodLen,
        period: s.period,
        remaining: s.remaining,
        running: s.running,
        ended: s.ended,
        possessions: s.possessions,
        timeouts: s.timeouts,
        players: s.players,
        events: s.events,
      }),
    ),
  );
  const newest = useHistoryStore((s) => s.index[0]?.id ?? null);
  const loadGame = useHistoryStore((s) => s.loadGame);

  const [saved, setSaved] = useState<{ id: string; state: GameState } | null>(null);

  // the live copy wins whenever it is a finished game, so nothing is read off
  // disk in the case that matters most — the minutes after the final buzzer
  const wanted = g.ended ? null : newest;

  useEffect(() => {
    if (!wanted) {
      setSaved(null);
      return;
    }
    let alive = true;
    void loadGame(wanted).then((state) => {
      if (alive) setSaved(state ? { id: wanted, state } : null);
    });
    return () => {
      alive = false;
    };
  }, [wanted, loadGame]);

  if (g.ended) return { state: g, id: null, live: true };
  if (saved && saved.id === wanted) return { state: saved.state, id: saved.id, live: false };
  return null;
}
