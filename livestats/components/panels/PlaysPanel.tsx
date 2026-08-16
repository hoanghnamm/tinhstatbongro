import { ScrollView, Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { describe } from '../../lib/describe';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn, Empty, PTitle, Row } from './shell';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The append-only event log, newest first. Anything reading events must tolerate
 * a null playerId — an opponent point has no jersey, so the column prints OPP.
 */
export function PlaysPanel() {
  const m = useMetrics();
  const t = useTheme();
  const events = useGameStore((s) => s.events);
  const players = useGameStore((s) => s.players);
  const undo = useGameStore((s) => s.undo);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('play by play');

  const byId = (id: string) => players.find((p) => p.id === id);
  const rows = events.slice().reverse();
  const tcol = clamp(42, 0.09 * m.win.h, 90);
  const ncol = clamp(28, 0.054 * m.win.h, 56);

  return (
    <>
      <PTitle title="Play by play" kind={`${events.length} PLAYS`} tone="ink" />
      <ScrollView style={{ maxHeight: m.win.h * (m.compact ? 0.44 : 0.52) }}>
        {rows.length ? (
          rows.map((ev, i) => {
            const p = ev.playerId ? byId(ev.playerId) : undefined;
            const value = 'value' in ev ? ev.value : 0;
            return (
              <View
                key={ev.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: m.sp,
                  paddingVertical: m.sp, paddingHorizontal: 2,
                  backgroundColor: i % 2 === 0 ? t.surface2 : 'transparent',
                }}
              >
                <Text
                  style={{
                    width: tcol, paddingLeft: 4, fontFamily: fNum(500),
                    fontSize: m.fsMd, color: t.ink2, fontVariant: ['tabular-nums'],
                  }}
                >
                  {ev.gameClock}
                </Text>
                <Text
                  style={{
                    minWidth: ncol, textAlign: 'center', borderRadius: 99,
                    paddingVertical: 2, paddingHorizontal: m.sp * 0.9,
                    backgroundColor: t.ink, color: t.surface,
                    fontFamily: fNum(700), fontSize: m.fsSm, overflow: 'hidden',
                  }}
                >
                  {p ? p.number : 'OPP'}
                </Text>
                <Text
                  style={{ flex: 1, fontFamily: fNum(600), fontSize: m.fsMd, color: t.ink }}
                >
                  {describe(ev, byId)}
                </Text>
                <Text
                  style={{
                    paddingRight: 4, fontFamily: fNum(700), fontSize: m.fsMd, color: t.accent,
                  }}
                >
                  {value ? '+' + value : ''}
                </Text>
              </View>
            );
          })
        ) : (
          <Empty>No plays recorded yet.</Empty>
        )}
      </ScrollView>
      <Row mt>
        <Btn label="UNDO LAST" onPress={undo} />
        <Btn label="CLOSE" variant="solid" onPress={reset} />
      </Row>
    </>
  );
}
