import { ScrollView } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { PlaysList } from './PlaysList';
import { Btn, PTitle, Row } from './shell';

/**
 * The play log as a panel: the rows come from `PlaysList`, which the saved-game
 * screen also renders, and the panel adds the title, the cap on its height and
 * the one action a live log has — UNDO LAST.
 */
export function PlaysPanel() {
  const m = useMetrics();
  const events = useGameStore((s) => s.events);
  const players = useGameStore((s) => s.players);
  const undo = useGameStore((s) => s.undo);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('play by play');

  return (
    <>
      <PTitle title="Play by play" kind={`${events.length} PLAYS`} tone="ink" />
      <ScrollView style={{ maxHeight: m.win.h * (m.compact ? 0.44 : 0.52) }}>
        <PlaysList events={events} players={players} />
      </ScrollView>
      <Row mt>
        <Btn label="UNDO LAST" onPress={undo} />
        <Btn label="CLOSE" variant="solid" onPress={reset} />
      </Row>
    </>
  );
}
