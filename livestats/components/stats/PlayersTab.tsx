import { ScrollView, Text, View } from 'react-native';

import { mmss } from '../../lib/format';
import { efficiency, plusMinus } from '../../lib/stats';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Card, Note } from './parts';
import type { Report, Split } from '../../lib/box';
import type { Totals } from '../../lib/stats';
import type { Player } from '../../types';

/**
 * The box score, one row per player and a totals row under it.
 *
 * Twenty columns do not fit a phone and never will, so the table scrolls
 * SIDEWAYS inside the tab — the one place in this app where something does.
 * The three columns that identify the row (starter, jersey, name) are the
 * left-hand block and the numbers follow in the order a box score prints them.
 *
 * `w` is a pixel width because the columns must not size to their contents: a
 * table whose columns move as the numbers grow is unreadable at a glance, and
 * a glance is all this ever gets.
 */
const COLS: { key: string; w: number; left?: boolean }[] = [
  { key: 'GS', w: 30 },
  { key: '#', w: 34 },
  { key: 'PLAYER', w: 118, left: true },
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

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

const cellsFor = (p: Player): string[] => {
  const s = p.stats;
  return [
    p.starter ? '1' : '',
    String(p.number),
    p.name + (p.status === 'out' ? ' (out)' : ''),
    mmss(s.secondsPlayed),
    String(s.points),
    `${s.fgMade}-${s.fgAttempted}`,
    `${s.twoMade}-${s.twoAttempted}`,
    `${s.threeMade}-${s.threeAttempted}`,
    `${s.ftMade}-${s.ftAttempted}`,
    String(s.offensiveRebounds),
    String(s.defensiveRebounds),
    String(s.offensiveRebounds + s.defensiveRebounds),
    String(s.assists),
    String(s.turnovers),
    String(s.steals),
    String(s.blocks),
    String(s.fouls),
    String(s.foulsDrawn),
    signed(plusMinus(s)),
    String(efficiency(s)),
  ];
};

const totalCells = (T: Totals): string[] => [
  '',
  '',
  'TEAM',
  mmss(T.sec),
  String(T.pts),
  `${T.fgm}-${T.fga}`,
  `${T.twom}-${T.twoa}`,
  `${T.tpm}-${T.tpa}`,
  `${T.ftm}-${T.fta}`,
  String(T.oreb),
  String(T.dreb),
  String(T.reb),
  String(T.ast),
  String(T.to),
  String(T.st),
  String(T.bs),
  String(T.pf),
  String(T.fd),
  '',
  String(T.ef),
];

export function PlayersTab({ report, split }: { report: Report; split: Split }) {
  const m = useMetrics();
  const t = useTheme();

  const row = (cells: string[], key: string, opts: { dq?: boolean; total?: boolean; zebra?: boolean }) => (
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
          key={COLS[i].key}
          numberOfLines={1}
          style={{
            width: COLS[i].w,
            paddingVertical: m.s2,
            paddingHorizontal: 4,
            textAlign: COLS[i].left ? 'left' : 'right',
            fontFamily: COLS[i].left ? fUi(opts.total ? 700 : 600) : fNum(opts.total ? 700 : 500),
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
    <View>
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row', backgroundColor: t.surface2 }}>
              {COLS.map((c) => (
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
            {report.lines.map((p, i) =>
              row(cellsFor(p), p.id, { dq: p.status === 'out', zebra: i % 2 === 1 }),
            )}
            {row(totalCells(report.team), 'team', { total: true })}
          </View>
        </ScrollView>
      </Card>

      <View style={{ height: m.s3 }} />

      <Note>
        GS marks the five who started. Plus / minus counts every point either way against the
        five who were on the floor when it went up, so it is a real one and not the ON half the
        board shows mid-game. Efficiency is points, rebounds, assists, steals and blocks, minus
        missed shots, missed free throws and turnovers.
        {split === null
          ? ''
          : ' A quarter is rebuilt from the play log: minutes come from the game clock stamped on each event, so a quarter ended early credits its unplayed tail to whoever was out there.'}
      </Note>
    </View>
  );
}
