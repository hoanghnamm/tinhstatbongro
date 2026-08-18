import { useState } from 'react';
import { View } from 'react-native';

import { FT_SPOT } from '../../lib/court';
import { pct } from '../../lib/format';
import { COURT_ASPECT, useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { CourtSvg } from '../board/CourtSvg';
import { Row } from '../ui/Row';
import { Card, Empty, Key, Note, Seam, Section, Tile } from './parts';
import type { Report, ShotMark } from '../../lib/box';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The shot chart for one slice — the same grammar the board's own chart uses,
 * because it IS the same chart: a made shot is `accent`, a miss is `markMiss`,
 * and the free throws are one red dot on the line however many were taken,
 * since every one of them is logged at the same coordinate.
 *
 * The court is sized here rather than off `m.court`: that metric is the
 * BOARD's court, which is what is left after the rail and the two action
 * columns are subtracted, and this screen has none of them. So the box is
 * measured, then aspect-locked, then capped against the window height so a
 * phone laid down does not hand the chart the whole viewport.
 */
export function ShotsTab({ report, shots, ft }: { report: Report; shots: ShotMark[]; ft: { m: number; a: number } }) {
  const m = useMetrics();
  const t = useTheme();
  const [boxW, setBoxW] = useState(0);

  const T = report.team;
  // `layout.width` is the OUTER width, padding included, and the card clips —
  // so the pad comes off before the aspect lock, not after it
  const w = Math.min(Math.max(0, boxW - 2 * m.s2), m.win.h * 0.66 * COURT_ASPECT);
  const h = w / COURT_ASPECT;
  const dot = clamp(7, 0.017 * m.win.h, 16);

  return (
    <View>
      <Section title="THE FLOOR" note={`${T.fgm}/${T.fga} from the field`}>
        <View
          onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
          style={{ alignItems: 'center', padding: m.s2 }}
        >
          {w > 0 && (
            <View style={{ width: w, height: h, borderRadius: m.rSm, overflow: 'hidden' }}>
              <CourtSvg zone={null} side={null} />
              <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
                {shots.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: s.x * w - dot / 2,
                      top: s.y * h - dot / 2,
                      width: dot,
                      height: dot,
                      borderRadius: dot / 2,
                      backgroundColor: s.made ? t.accent : t.markMiss,
                    }}
                  />
                ))}
                {ft.a > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: FT_SPOT.x * w - dot / 2,
                      top: FT_SPOT.y * h - dot / 2,
                      width: dot,
                      height: dot,
                      borderRadius: dot / 2,
                      backgroundColor: t.danger,
                    }}
                  />
                )}
              </View>
            </View>
          )}
          {shots.length === 0 && ft.a === 0 && <Empty>NO SHOTS IN THIS SLICE</Empty>}
        </View>

        <Row gap={m.s4} justify="center" style={{ paddingVertical: m.s2, borderTopWidth: 1, borderTopColor: t.rule }}>
          <Key color={t.accent} label="MADE" />
          <Key color={t.markMiss} label="MISS" ring />
          <Key color={t.danger} label={`FREE THROWS ${ft.m}-${ft.a}`} />
        </Row>
      </Section>

      <Card>
        <Seam>
          <Tile value={`${T.fgm}-${T.fga}`} label={`FG ${pct(T.fgm, T.fga)}`} />
          <Tile value={`${T.twom}-${T.twoa}`} label={`2PT ${pct(T.twom, T.twoa)}`} />
          <Tile value={`${T.tpm}-${T.tpa}`} label={`3PT ${pct(T.tpm, T.tpa)}`} />
          <Tile value={`${T.ftm}-${T.fta}`} label={`FT ${pct(T.ftm, T.fta)}`} />
        </Seam>
      </Card>

      <View style={{ height: m.s3 }} />

      <Note>
        The chart marks shots and free throws and nothing else — a foul, a rebound and a tally
        have no spot on the floor. Every free throw is logged at the centre of the line, so the
        red dot is one dot however many were taken.
      </Note>
    </View>
  );
}
