import { View } from 'react-native';

import { litPlayerId } from '../../lib/lit';
import { useGameStore } from '../../store/gameStore';
import { useMeasure } from '../../store/layoutStore';
import { useRailPlayers } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { Surface } from '../ui/Surface';
import { PlayerRow } from './PlayerRow';

/**
 * The whole roster, in one column of five fixed cells: the five on the floor.
 * There is no VIEW button, no bench list and no expanding sheet — a player who
 * is not on the floor is reached through SUBSTITUTE on another player's panel.
 *
 * In portrait it keeps its column form rather than lying down as a strip: an
 * aspect-locked court on a narrow phone is never much more than a third of the
 * screen tall, so a strip left 200–350px of dead space under it. As a column
 * the rail takes exactly that remainder, and the names come back.
 */
export function Rail() {
  const m = useMetrics();
  const t = useTheme();
  const { ref, onLayout } = useMeasure('rail');

  const players = useRailPlayers();
  const shooter = useUiStore((s) => s.shooter);
  const open = useUiStore((s) => s.open);
  // whose row opened what is on screen — a different question from who the
  // in-flight entry picked, and until now the column answered neither
  const active = useUiStore((s) => litPlayerId(s.panel));
  const tapMode = useGameStore((s) => s.options.tap);

  const squeeze = m.compact && !m.portrait;
  const pad = Math.max(0, 5 - players.length);
  const firstOut = players.find((p) => p.status === 'out')?.id;

  const press = (id: string) =>
    tapMode === 'sub'
      ? open({ kind: 'subOut', outId: id })
      : open({ kind: 'playerActions', playerId: id, bumped: null });

  return (
    <Surface
      innerRef={ref}
      onLayout={onLayout}
      style={{
        flex: m.portrait ? 1 : undefined,
        width: m.portrait ? undefined : m.rail,
        minHeight: 0,
        minWidth: 0,
        borderWidth: 1,
        borderColor: t.rule,
        borderRadius: m.r,
        padding: squeeze ? m.s1 : m.s2,
        gap: squeeze ? 2 : m.s1,
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
    >
      {/* TWO OF THE FIVE ARE NAMED FOR THE WALKTHROUGH, and which two is a
          question about the column rather than about a player: the FIRST row
          on the floor, and the first row that is OUT. Both are read off the
          same order the column is drawn in — `useRailPlayers` puts the active
          ahead of the disqualified — so neither name is a guess about who is
          wearing what. */}
      {players.map((p, i) => (
        <PlayerRow
          key={p.id}
          player={p}
          selected={p.id === shooter}
          lit={p.id === active}
          targetId={
            p.status === 'out' ?
              p.id === firstOut ? 'row.out'
              : undefined
            : i === 0 ? 'row.first'
            : undefined
          }
          onPress={() => press(p.id)}
        />
      ))}
      {/* fewer than five active and disqualified between them: pad, so the
          column keeps its five-row rhythm rather than growing the rows */}
      {Array.from({ length: pad }, (_, i) => (
        <View key={'pad' + i} style={{ flex: 1, minHeight: squeeze ? 0 : m.tap }} />
      ))}
    </Surface>
  );
}
