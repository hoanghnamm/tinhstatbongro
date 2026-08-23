import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useDots } from '../../hooks/useDots';
import { FT_SPOT } from '../../lib/court';
import { mmss, pct } from '../../lib/format';
import { appeared } from '../../lib/season';
import { efficiency, plusMinus } from '../../lib/stats';
import { opponentLabel } from '../../lib/team';
import { COURT_ASPECT, useMetrics } from '../../theme/metrics';
import { LS_LABEL, LS_MICRO, LS_TIGHT, LS_TITLE, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { CourtSvg } from '../../components/board/CourtSvg';
import { Bloom } from '../../components/ui/Bloom';
import { DarkRoom } from '../../components/ui/DarkRoom';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { Card, Key, Line, Note, Section, Seam, Tile } from '../../components/stats/parts';
import { useRosterStore } from '../../store/rosterStore';
import type { GameState, Player, PlayerStats } from '../../types';

/** tiny helper — opponent label with fallback */
const oppLabel = (s: string): string => (s ? opponentLabel(s) : 'Opponent');

/** Shot mark for per-player chart */
interface Mark { id: string; x: number; y: number; made: boolean; }

/** Per-game line for the game log table */
interface GameLine {
  gameId: string;
  opponent: string;
  stats: PlayerStats;
}

interface ColDef {
  key: string;
  w: number;
  left?: boolean;
}

const GAME_LOG_COLS: ColDef[] = [
  { key: 'vs', w: 110, left: true },
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

/** Whole numbers stay whole; a per-game average keeps its one decimal. */
const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const pair = (m: number, a: number): string => `${num(m)}-${num(a)}`;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * PLAYER PROFILE — season view for one player.
 *
 * Shows:
 *   - Header with jersey, name, GP
 *   - Headline tiles: PPG · RPG · APG · FG% · 3P%
 *   - Shot chart: view by TOTAL or by specific GAME
 *   - Game log: full horizontally scrollable table (no DATE / RESULT)
 *   - Season stats card: SHOOTING + REBOUNDS & BALL sections
 */
/**
 * IT IS DARK, WITH THE FOUR ROOMS, and it is not one of them.
 *
 * A player's own season is reached from the STATS tab's table and is the same
 * kind of reading: a line you sit down with, never a thing anybody looks at
 * mid-possession. So it wears `DarkRoom` and the same `<Bloom />` as the room
 * it was opened from, and it stays outside the tab group because it is a page
 * with a back arrow rather than a fifth room.
 *
 * THE SHOT CHART FOLLOWED ON ITS OWN, which is the part worth noting: the court
 * is `t.court` over `t.courtLine` and both are palette entries, so `CourtSvg`
 * draws a dark floor here with no branch of its own — and the marks keep their
 * grammar through `useDots`, the same hook the board's court and the ZONES tab
 * read: a make, a miss, and one dot on the free-throw spot.
 */
function PlayerProfileScreen() {
  const m = useMetrics();
  const t = useTheme();
  const dots = useDots();
  const safe = useSafeAreaInsets();

  const { id, games: gamesJson } = useLocalSearchParams<{ id: string; games: string }>();
  const roster = useRosterStore((s) => s.players);

  const [chartW, setChartW] = useState(0);
  const [selectedGameId, setSelectedGameId] = useState<string>('total');

  // Decode games passed from season screen
  const allGames = useMemo<GameState[]>(() => {
    try { return JSON.parse(gamesJson ?? '[]') as GameState[]; }
    catch { return []; }
  }, [gamesJson]);

  // Current roster entry for display name/number/position
  const rosterEntry = roster.find((r) => r.id === id);

  // All games where this player appeared
  const playerGames = useMemo(
    () => allGames.filter((g) => g.players.some((p) => p.id === id && appeared(p))),
    [allGames, id],
  );

  // The player's stat line from each game
  const getPlayer = (g: GameState): Player | undefined => g.players.find((p) => p.id === id);

  // Season totals for this player
  const seasonStats = useMemo(() => {
    const zero = {
      pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, twom: 0, twoa: 0,
      ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, to: 0, st: 0, bs: 0,
      pf: 0, fd: 0, sec: 0, pm: 0,
    };
    for (const g of playerGames) {
      const p = getPlayer(g);
      if (!p) continue;
      const s = p.stats;
      zero.pts += s.points;
      zero.fgm += s.fgMade;
      zero.fga += s.fgAttempted;
      zero.tpm += s.threeMade;
      zero.tpa += s.threeAttempted;
      zero.twom += s.twoMade;
      zero.twoa += s.twoAttempted;
      zero.ftm += s.ftMade;
      zero.fta += s.ftAttempted;
      zero.oreb += s.offensiveRebounds;
      zero.dreb += s.defensiveRebounds;
      zero.ast += s.assists;
      zero.to += s.turnovers;
      zero.st += s.steals;
      zero.bs += s.blocks;
      zero.pf += s.fouls;
      zero.fd += s.foulsDrawn;
      zero.sec += s.secondsPlayed;
      zero.pm += plusMinus(s);
    }
    return zero;
  }, [playerGames, id]);

  const gp = playerGames.length;
  const per = (n: number) => (gp ? Math.round((n / gp) * 10) / 10 : 0);
  const pctStr = (m: number, a: number) => pct(m, a);

  // Per-game log entries
  const gameLines = useMemo<GameLine[]>(() => {
    return playerGames.map((g, idx) => {
      const p = getPlayer(g)!;
      const endedAt = g.events.length ? g.events[g.events.length - 1].timestamp : 0;
      const gameId = endedAt ? `${endedAt}-${idx}` : `g-${idx}`;
      return {
        gameId,
        opponent: g.opponent,
        stats: p.stats,
      };
    }).reverse(); // newest first
  }, [playerGames, id]);

  // Filtered games for shot chart (either all games or the single selected game)
  const chartGames = useMemo(() => {
    if (selectedGameId === 'total') return playerGames;
    const index = parseInt(selectedGameId.replace('game-', ''), 10);
    if (!isNaN(index) && playerGames[index]) return [playerGames[index]];
    return playerGames;
  }, [selectedGameId, playerGames]);

  // Shot marks for the selected filter (TOTAL or single game)
  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [];
    for (const g of chartGames) {
      for (const e of g.events) {
        if (e.type === 'shot' && e.playerId === id) {
          out.push({ id: e.id, x: e.position.x, y: e.position.y, made: e.result === 'made' });
        }
      }
    }
    return out;
  }, [chartGames, id]);

  // FT count for the selected filter
  const ftTotal = useMemo(() => {
    let m2 = 0, a = 0;
    for (const g of chartGames) {
      for (const e of g.events) {
        if (e.type === 'freeThrow' && e.playerId === id) {
          a++;
          if (e.result === 'made') m2++;
        }
      }
    }
    return { m: m2, a };
  }, [chartGames, id]);

  const displayName = rosterEntry?.name ?? (playerGames[0] ? getPlayer(playerGames[0])?.name : 'Player') ?? 'Player';
  const displayNumber = rosterEntry?.number ?? (playerGames[0] ? getPlayer(playerGames[0])?.number : null);
  const displayPosition = rosterEntry?.position ?? null;

  // chart dimensions
  const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const chartW2 = Math.min(Math.max(0, chartW - 2 * m.s2), m.win.h * 0.66 * COURT_ASPECT);
  const chartH = chartW2 / COURT_ASPECT;
  const dot = clamp(7, 0.017 * m.win.h, 16);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s2,
        paddingBottom: safe.bottom + m.s2,
        paddingLeft: safe.left + m.s4,
        paddingRight: safe.right + m.s4,
      }}
    >
      {/* the first child, outside the padding: it runs edge to edge under the
          safe-area inset, which is what makes it a bloom and not a band */}
      <Bloom />

      {/* ── Header ── */}
      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          onPress={() => router.back()}
          accessibilityLabel="back to season"
          style={{
            width: m.tap,
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.rSm,
          }}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={t.ink}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Press>

        <Col style={{ flexShrink: 1, minWidth: 0 }}>
          <Row gap={m.s2} style={{ flexShrink: 1, minWidth: 0, alignItems: 'baseline' }}>
            {displayNumber !== null && (
              <Text
                style={{
                  ...fNum(700),
                  fontSize: m.fsXl,
                  letterSpacing: ls(m.fsXl, LS_TIGHT),
                  color: t.accent,
                  fontVariant: ['tabular-nums'],
                }}
              >
                #{displayNumber}
              </Text>
            )}
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                ...fUi(700),
                fontSize: m.fsXl,
                letterSpacing: ls(m.fsXl, LS_TITLE),
                color: t.ink,
              }}
            >
              {displayName}
            </Text>
          </Row>
          <Text
            numberOfLines={1}
            style={{
              ...fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.ink2,
            }}
          >
            {[displayPosition, `${gp} game${gp === 1 ? '' : 's'}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Col>
      </Row>

      <ScrollView
        style={{ flex: 1, marginTop: m.s3 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: m.s5 }}
      >
        {gp === 0 ? (
          <Text
            style={{
              paddingVertical: m.s6,
              textAlign: 'center',
              ...fUi(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            No games recorded
          </Text>
        ) : (
          <Col gap={m.s3}>
            {/* ── Headline tiles ── */}
            <View style={{ marginBottom: m.s2 }}>
              <Seam>
                <Tile value={per(seasonStats.pts).toFixed(1)} label="PPG" tone={t.accent} />
                <Tile value={per(seasonStats.oreb + seasonStats.dreb).toFixed(1)} label="RPG" />
                <Tile value={per(seasonStats.ast).toFixed(1)} label="APG" />
                <Tile value={pctStr(seasonStats.fgm, seasonStats.fga)} label="FG%" />
                <Tile value={pctStr(seasonStats.tpm, seasonStats.tpa)} label="3P%" />
              </Seam>
            </View>

            {/* ── Shot chart section with Game Filter ── */}
            <Section title="Shot chart">
              {/* Game filter bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: m.s1, paddingHorizontal: m.s2, paddingVertical: m.s2, backgroundColor: t.surface2, borderBottomWidth: 1, borderBottomColor: t.rule }}
              >
                <Press
                  onPress={() => setSelectedGameId('total')}
                  style={{
                    paddingVertical: m.s1,
                    paddingHorizontal: m.s3,
                    borderRadius: m.rSm,
                    backgroundColor: selectedGameId === 'total' ? t.accent : t.surface,
                  }}
                  pressedStyle={selectedGameId === 'total' ? undefined : { backgroundColor: t.surface2 }}
                >
                  <Text
                    style={{
                      ...fUi(selectedGameId === 'total' ? 600 : 500),
                      fontSize: m.fsXs,
                      letterSpacing: ls(m.fsXs, LS_MICRO),
                      color: selectedGameId === 'total' ? t.accentInk : t.ink2,
                    }}
                  >
                    Total
                  </Text>
                </Press>
                {playerGames.map((g, idx) => {
                  const key = `game-${idx}`;
                  const on = selectedGameId === key;
                  const label = `${idx + 1}. ${g.opponent ? oppLabel(g.opponent) : 'Game'}`;
                  return (
                    <Press
                      key={key}
                      onPress={() => setSelectedGameId(key)}
                      style={{
                        paddingVertical: m.s1,
                        paddingHorizontal: m.s3,
                        borderRadius: m.rSm,
                        backgroundColor: on ? t.accent : t.surface,
                      }}
                      pressedStyle={on ? undefined : { backgroundColor: t.surface2 }}
                    >
                      <Text
                        style={{
                          ...fUi(on ? 600 : 500),
                          fontSize: m.fsXs,
                          letterSpacing: ls(m.fsXs, LS_MICRO),
                          color: on ? t.accentInk : t.ink2,
                        }}
                      >
                        {label}
                      </Text>
                    </Press>
                  );
                })}
              </ScrollView>

              {/* Court visualization */}
              <View
                onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
                style={{ alignItems: 'center', padding: m.s2 }}
              >
                {chartW2 > 0 && (
                  <View style={{ width: chartW2, height: chartH, borderRadius: m.rSm, overflow: 'hidden' }}>
                    <CourtSvg zone={null} side={null} />
                    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
                      {marks.map((mk) => (
                        <View
                          key={mk.id}
                          style={{
                            position: 'absolute',
                            left: mk.x * chartW2 - dot / 2,
                            top: mk.y * chartH - dot / 2,
                            width: dot,
                            height: dot,
                            borderRadius: dot / 2,
                            backgroundColor: mk.made ? dots.made : dots.miss,
                          }}
                        />
                      ))}
                      {ftTotal.a > 0 && (
                        <View
                          style={{
                            position: 'absolute',
                            left: FT_SPOT.x * chartW2 - dot / 2,
                            top: FT_SPOT.y * chartH - dot / 2,
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
              </View>

              <Row
                gap={m.s4}
                justify="center"
                style={{ paddingVertical: m.s2, borderTopWidth: 1, borderTopColor: t.rule }}
              >
                <Key color={dots.made} label="Made" />
                <Key color={dots.miss} label="Miss" ring />
                <Key color={dots.ft} label={`FT ${ftTotal.m}-${ftTotal.a}`} />
              </Row>
            </Section>

            {/* ── Per-game log (Full horizontal scrolling table, no DATE or RESULT) ── */}
            <Section title="Game log">
              <Card>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', backgroundColor: t.surface2 }}>
                      {GAME_LOG_COLS.map((c) => (
                        <Text
                          key={c.key}
                          numberOfLines={1}
                          style={{
                            width: c.w,
                            paddingVertical: m.s2,
                            paddingHorizontal: 4,
                            textAlign: c.left ? 'left' : 'right',
                            ...fUi(500),
                            fontSize: m.fsXs,
                            letterSpacing: ls(m.fsXs, LS_MICRO),
                            color: t.ink2,
                          }}
                        >
                          {c.key}
                        </Text>
                      ))}
                    </View>

                    {/* Game rows */}
                    {gameLines.map((gl, i) => {
                      const s = gl.stats;
                      const cells = [
                        oppLabel(gl.opponent),
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
                        signed(Math.round(plusMinus(s))),
                        num(Math.round(efficiency(s))),
                      ];

                      return (
                        <View
                          key={gl.gameId}
                          style={{
                            flexDirection: 'row',
                            borderTopWidth: 1,
                            borderTopColor: t.rule,
                            backgroundColor: i % 2 === 1 ? t.surface2 : t.surface,
                          }}
                        >
                          {cells.map((v, ci) => {
                            const c = GAME_LOG_COLS[ci];
                            return (
                              <Text
                                key={c.key}
                                numberOfLines={1}
                                style={{
                                  width: c.w,
                                  paddingVertical: m.s2,
                                  paddingHorizontal: 4,
                                  textAlign: c.left ? 'left' : 'right',
                                  ...(c.left ? fUi(600) : fNum(500)),
                                  fontSize: m.fsSm,
                                  color: t.ink,
                                  fontVariant: ['tabular-nums'],
                                }}
                              >
                                {v}
                              </Text>
                            );
                          })}
                        </View>
                      );
                    })}

                    {/* Total Row */}
                    <View
                      style={{
                        flexDirection: 'row',
                        borderTopWidth: 2,
                        borderTopColor: t.ink,
                        backgroundColor: t.surface2,
                      }}
                    >
                      {[
                        'Total',
                        mmss(seasonStats.sec),
                        num(seasonStats.pts),
                        pair(seasonStats.fgm, seasonStats.fga),
                        pair(seasonStats.twom, seasonStats.twoa),
                        pair(seasonStats.tpm, seasonStats.tpa),
                        pair(seasonStats.ftm, seasonStats.fta),
                        num(seasonStats.oreb),
                        num(seasonStats.dreb),
                        num(seasonStats.oreb + seasonStats.dreb),
                        num(seasonStats.ast),
                        num(seasonStats.to),
                        num(seasonStats.st),
                        num(seasonStats.bs),
                        num(seasonStats.pf),
                        num(seasonStats.fd),
                        signed(seasonStats.pm),
                        '',
                      ].map((v, ci) => {
                        const c = GAME_LOG_COLS[ci];
                        return (
                          <Text
                            key={c.key}
                            numberOfLines={1}
                            style={{
                              width: c.w,
                              paddingVertical: m.s2,
                              paddingHorizontal: 4,
                              textAlign: c.left ? 'left' : 'right',
                              ...(c.left ? fUi(700) : fNum(700)),
                              fontSize: m.fsSm,
                              color: t.ink,
                              fontVariant: ['tabular-nums'],
                            }}
                          >
                            {v}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              </Card>
            </Section>

            {/* ── Season shooting stats ── */}
            <Section title="Season shooting">
              <Line head label="" value="M-A" sub="Pct" />
              <Line label="Field goals" value={`${seasonStats.fgm}-${seasonStats.fga}`} sub={pctStr(seasonStats.fgm, seasonStats.fga)} />
              <Line label="2 points" value={`${seasonStats.twom}-${seasonStats.twoa}`} sub={pctStr(seasonStats.twom, seasonStats.twoa)} />
              <Line label="3 points" value={`${seasonStats.tpm}-${seasonStats.tpa}`} sub={pctStr(seasonStats.tpm, seasonStats.tpa)} />
              <Line label="Free throws" value={`${seasonStats.ftm}-${seasonStats.fta}`} sub={pctStr(seasonStats.ftm, seasonStats.fta)} />
            </Section>

            {/* ── Season counting stats ── */}
            <Section title="Season totals">
              <Line head label="" value="Total" sub="Per g" />
              <Line label="Points" value={seasonStats.pts} sub={String(per(seasonStats.pts).toFixed(1))} strong />
              <Line label="Off. rebounds" value={seasonStats.oreb} sub={String(per(seasonStats.oreb).toFixed(1))} />
              <Line label="Def. rebounds" value={seasonStats.dreb} sub={String(per(seasonStats.dreb).toFixed(1))} />
              <Line label="Total rebounds" value={seasonStats.oreb + seasonStats.dreb} sub={String(per(seasonStats.oreb + seasonStats.dreb).toFixed(1))} strong />
              <Line label="Assists" value={seasonStats.ast} sub={String(per(seasonStats.ast).toFixed(1))} />
              <Line label="Turnovers" value={seasonStats.to} sub={String(per(seasonStats.to).toFixed(1))} />
              <Line label="Steals" value={seasonStats.st} sub={String(per(seasonStats.st).toFixed(1))} />
              <Line label="Blocks" value={seasonStats.bs} sub={String(per(seasonStats.bs).toFixed(1))} />
              <Line label="Personal fouls" value={seasonStats.pf} sub={String(per(seasonStats.pf).toFixed(1))} />
              <Line label="Fouls drawn" value={seasonStats.fd} sub={String(per(seasonStats.fd).toFixed(1))} />
              <Line label="Minutes" value={mmss(seasonStats.sec)} sub={mmss(Math.round(seasonStats.sec / (gp || 1)))} strong />
              <Line label="Plus / minus" value={signed(seasonStats.pm)} tone={seasonStats.pm > 0 ? t.accent : seasonStats.pm < 0 ? t.danger : undefined} strong />
            </Section>

            <Note>
              Per-game averages divide by GP — games this player actually appeared in. Shot chart
              can be filtered by TOTAL or by individual games. Data is read from saved games;
              deleting a game removes it here too.
            </Note>
          </Col>
        )}
      </ScrollView>
    </View>
  );
}

/** The palette and the status bar, from the same wrapper the tab group uses. */
export default function PlayerProfile() {
  return (
    <DarkRoom>
      <PlayerProfileScreen />
    </DarkRoom>
  );
}
