import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { BoxScore } from './BoxScore';
import { Btn, Row } from './shell';
import type { GameState } from '../../types';

/**
 * The box score mid-game: the whole thing is `BoxScore`, and this panel is the
 * three ways out of it. The table itself lives in its own file because the
 * saved-game screen shows the same one over a game loaded off disk.
 */
export function TotalsPanel() {
  const g = useGameStore(
    useShallow(
      (s): GameState => ({
        team: s.team,
        opponent: s.opponent,
        note: s.note,
        score: s.score,
        oppScore: s.oppScore,
        period: s.period,
        remaining: s.remaining,
        running: s.running,
        ended: s.ended,
        possessions: s.possessions,
        players: s.players,
        events: s.events,
      }),
    ),
  );
  const open = useUiStore((s) => s.open);
  const reset = useUiStore((s) => s.reset);

  useAnnounce(g.ended ? 'final box score' : 'box score');

  return (
    <>
      <BoxScore g={g} />

      <Row mt>
        <Btn label="PLAY BY PLAY" onPress={() => open({ kind: 'plays' })} />
        {/* this panel is the glance mid-game; the screen is the full line, by
            quarter, with the shot chart and the zones on it */}
        <Btn
          label="FULL STATS"
          onPress={() => {
            reset();
            router.push('/stats');
          }}
        />
        <Btn label="CLOSE" variant="solid" onPress={reset} />
      </Row>
    </>
  );
}
