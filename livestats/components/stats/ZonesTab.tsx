import { useState } from 'react';
import { Text, View } from 'react-native';

import { ZONE_LABEL } from '../../constants/game';
import { zoneRows } from '../../lib/box';
import { FT_SPOT } from '../../lib/court';
import { pct } from '../../lib/format';
import { COURT_ASPECT, useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { CourtSvg } from '../board/CourtSvg';
import { Row } from '../ui/Row';
import { Card, Empty, Key, Line, Seam, Section, Tile } from './parts';
import type { Report, ShotMark } from '../../lib/box';
import type { Zone } from '../../types';

/** The five steps the scale is read in — 0%, 25%, 50%, 75%, 100%. */
const SCALE = [0, 0.25, 0.5, 0.75, 1];

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * How hard a zone is painted. Opacity carries the percentage, and it starts
 * ABOVE zero on purpose: a zone shot five times and missed five times is not
 * the same thing as a zone never shot from, and a floor of 0.18 is what keeps
 * those two apart. Volume is the table's job, not the fill's — two variables
 * in one colour is a chart nobody can read back.
 */
const heatOf = (accent: string, made: number, attempts: number): string | undefined =>
  attempts === 0 ? undefined : withAlpha(accent, 0.18 + 0.52 * (made / attempts));

/**
 * ZONES — everything the FLOOR says, on one tab.
 *
 * IT WAS TWO TABS AND IS ONE, and the merge is the point: SHOTS drew the marks
 * and ZONES drew the buckets those same marks fall into, so a scorer comparing
 * "where did they shoot from" against "how did they shoot from there" was
 * flipping between two tabs to read one answer. Same slice, same court, same
 * width — the two now scroll past each other.
 *
 * Four blocks, coarse to fine: the marks, the shooting line, the heat, the
 * table. The splits tiles are the join between them — they used to sit under
 * the shot chart and they carry FT, which no zone does, so the zone table's own
 * 2PT / 3PT / FG footer went instead of being printed a second screen away.
 *
 * Both courts are sized here rather than off `m.court`: that metric is the
 * BOARD's court, which is what is left after the rail and the two action
 * columns are subtracted, and this screen has none of them. So the box is
 * measured, then aspect-locked, then capped against the window height so a
 * phone laid down does not hand one chart the whole viewport.
 *
 * The zone court is the SAME eleven paths the board lights one of — `CourtSvg`
 * takes a fill per zone rather than this file carrying a second copy of the
 * partition, which is the one thing `lib/court.ts` and that component exist to
 * prevent. And the numbers live in the table under it rather than on it:
 * labels on the court were the obvious thing and they do not survive contact
 * with a phone, since the two corner threes are a 68-unit strip out of 792 and
 * a pill with `4-9  44%` in it is wider than the zone it names.
 */
export function ZonesTab({
  report,
  shots,
  ft,
}: {
  report: Report;
  shots: ShotMark[];
  ft: { m: number; a: number };
}) {
  const m = useMetrics();
  const t = useTheme();
  const [boxW, setBoxW] = useState(0);

  const rows = zoneRows(report.zones);
  const T = report.team;
  // `layout.width` is the OUTER width, padding included, and the card clips —
  // so the pad comes off before the aspect lock, not after it. ONE width for
  // both courts: they are the same floor, and a step between them would read
  // as two different ones.
  const w = Math.min(Math.max(0, boxW - 2 * m.s2), m.win.h * 0.66 * COURT_ASPECT);
  const h = w / COURT_ASPECT;
  const dot = clamp(7, 0.017 * m.win.h, 16);

  const heat = rows.reduce<Partial<Record<Zone, string>>>((acc, r) => {
    const c = heatOf(t.accent, r.m, r.a);
    if (c) acc[r.zone] = c;
    return acc;
  }, {});

  return (
    <View>
      {/* ── The marks ── the same grammar the board's own chart uses, because
          it IS the same chart: a made shot is `accent`, a miss is `markMiss`,
          and the free throws are one red dot on the line however many were
          taken, since every one of them is logged at the same coordinate. */}
      <Section title="THE FLOOR">
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

        <Row
          gap={m.s4}
          justify="center"
          style={{ paddingVertical: m.s2, borderTopWidth: 1, borderTopColor: t.rule }}
        >
          <Key color={t.accent} label="MADE" />
          <Key color={t.markMiss} label="MISS" ring />
          <Key color={t.danger} label={`FREE THROWS ${ft.m}-${ft.a}`} />
        </Row>
      </Section>

      {/* ── The shooting line ── the one block on this tab that counts a free
          throw, which is why it survived the merge and the table's footer did
          not */}
      <Card>
        <Seam>
          <Tile value={`${T.fgm}-${T.fga}`} label={`FG ${pct(T.fgm, T.fga)}`} />
          <Tile value={`${T.twom}-${T.twoa}`} label={`2PT ${pct(T.twom, T.twoa)}`} />
          <Tile value={`${T.tpm}-${T.tpa}`} label={`3PT ${pct(T.tpm, T.tpa)}`} />
          <Tile value={`${T.ftm}-${T.fta}`} label={`FT ${pct(T.ftm, T.fta)}`} />
        </Seam>
      </Card>

      {/* ── The heat ── the same marks as above, bucketed ── */}
      <Section title="BY ZONE">
        <View style={{ alignItems: 'center', padding: m.s2 }}>
          {w > 0 && (
            <View style={{ width: w, height: h, borderRadius: m.rSm, overflow: 'hidden' }}>
              <CourtSvg zone={null} side={null} heat={heat} />
            </View>
          )}
        </View>

        <Row
          gap={m.s2}
          justify="center"
          style={{ paddingVertical: m.s2, borderTopWidth: 1, borderTopColor: t.rule }}
        >
          <Text
            style={{
              fontFamily: fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_LABEL),
              color: t.ink2,
            }}
          >
            0%
          </Text>
          {SCALE.map((s) => (
            <View
              key={s}
              style={{
                width: Math.round(m.fsSm * 1.6),
                height: Math.round(m.fsSm * 0.9),
                flexGrow: 0,
                flexShrink: 0,
                borderRadius: 2,
                backgroundColor: withAlpha(t.accent, 0.18 + 0.52 * s),
              }}
            />
          ))}
          <Text
            style={{
              fontFamily: fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_LABEL),
              color: t.ink2,
            }}
          >
            100%
          </Text>
        </Row>
      </Section>

      <Card>
        <Line head label="ZONE" value="M-A" sub="PCT" />
        {rows.map((r) => (
          <Line
            key={r.zone}
            label={ZONE_LABEL[r.zone]}
            value={`${r.m}-${r.a}`}
            sub={pct(r.m, r.a)}
            tone={r.a === 0 ? t.ink3 : undefined}
          />
        ))}
      </Card>
    </View>
  );
}
