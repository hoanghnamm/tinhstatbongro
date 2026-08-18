import { ScrollView, Text, View } from 'react-native';

import { ZONES, ZONE_LABEL } from '../../constants/game';
import { mmss, pct } from '../../lib/format';
import { efg, ptsOffSteals, totals, ts, zoneSplits } from '../../lib/stats';
import { useMetrics } from '../../theme/metrics';
import { fNum, fUi } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Note, PTitle } from './shell';
import type { GameState, Player } from '../../types';

/** Player-table columns, in order. `w` is a share of the row, not a pixel size. */
const COLS: { key: string; w: number }[] = [
  { key: 'GS', w: 34 },
  { key: '#', w: 34 },
  { key: 'Player', w: 120 },
  { key: 'MIN', w: 58 },
  { key: 'PTS', w: 46 },
  { key: 'FG', w: 58 },
  { key: '3PT', w: 58 },
  { key: 'FT', w: 58 },
  { key: 'REB', w: 46 },
  { key: 'AST', w: 46 },
  { key: 'STL', w: 46 },
  { key: 'BLK', w: 46 },
  { key: 'TO', w: 46 },
  { key: 'FD', w: 46 },
  { key: 'PF', w: 46 },
  { key: 'T/F', w: 46 },
  { key: 'ON', w: 46 },
];

const cells = (p: Player): string[] => {
  const s = p.stats;
  return [
    p.starter ? '1' : '',
    String(p.number),
    p.name + (p.status === 'out' ? ' (out)' : ''),
    mmss(s.secondsPlayed),
    String(s.points),
    `${s.fgMade}-${s.fgAttempted}`,
    `${s.threeMade}-${s.threeAttempted}`,
    `${s.ftMade}-${s.ftAttempted}`,
    String(s.offensiveRebounds + s.defensiveRebounds),
    String(s.assists),
    String(s.steals),
    String(s.blocks),
    String(s.turnovers),
    String(s.foulsDrawn),
    String(s.fouls),
    s.technicals + s.flagrants ? String(s.technicals + s.flagrants) : '',
    String(s.onCourtPoints),
  ];
};

/**
 * The box score, as a GLANCE — the whole game, no quarter split, no charts.
 *
 * It takes a `GameState` rather than reading the store, and that is the whole
 * reason it is its own file: the mid-game panel feeds it the live game and the
 * saved-game screen feeds it one off disk, and they are the same table over the
 * same shape. There is exactly one of these, and the second one is the one that
 * would drift.
 *
 * ON is deliberately the "for" half only: team points scored while the player
 * was on the floor, which is the number a scorer actually checks mid-game. The
 * real +/- is on the stats screen; a signed number is a thing you read after
 * the buzzer, not between possessions.
 *
 * PTS OFF STEALS is still partial: it reads the event log, so it can run high
 * if an opponent rebound goes unlogged. Do not relabel it "points off
 * turnovers" — a steal is the only opponent turnover this board hears about.
 */
export function BoxScore({ g }: { g: GameState }) {
  const m = useMetrics();
  const t = useTheme();

  const T = totals(g.players);
  const Z = zoneSplits(g.events);

  const tile = (value: string, label: string) => (
    <View
      key={label}
      style={{
        flex: 1, minWidth: 0, gap: 2, padding: m.sp,
        backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: m.r,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: fNum(700), fontSize: m.fs2xl, color: t.ink, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text style={{ fontFamily: fUi(600), fontSize: m.fsXs, letterSpacing: m.fsXs * 0.06, color: t.ink2 }}>
        {label}
      </Text>
    </View>
  );

  const sub = (label: string) => (
    <Text
      style={{
        fontFamily: fNum(700), fontSize: m.fsSm, color: t.ink2,
        letterSpacing: m.fsSm * 0.08, marginBottom: m.sp,
      }}
    >
      {label}
    </Text>
  );

  const line = (name: string, a: string, b: string, total = false) => (
    <View
      key={name}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: m.sp * 0.9,
        borderTopWidth: total ? 2 : 0, borderTopColor: t.ink,
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fUi(600), fontSize: m.fsMd, color: t.ink }}>
        {name}
      </Text>
      <Text style={{ width: 72, textAlign: 'right', fontFamily: fNum(500), fontSize: m.fsMd, color: t.ink }}>
        {a}
      </Text>
      <Text style={{ width: 76, textAlign: 'right', fontFamily: fNum(500), fontSize: m.fsMd, color: t.ink2 }}>
        {b}
      </Text>
    </View>
  );

  return (
    <>
      <PTitle
        title={g.ended ? 'Final box score' : g.team.name.toUpperCase()}
        kind={`${g.score} - ${g.oppScore}`}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: m.sp, marginBottom: m.spLg }}>
        {[
          tile(String(T.pts), 'POINTS'),
          tile(efg(T), 'EFFECTIVE FG'),
          tile(ts(T), 'TRUE SHOOTING'),
          tile(String(ptsOffSteals(g.events)), 'PTS OFF STEALS'),
        ]}
      </View>

      <View
        style={{
          flexDirection: m.compact || m.portrait ? 'column' : 'row',
          gap: m.spLg,
          marginBottom: m.spLg,
        }}
      >
        <View style={{ flex: 1 }}>
          {sub('SHOOTING')}
          {line('Field goals', `${T.fgm}-${T.fga}`, pct(T.fgm, T.fga))}
          {line('Three pointers', `${T.tpm}-${T.tpa}`, pct(T.tpm, T.tpa))}
          {line('Free throws', `${T.ftm}-${T.fta}`, pct(T.ftm, T.fta))}
          {line('Rebounds', String(T.reb), `${T.oreb} off`)}
          {line(
            'Assists / turnovers',
            `${T.ast}-${T.to}`,
            T.to ? (T.ast / T.to).toFixed(2) : '-',
            true,
          )}
        </View>
        <View style={{ flex: 1 }}>
          {sub('BY ZONE')}
          {ZONES.map((k) => line(ZONE_LABEL[k], `${Z[k].m}-${Z[k].a}`, pct(Z[k].m, Z[k].a)))}
          {line('Fouls', String(T.pf), `${T.tf} tech, ${T.fl} flag`, true)}
        </View>
      </View>

      {sub('PLAYERS')}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: t.line }}>
            {COLS.map((c, i) => (
              <Text
                key={c.key}
                numberOfLines={1}
                style={{
                  width: c.w, paddingVertical: m.sp * 0.8, paddingHorizontal: 4,
                  textAlign: i === 2 ? 'left' : 'right',
                  fontFamily: fUi(600), fontSize: m.fsXs, color: t.ink2,
                }}
              >
                {c.key}
              </Text>
            ))}
          </View>
          {g.players.map((p, r) => {
            const dq = p.status === 'out';
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  backgroundColor: r % 2 === 1 ? t.surface2 : 'transparent',
                }}
              >
                {cells(p).map((v, i) => (
                  <Text
                    key={i}
                    numberOfLines={1}
                    style={{
                      width: COLS[i].w, paddingVertical: m.sp * 0.9, paddingHorizontal: 4,
                      textAlign: i === 2 ? 'left' : 'right',
                      fontFamily: fNum(i === 2 ? 600 : 500), fontSize: m.fsMd,
                      color: dq ? t.danger : i === 0 ? t.ink2 : t.ink,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {v}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Note>
        ON is team points scored while the player was on the court. A full plus minus needs to know
        who was on the floor for each opponent basket, which this board does not track.
      </Note>
    </>
  );
}
