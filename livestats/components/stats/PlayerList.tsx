import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Press } from '../ui/Press';
import { Row, Col } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { useRoomMetrics } from '../../theme/room';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { Season, SeasonLine } from '../../lib/season';

const num = (n: number): string => Number.isInteger(n) ? String(n) : n.toFixed(1);
interface Columns { jersey: number; games: number; stat: number; gap: number; stacked: boolean }
function HeadCell({ label, width }: { label: string; width: number }) {
  const m = useMetrics(); const t = useTheme();
  return <Text numberOfLines={1} style={{ width, flexShrink: 0, textAlign: 'right', ...fUi(500),
    fontSize: m.fsXs, letterSpacing: ls(m.fsXs, LS_CAPS), color: t.ink2 }}>{label}</Text>;
}
function StatCell({ value, width, strong = false }: { value: string; width: number; strong?: boolean }) {
  const m = useMetrics(); const t = useTheme();
  return <Text numberOfLines={1} style={{ width, flexShrink: 0, textAlign: 'right',
    ...(strong ? fNum(700) : fNum(500)), fontSize: m.fsSm, letterSpacing: ls(m.fsSm, LS_TIGHT),
    color: strong ? t.ink : t.ink2, fontVariant: ['tabular-nums'] }}>{value}</Text>;
}
function PlayerRow({ line, columns: c, onPress }: { line: SeasonLine; columns: Columns; onPress?: () => void }) {
  const m = useMetrics(); const t = useTheme(); const s = line.stats;
  const identity = <Row gap={c.gap} style={{ flex: c.stacked ? undefined : 1, minWidth: 0 }}>
    <Text numberOfLines={1} style={{ width: c.jersey, flexShrink: 0, textAlign: 'right', ...fNum(500),
      fontSize: m.fsSm, color: t.ink2, fontVariant: ['tabular-nums'] }}>{line.number}</Text>
    <Text numberOfLines={c.stacked ? 2 : 1} style={{ flex: 1, minWidth: 0, ...fUi(500), fontSize: m.fsSm,
      lineHeight: m.fsSm * 1.4, letterSpacing: ls(m.fsSm, LS_LABEL), color: t.ink }}>{line.name || `Player ${line.number}`}</Text>
  </Row>;
  return <Press onPress={onPress}
    accessibilityLabel={`${line.name || `Player ${line.number}`}, number ${line.number}. ${line.games} games. ${num(s.points)} points, ${num(s.offensiveRebounds + s.defensiveRebounds)} rebounds, ${num(s.assists)} assists per game. Open player season`}
    style={{ borderTopWidth: 1, borderTopColor: t.rule, paddingVertical: m.s3, minHeight: m.tap, justifyContent: 'center' }}
    pressedStyle={{ backgroundColor: t.surface }}>
    <View style={{ flexDirection: c.stacked ? 'column' : 'row', gap: c.gap }}>
      {identity}
      <Row gap={c.gap} justify="flex-end">
        <StatCell value={String(line.games)} width={c.games} />
        <StatCell value={num(s.points)} width={c.stat} strong />
        <StatCell value={num(s.offensiveRebounds + s.defensiveRebounds)} width={c.stat} />
        <StatCell value={num(s.assists)} width={c.stat} />
      </Row>
    </View>
  </Press>;
}

/** Already-averaged values; responsive composition never recalculates the stats. */
export function PlayerList({ season, onPlayerPress }: { season: Season; onPlayerPress?: (playerId: string) => void }) {
  const m = useMetrics(); const room = useRoomMetrics(); const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured || room.width;
  const unit = m.fsSm * fontScale;
  const gap = m.s1;
  const c: Columns = {
    jersey: unit * 1.6,
    games: unit * 1.5,
    stat: unit * 2.8,
    gap,
    stacked: width < Math.max(m.tap * 7.5, unit * 17 + gap * 5),
  };
  // At very large text sizes, let each labeled value wrap as a group instead of clipping digits.
  const largeText = c.games + c.stat * 3 + gap * 3 > width;
  return <View onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
    {season.lines.length === 0 ? <Text style={{ paddingVertical: m.s5, ...fUi(400), fontSize: m.fsSm, color: t.ink2 }}>Nobody has a line yet</Text> : <>
      <Row gap={gap} style={{ paddingBottom: m.s2, flexWrap: 'wrap' }}>
        <Text style={{ flex: 1, ...fUi(400), fontSize: m.fsXs, letterSpacing: ls(m.fsXs, LS_MICRO), color: t.ink2 }}>Per game</Text>
        {!largeText && <Row gap={gap}>
          <HeadCell label="G" width={c.games} /><HeadCell label="PTS" width={c.stat} />
          <HeadCell label="REB" width={c.stat} /><HeadCell label="AST" width={c.stat} />
        </Row>}
      </Row>
      {season.lines.map((line) => largeText ? <Press key={line.id} onPress={onPlayerPress ? () => onPlayerPress(line.id) : undefined}
        accessibilityLabel={`${line.name || `Player ${line.number}`}, number ${line.number}. ${line.games} games. ${num(line.stats.points)} points, ${num(line.stats.offensiveRebounds + line.stats.defensiveRebounds)} rebounds, ${num(line.stats.assists)} assists per game. Open player season`}
        style={{ paddingVertical: m.s3, minHeight: m.tap, borderTopWidth: 1, borderTopColor: t.rule }} pressedStyle={{ backgroundColor: t.surface }}>
        <Col gap={m.s2}>
          <Text style={{ ...fUi(500), fontSize: m.fsSm, color: t.ink }}>{line.number} · {line.name || `Player ${line.number}`}</Text>
          <Row gap={m.s3} style={{ flexWrap: 'wrap' }}>
            {([['G', line.games], ['PTS', line.stats.points], ['REB', line.stats.offensiveRebounds + line.stats.defensiveRebounds], ['AST', line.stats.assists]] as const).map(([label, value]) =>
              <Col key={label} gap={m.s1} style={{ minWidth: unit * 2.8 }}>
                <Text style={{ ...fNum(600), fontSize: m.fsSm, color: t.ink, fontVariant: ['tabular-nums'] }}>{num(value)}</Text>
                <Text style={{ ...fUi(400), fontSize: m.fsXs, color: t.ink2 }}>{label}</Text>
              </Col>)}
          </Row>
        </Col>
      </Press> : <PlayerRow key={line.id} line={line} columns={c}
        onPress={onPlayerPress ? () => onPlayerPress(line.id) : undefined} />)}
    </>}
  </View>;
}
