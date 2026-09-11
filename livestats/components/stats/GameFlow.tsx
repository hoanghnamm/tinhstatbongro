import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { flowOf, periodScores, stampOf, type FlowPoint } from '../../lib/flow';
import { lenOf } from '../../lib/box';
import { useMetrics } from '../../theme/metrics';
import { LS_MICRO, fNum, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Line, Section } from './parts';
import type { Split } from '../../lib/box';
import type { GameState } from '../../types';

/**
 * GAME FLOW — the margin as a step, and the quarter scores under it.
 *
 * WHEN DID THE LEAD CHANGE is the one question about a finished game that no
 * table of totals can answer, and it is the question a scorer is actually
 * asked on the way back to the car. So the chart is the margin — ours minus
 * theirs — against elapsed game time, orange while we were ahead and neutral
 * while they were.
 *
 * THE TABLE IS NOT A FALLBACK. It is printed every time, under every chart,
 * because the chart answers "when" and only the table answers "how much": a
 * step three hundred pixels wide cannot be read to the point, and the exact
 * numbers are what somebody writes down. It is also what is left when the
 * chart cannot honestly be drawn — see below.
 *
 * THE CHART IS DROPPED, NOT FAKED, IN TWO CASES. A game whose scores all carry
 * the same clock stamp has no time axis to put them on (`timed`), and a game
 * whose running total does not meet the board's own score has a chart that
 * would end on a scoreline the night never held (`reconciled`). Either way the
 * table stands alone rather than a picture being drawn out of numbers that
 * cannot support it.
 *
 * IT IS BARS, NOT A PATH. Every horizontal run of the step is one `Rect` from
 * the zero line to the margin it held, which is the same drawing a filled step
 * path would produce and needs no path arithmetic to get the sign changes
 * right — and the sign is the whole reading, because it is what the two
 * colours are for.
 */

const clamp = (lo: number, v: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

export function GameFlow({ game, split }: { game: GameState; split: Split }) {
  const m = useMetrics();
  const t = useTheme();

  const flow = useMemo(() => flowOf(game), [game]);
  const rows = useMemo(() => periodScores(game), [game]);
  const len = lenOf(game);

  const [boxW, setBoxW] = useState(0);
  const [pick, setPick] = useState<FlowPoint | null>(null);

  const draw = flow.timed && flow.reconciled;
  // the card clips and the plot sits inside its own padding, so the pad comes
  // off before anything is scaled — the same order `ZonesTab` measures in
  const w = Math.max(0, boxW - 2 * m.s3);
  const h = Math.round(clamp(104, m.win.h * 0.18, 200));

  const mid = h / 2;
  // the caps keep a maximum-margin bar off the very edge, so the top of the
  // biggest run is still visible as a top
  const half = mid - 6;
  const x = (at: number): number => (flow.end > 0 ? (at / flow.end) * w : 0);
  const y = (margin: number): number => mid - (margin / flow.span) * half;

  /** The last score at or before this pixel — a step, so it is a floor. */
  const choose = (px: number): void => {
    if (w <= 0) return;
    let found = flow.points[0];
    for (const p of flow.points) {
      if (x(p.at) <= px) found = p;
      else break;
    }
    setPick(found);
  };

  const shown = pick ?? {
    at: flow.end,
    period: game.period,
    us: flow.us,
    them: flow.them,
    margin: flow.us - flow.them,
  };
  const when = pick || !game.ended ? stampOf(shown.at, len, game.periods) : 'Final';
  const tone = shown.margin > 0 ? t.accent : shown.margin < 0 ? t.danger : t.ink2;

  return (
    <Section title="Game flow">
      {draw && (
        <View style={{ padding: m.s3 }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
          {/* THE READOUT IS ABOVE THE PLOT, not a bubble on it: a tooltip that
              follows the finger is under the finger, and this is read while the
              finger is still down. It holds the last point touched rather than
              clearing on release, so the number can be read after letting go. */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: m.s2 }}>
            <Text
              style={{
                ...fUi(500),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink2,
                fontVariant: ['tabular-nums'],
              }}
            >
              {when}
            </Text>
            <Text
              style={{
                marginLeft: 'auto',
                ...fNum(700),
                fontSize: m.fsSm,
                color: t.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {shown.us}–{shown.them}
            </Text>
            <Text
              style={{
                width: m.fsSm * 2.6,
                textAlign: 'right',
                ...fNum(700),
                fontSize: m.fsSm,
                color: tone,
                fontVariant: ['tabular-nums'],
              }}
            >
              {signed(shown.margin)}
            </Text>
          </View>

          <View
            style={{ width: '100%', height: h, marginTop: m.s2 }}
            accessibilityRole="image"
            accessibilityLabel={`Score margin over time. Biggest margin ${flow.span}. The quarter scores are listed below.`}
            // IT CLAIMS THE TOUCH ON THE WAY DOWN AND GIVES IT BACK ON A
            // SCROLL. `onMoveShouldSetResponder` is deliberately absent: it
            // grabs a gesture already under way, which on a scrolling tab means
            // a drag past the chart scrubs it instead of scrolling the page.
            // Claiming on start and answering the termination request keeps a
            // tap for the chart and a swipe for the ScrollView.
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderGrant={(e) => choose(e.nativeEvent.locationX)}
            onResponderMove={(e) => choose(e.nativeEvent.locationX)}
          >
            {w > 0 && (
              <Svg width={w} height={h}>
                {/* the runs, each held from its own score to the next */}
                {flow.points.map((p, i) => {
                  const to = i + 1 < flow.points.length ? flow.points[i + 1].at : flow.end;
                  const a = x(p.at);
                  const b = Math.max(a + 1, x(to));
                  if (p.margin === 0) return null;
                  const top = Math.min(y(p.margin), mid);
                  return (
                    <Rect
                      key={p.at + ':' + i}
                      x={a}
                      y={top}
                      width={b - a}
                      height={Math.max(1, Math.abs(y(p.margin) - mid))}
                      fill={withAlpha(p.margin > 0 ? t.accent : t.ink2, 0.5)}
                    />
                  );
                })}

                {/* the buzzers */}
                {flow.bounds.map((b) => (
                  <Rect key={b} x={x(b)} y={0} width={1} height={h} fill={t.rule} />
                ))}

                {/* level, which is the line every reading is taken against */}
                <Rect x={0} y={mid} width={w} height={1} fill={t.ink3} />

                {/* the axis, signed at both ends — a bar below the line is a
                    deficit and the minus is what says so */}
                <SvgText x={2} y={m.fs2xs + 1} fontSize={m.fs2xs} fill={t.ink3}>
                  {`+${flow.span}`}
                </SvgText>
                <SvgText x={2} y={h - 2} fontSize={m.fs2xs} fill={t.ink3}>
                  {`−${flow.span}`}
                </SvgText>

                {pick && <Rect x={x(pick.at)} y={0} width={1} height={h} fill={t.ink2} />}
              </Svg>
            )}
          </View>
        </View>
      )}

      <Line head label="" value="Us" sub="Them" />
      {rows.map((r) => (
        <Line
          key={r.period}
          // the word rides IN the label: a period still being played is not a
          // final row and the row itself has to say so
          label={r.live ? `${r.label} · in progress` : r.label}
          value={r.us}
          sub={String(r.them)}
          strong={split === r.period}
        />
      ))}
    </Section>
  );
}
