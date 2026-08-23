import { Text, View } from 'react-native';

import { describe } from '../../lib/describe';
import { useMetrics } from '../../theme/metrics';
import { fNum, fUi } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Empty } from './shell';
import type { GameEvent, Player } from '../../types';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The append-only event log, newest first — the rows and nothing else, so the
 * panel can put them in a capped ScrollView and the saved-game screen can let
 * the page's own scroll carry them.
 *
 * Anything reading events must tolerate a null playerId: an opponent point has
 * no jersey, so the column prints OPP.
 */
export function PlaysList({ events, players }: { events: GameEvent[]; players: Player[] }) {
  const m = useMetrics();
  const t = useTheme();

  const byId = (id: string) => players.find((p) => p.id === id);
  const rows = events.slice().reverse();
  const tcol = clamp(42, 0.09 * m.win.h, 90);
  const ncol = clamp(28, 0.054 * m.win.h, 56);

  if (!rows.length) return <Empty>No plays recorded yet.</Empty>;

  return (
    <>
      {rows.map((ev, i) => {
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
                width: tcol, paddingLeft: 4, ...fNum(500),
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
                ...fNum(700), fontSize: m.fsSm, overflow: 'hidden',
              }}
            >
              {p ? p.number : 'Opp'}
            </Text>
            <Text style={{ flex: 1, ...fUi(500), fontSize: m.fsSm, color: t.ink }}>
              {describe(ev, byId)}
            </Text>
            <Text
              style={{ paddingRight: 4, ...fNum(700), fontSize: m.fsMd, color: t.accent }}
            >
              {value ? '+' + value : ''}
            </Text>
          </View>
        );
      })}
    </>
  );
}
