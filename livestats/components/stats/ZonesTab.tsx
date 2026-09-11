import { useState } from 'react';
import { Text, View } from 'react-native';

import { ZONE_LABEL } from '../../constants/game';
import { zoneRows } from '../../lib/box';
import { FT_SPOT } from '../../lib/court';
import { pct } from '../../lib/format';
import { useDots } from '../../hooks/useDots';
import { COURT_ASPECT, useMetrics } from '../../theme/metrics';
import { LS_MICRO, fNum, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { CourtSvg } from '../board/CourtSvg';
import { Row } from '../ui/Row';
import { Card, Empty, Key, Seam, Section, Tile } from './parts';
import type { Report, ShotMark } from '../../lib/box';
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
  // the same three marks the board's own court draws — one hook, so the two
  // charts cannot disagree about what a make looks like
  const dots = useDots();
  const [boxW, setBoxW] = useState(0);

  const rows = zoneRows(report.zones);
  const T = report.team;
  // THE SHARE'S DENOMINATOR IS THE ZONES' OWN TOTAL, not `T.fga`: a shot
  // logged before the floor could name a zone has no row to sit in, and
  // dividing by a total that includes it would leave seven bars that never
  // reach a hundred per cent between them.
  const att = rows.reduce((n, r) => n + r.a, 0);
  // `layout.width` is the OUTER width, padding included, and the card clips —
  // so the pad comes off before the aspect lock, not after it. ONE width for
  // both courts: they are the same floor, and a step between them would read
  // as two different ones.
  const w = Math.min(Math.max(0, boxW - 2 * m.s2), m.win.h * 0.66 * COURT_ASPECT);
  const h = w / COURT_ASPECT;
  const dot = m.chartDot;

  const heat = rows.reduce<Partial<Record<Zone, string>>>((acc, r) => {
    const c = heatOf(t.accent, r.m, r.a);
    if (c) acc[r.zone] = c;
    return acc;
  }, {});

  return (
    <View>
      {/* ── The marks ── the same grammar the board's own chart uses, because
          it IS the same chart, down to the hook that resolves the three hues:
          a made shot, a miss, and ONE dot on the line for the free throws
          however many were taken, since every one is logged at the same
          coordinate. The colours are the scorer's — see `useDots`. */}
      <Section title="The floor">
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
                      backgroundColor: s.made ? dots.made : dots.miss,
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
                      backgroundColor: dots.ft,
                    }}
                  />
                )}
              </View>
            </View>
          )}
          {shots.length === 0 && ft.a === 0 && <Empty>No shots in this slice</Empty>}
        </View>

        <Row
          gap={m.s4}
          justify="center"
          style={{ paddingVertical: m.s2, borderTopWidth: 1, borderTopColor: t.rule }}
        >
          <Key color={dots.made} label="Made" />
          <Key color={dots.miss} label="Miss" ring />
          <Key color={dots.ft} label={`Free throws ${ft.m}-${ft.a}`} />
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
      <Section title="By zone">
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
              ...fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
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
              ...fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.ink2,
            }}
          >
            100%
          </Text>
        </Row>
      </Section>

      {/* ── Where the attempts went ── the same seven buckets as the heat
          above, read as VOLUME rather than as conversion. The two answer
          different questions and the court can only draw one of them: a zone
          shot twice and made twice is the brightest patch on the floor and is
          not where the offence lives. The bar is the share of field-goal
          attempts, the numbers beside it are the conversion, and the ORDER IS
          FIXED — the same seven rows in the same places whichever slice is
          selected, so a quarter can be compared with the game by looking at
          one place twice. Nothing is ranked and no zone is nominated: a 3-for-4
          corner is not a strength, and a list sorted by percentage would say it
          was. */}
      <Section title="Where we shot from">
        <ZoneRow head label="Zone" share={0} made="M-A" pctText="Pct" />
        {rows.map((r) => (
          <ZoneRow
            key={r.zone}
            label={ZONE_LABEL[r.zone]}
            share={att ? r.a / att : 0}
            made={`${r.m}-${r.a}`}
            pctText={pct(r.m, r.a)}
            dim={r.a === 0}
          />
        ))}
      </Section>
    </View>
  );
}

/**
 * One zone: its name, how much of the shooting it took, and how it went.
 *
 * It is not `Line` because `Line` has three columns and this has four, and the
 * fourth is a bar — the one place on these screens where a number is drawn as
 * a length rather than printed. The head row is this same component so the
 * four widths cannot drift, which is the argument `Line`'s own `head` makes.
 */
function ZoneRow({
  label,
  share,
  made,
  pctText,
  head = false,
  dim = false,
}: {
  label: string;
  /** 0–1 of the slice's field-goal attempts */
  share: number;
  made: string;
  pctText: string;
  head?: boolean;
  dim?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();
  const fs = m.fsSm;
  const barW = fs * 4.6;
  const barH = Math.max(4, Math.round(fs * 0.5));

  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        borderTopWidth: head ? 0 : 1,
        borderTopColor: t.rule,
        borderBottomWidth: head ? 1 : 0,
        borderBottomColor: t.rule,
        backgroundColor: head ? t.surface2 : t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          ...(head ? fUi(500) : fUi(400)),
          fontSize: head ? m.fsXs : fs,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: head ? t.ink2 : dim ? t.ink3 : t.ink,
        }}
      >
        {label}
      </Text>

      {head ? (
        <Text
          numberOfLines={1}
          style={{
            width: barW,
            flexGrow: 0,
            flexShrink: 0,
            ...fUi(500),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink2,
          }}
        >
          Share
        </Text>
      ) : (
        <View
          style={{
            width: barW,
            height: barH,
            flexGrow: 0,
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: t.rule,
          }}
        >
          {/* a zone that was shot from at all keeps a sliver, so "a little"
              and "none" are never the same picture */}
          {share > 0 && (
            <View
              style={{
                width: Math.max(2, Math.round(barW * share)),
                height: barH,
                backgroundColor: t.accent,
              }}
            />
          )}
        </View>
      )}

      <Text
        numberOfLines={1}
        style={{
          width: fs * 3.4,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...(head ? fNum(500) : fNum(700)),
          fontSize: head ? m.fsXs : m.fsSm,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: head ? t.ink2 : dim ? t.ink3 : t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {made}
      </Text>

      {/* 3.1em AND NOT 2.6: `100%` is 2.96em of Inter, whose percent sign is a
          full em on its own, so a zone shot perfectly printed `100…` on every
          device this app runs on. The zone names are short — `Corner 3` is the
          longest of the seven — so the label column pays for it and nothing
          else moves. `npm run check` holds the width to the string now. */}
      <Text
        numberOfLines={1}
        style={{
          width: fs * 3.1,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(500),
          fontSize: head ? m.fsXs : m.fsSm,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: head ? t.ink2 : t.ink2,
          fontVariant: ['tabular-nums'],
        }}
      >
        {pctText}
      </Text>
    </Row>
  );
}
