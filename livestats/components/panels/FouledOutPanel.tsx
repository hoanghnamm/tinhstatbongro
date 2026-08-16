import { Text, View } from 'react-native';

import { FOULS } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useOnBench, usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Btn, Empty, Note, PTitle, Row, Stack } from './shell';

/**
 * The one list that is not a tile grid: after a disqualification the question
 * is who replaces them, and the bench is short enough to read as rows.
 */
export function FouledOutPanel({ playerId }: { playerId: string }) {
  const m = useMetrics();
  const t = useTheme();
  const p = usePlayer(playerId);
  const pool = useOnBench();
  const substitute = useGameStore((s) => s.substitute);
  const reset = useUiStore((s) => s.reset);

  useAnnounce(p ? `number ${p.number} has fouled out` : '');
  if (!p) return null;

  return (
    <>
      <PTitle title={`#${p.number} has fouled out`} kind={`${FOULS} FOULS`} tone="bad" />
      <Note>{p.name} is off the court and cannot come back on. Pick a replacement.</Note>
      <Stack>
        <View style={{ height: m.sp }} />
        {pool.length ? (
          pool.map((q) => (
            <Press
              key={q.id}
              onPress={() => {
                substitute(playerId, q.id);
                reset();
              }}
              accessibilityLabel={`#${q.number} ${q.name}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: m.sp,
                minHeight: m.tap,
                padding: m.sp,
                borderWidth: 2,
                borderColor: t.line,
                borderRadius: m.r,
              }}
              pressedStyle={{ backgroundColor: t.surface2 }}
            >
              <Text
                style={{
                  flexGrow: 0, flexShrink: 0,
                  fontFamily: fNum(700), fontSize: m.fsXl, color: t.ink,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {q.number}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
                  fontFamily: fNum(500), fontSize: m.fsMd, color: t.ink,
                }}
              >
                {q.name}
              </Text>
            </Press>
          ))
        ) : (
          <Empty>The bench is empty. You are playing short.</Empty>
        )}
        <Row>
          <Btn label={pool.length ? 'PLAY SHORT' : 'CLOSE'} variant="solid" onPress={reset} />
        </Row>
      </Stack>
    </>
  );
}
