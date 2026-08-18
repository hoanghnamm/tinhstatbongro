import { ScrollView, Text, View } from 'react-native';

import { mmss } from '../../lib/format';
import { efficiency, plusMinus } from '../../lib/stats';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Card } from './parts';
import type { Totals } from '../../lib/stats';
import type { Player } from '../../types';

/**
 * THE BOX SCORE TABLE — one row per player, a totals row under it.
 *
 * There is one of these and there are three callers: a game, a quarter of a
 * game, and a whole season. All three are the same twenty columns over the
 * same `Player[]`, which is exactly why the season aggregate is built as
 * `Player`s rather than as a shape of its own.
 *
 * Twenty columns do not fit a phone and never will, so the table scrolls
 * SIDEWAYS — the one place in this app where something does. The three columns
 * that identify the row (starter, jersey, name) are the left-hand block and the
 * numbers follow in the order a box score prints them.
 *
 * `w` is a pixel width because the columns must not size to their contents: a
 * table whose columns move as the numbers grow is unreadable at a glance, and a
 * glance is all this ever gets.
 *
 * `gamesFor` inserts one extra column, G, and only the season ever passes it —
 * a per-game average is meaningless without the denominator beside it, and a
 * single game has no denominator to show.
 */
interface Col {
  key: string;
  w: number;
  left?: boolean;
}

const BASE: Col[] = [
  { key: 'GS', w: 30 },
  { key: '#', w: 34 },
  { key: 'PLAYER', w: 118, left: true },
];

const REST: Col[] = [
  { key: 'MIN', w: 54 },
  { key: 'PTS', w: 44 },
  { key: 'FG', w: 56 },
  { key: '2P', w: 56 },
  { key: '3P', w: 56 },
  { key: 'FT', w: 56 },
  { key: 'OR', w: 38 },
  { key: 'DR', w: 38 },
  { key: 'TOT', w: 42 },
  { key: 'AS', w: 38 },
  { key: 'TO', w: 38 },
  { key: 'ST', w: 38 },
  { key: 'BS', w: 38 },
  { key: 'PF', w: 38 },
  { key: 'FD', w: 38 },
  { key: '+/-', w: 46 },
  { key: 'EF', w: 40 },
];

const G_COL: Col = { key: 'G', w: 34 };

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Whole numbers stay whole; a per-game average keeps its one decimal. */
const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const pair = (m: number, a: number): string => `${num(m)}-${num(a)}`;

const statCells = (p: Player): string[] => {
  const s = p.stats;
  return [
    mmss(s.secondsPlayed),
    num(s.points),
    pair(s.fgMade, s.fgAttempted),
    pair(s.twoMade, s.twoAttempted),
    pair(s.threeMade, s.threeAttempted),
    pair(s.ftMade, s.ftAttempted),
    num(s.offensiveRebounds),
    num(s.defensiveRebounds),
    num(s.offensiveRebounds + s.defensiveRebounds),
    num(s.assists),
    num(s.turnovers),
    num(s.steals),
    num(s.blocks),
    num(s.fouls),
    num(s.foulsDrawn),
    signed(Math.round(plusMinus(s) * 10) / 10),
    num(Math.round(efficiency(s) * 10) / 10),
  ];
};

const totalCells = (T: Totals): string[] => [
  mmss(T.sec),
  num(T.pts),
  pair(T.fgm, T.fga),
  pair(T.twom, T.twoa),
  pair(T.tpm, T.tpa),
  pair(T.ftm, T.fta),
  num(T.oreb),
  num(T.dreb),
  num(T.reb),
  num(T.ast),
  num(T.to),
  num(T.st),
  num(T.bs),
  num(T.pf),
  num(T.fd),
  '',
  num(Math.round(T.ef * 10) / 10),
];

export function BoxTable({
  lines,
  team,
  gamesFor,
}: {
  lines: Player[];
  team: Totals;
  gamesFor?: (p: Player) => number;
}) {
  const m = useMetrics();
  const t = useTheme();

  const cols: Col[] = gamesFor ? [...BASE, G_COL, ...REST] : [...BASE, ...REST];

  const row = (
    cells: string[],
    key: string,
    opts: { dq?: boolean; total?: boolean; zebra?: boolean },
  ) => (
    <View
      key={key}
      style={{
        flexDirection: 'row',
        borderTopWidth: opts.total ? 2 : 1,
        borderTopColor: opts.total ? t.ink : t.rule,
        backgroundColor: opts.total || opts.zebra ? t.surface2 : t.surface,
      }}
    >
      {cells.map((v, i) => (
        <Text
          key={cols[i].key}
          numberOfLines={1}
          style={{
            width: cols[i].w,
            paddingVertical: m.s2,
            paddingHorizontal: 4,
            textAlign: cols[i].left ? 'left' : 'right',
            fontFamily: cols[i].left ? fUi(opts.total ? 700 : 600) : fNum(opts.total ? 700 : 500),
            fontSize: m.fsSm,
            color: opts.dq ? t.danger : i === 0 ? t.ink2 : t.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {v}
        </Text>
      ))}
    </View>
  );

  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface2 }}>
            {cols.map((c) => (
              <Text
                key={c.key}
                numberOfLines={1}
                style={{
                  width: c.w,
                  paddingVertical: m.s2,
                  paddingHorizontal: 4,
                  textAlign: c.left ? 'left' : 'right',
                  fontFamily: fNum(500),
                  fontSize: m.fsXs,
                  letterSpacing: ls(m.fsXs, LS_LABEL),
                  color: t.ink2,
                }}
              >
                {c.key}
              </Text>
            ))}
          </View>

          {lines.map((p, i) =>
            row(
              [
                p.starter ? '1' : '',
                String(p.number),
                p.name + (p.status === 'out' ? ' (out)' : ''),
                ...(gamesFor ? [String(gamesFor(p))] : []),
                ...statCells(p),
              ],
              p.id,
              { dq: p.status === 'out', zebra: i % 2 === 1 },
            ),
          )}

          {row(
            ['', '', 'TEAM', ...(gamesFor ? [''] : []), ...totalCells(team)],
            'team',
            { total: true },
          )}
        </View>
      </ScrollView>
    </Card>
  );
}
