import { useState } from 'react';
import { Text, View } from 'react-native';

import { ZONE_LABEL } from '../../constants/game';
import { zoneRows } from '../../lib/box';
import { pct } from '../../lib/format';
import { COURT_ASPECT, useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { CourtSvg } from '../board/CourtSvg';
import { Row } from '../ui/Row';
import { Card, Line, Note, Section } from './parts';
import type { Report } from '../../lib/box';
import type { Zone } from '../../types';

/** The five steps the scale is read in — 0%, 25%, 50%, 75%, 100%. */
const SCALE = [0, 0.25, 0.5, 0.75, 1];

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
 * The advanced view: every zone the floor is cut into, how many went up there
 * and how many went down.
 *
 * The court is the SAME eleven paths the board lights one of — `CourtSvg`
 * takes a fill per zone rather than this file carrying a second copy of the
 * partition, which is the one thing `lib/court.ts` and that component exist to
 * prevent.
 *
 * The numbers live in the table under the floor rather than on it. Labels on
 * the court were the obvious thing and they do not survive contact with a
 * phone: the two corner threes are a 68-unit strip out of 792, so a pill with
 * `4-9  44%` in it is wider than the zone it names.
 */
export function ZonesTab({ report }: { report: Report }) {
  const m = useMetrics();
  const t = useTheme();
  const [boxW, setBoxW] = useState(0);

  const rows = zoneRows(report.zones);
  const T = report.team;
  // `layout.width` is the OUTER width, padding included, and the card clips —
  // so the pad comes off before the aspect lock, not after it
  const w = Math.min(Math.max(0, boxW - 2 * m.s2), m.win.h * 0.66 * COURT_ASPECT);
  const h = w / COURT_ASPECT;

  const heat = rows.reduce<Partial<Record<Zone, string>>>((acc, r) => {
    const c = heatOf(t.accent, r.m, r.a);
    if (c) acc[r.zone] = c;
    return acc;
  }, {});

  const taken = rows.reduce((n, r) => n + r.a, 0);

  return (
    <View>
      <Section title="BY ZONE" note={`${taken} field goal attempts`}>
        <View
          onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
          style={{ alignItems: 'center', padding: m.s2 }}
        >
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
        <Line label="2 points" value={`${T.twom}-${T.twoa}`} sub={pct(T.twom, T.twoa)} strong />
        <Line label="3 points" value={`${T.tpm}-${T.tpa}`} sub={pct(T.tpm, T.tpa)} strong />
        <Line label="Field goals" value={`${T.fgm}-${T.fga}`} sub={pct(T.fgm, T.fga)} strong />
      </Card>

      <View style={{ height: m.s3 }} />

      <Note>
        A zone is one bucket however many regions draw it, so the left and right corners are one
        line here and both halves of the floor take the same colour. Free throws are in none of
        them: a free throw is not a field-goal attempt, so counting it in a zone would be a
        wrong attempt in every split on this page.
      </Note>
    </View>
  );
}
