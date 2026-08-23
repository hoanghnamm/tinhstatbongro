import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import { PlayersTab } from '../components/stats/PlayersTab';
import { TeamTab } from '../components/stats/TeamTab';
import { ZonesTab } from '../components/stats/ZonesTab';
import { Seg, type SegItem } from '../components/stats/parts';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { freeThrowsIn, periodsOf, report, shotsIn, type Split } from '../lib/box';
import { periodLabel } from '../lib/format';
import { opponentLabel } from '../lib/team';
import { useGameStore } from '../store/gameStore';
import { useMetrics } from '../theme/metrics';
import { LS_MICRO, LS_TIGHT, LS_TITLE, fNum, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { GameState } from '../types';

type Tab = 'team' | 'players' | 'zones';

const TABS: SegItem<Tab>[] = [
  { key: 'team', label: 'Team' },
  { key: 'players', label: 'Players' },
  { key: 'zones', label: 'Zones' },
];

/**
 * THE STATS SCREEN — where a finished game goes.
 *
 * It is three screens, not one, and that is the whole design: the full line a
 * scorer wants after the buzzer is roughly a hundred numbers, and a hundred
 * numbers in one column is a document rather than a screen. So the tab strip
 * asks WHICH KIND of number (the team's, the players', the floor's) and the
 * quarter strip asks WHICH PART OF THE GAME, and every tab answers both.
 *
 * It is an ordinary responsive screen and it scrolls. The rule that nothing
 * scrolls applies to the BOARD, which is one viewport by construction because
 * a scorer's thumb has to find a control without looking; nobody reads a box
 * score with one thumb during a possession.
 *
 * The board's counters answer the whole game and the play log answers the
 * quarters — see `lib/box.ts`. Nothing here mutates anything: the screen is
 * pure derivation, so it is correct after an UNDO with no work of its own.
 */
export default function StatsScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('team');
  const [split, setSplit] = useState<Split>(null);

  // the whole game state, shallow-compared: everything on this page is derived
  // from it, and `useShallow` keeps the object identity stable between ticks
  const g = useGameStore(
    useShallow(
      (s): GameState => ({
        team: s.team,
        kind: s.kind,
        competition: s.competition,
        opponent: s.opponent,
        note: s.note,
        score: s.score,
        oppScore: s.oppScore,
        periods: s.periods,
        periodLen: s.periodLen,
        period: s.period,
        remaining: s.remaining,
        running: s.running,
        ended: s.ended,
        possessions: s.possessions,
        players: s.players,
        events: s.events,
      }),
    ),
  );

  const rep = useMemo(() => report(g, split), [g, split]);
  const shots = useMemo(() => shotsIn(g.events, split), [g.events, split]);
  const ft = useMemo(() => freeThrowsIn(g.events, split), [g.events, split]);

  const splits: SegItem<string>[] = [
    { key: 'all', label: 'All' },
    ...periodsOf(g).map((p) => ({ key: String(p), label: periodLabel(p, g.periods) })),
  ];

  const margin = rep.us - rep.them;

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
      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          onPress={() => router.back()}
          accessibilityLabel="back"
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
          <Text
            numberOfLines={1}
            style={{
              ...fUi(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_TITLE),
              color: t.ink,
            }}
          >
            {g.ended ? 'Final' : 'Game stats'}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              ...fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.ink2,
            }}
          >
            {g.team.name}
            {g.opponent ? ` vs ${opponentLabel(g.opponent)}` : ''}
            {split === null ? ' · Whole game' : ` · ${periodLabel(split, g.periods)}`}
          </Text>
          {/* the match note, if the scorer left one at tip-off. Quiet, one
              line, and absent entirely when empty — which is the common case. */}
          {!!g.note && (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ ...fUi(400), fontSize: m.fsXs, color: t.ink3 }}
            >
              {g.note}
            </Text>
          )}
        </Col>

        <Row gap={m.s2} style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
          <Text
            style={{
              ...fNum(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_TIGHT),
              color: margin > 0 ? t.accent : t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {rep.us}
          </Text>
          <Text style={{ ...fNum(500), fontSize: m.fsMd, color: t.ink3 }}>:</Text>
          <Text
            style={{
              ...fNum(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_TIGHT),
              color: margin < 0 ? t.accent : t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {rep.them}
          </Text>
        </Row>
      </Row>

      <Col gap={m.s2} style={{ marginTop: m.s2, flexGrow: 0, flexShrink: 0 }}>
        <Seg items={TABS} value={tab} onChange={(k) => setTab(k)} />
        <Seg
          items={splits}
          value={split === null ? 'all' : String(split)}
          onChange={(k) => setSplit(k === 'all' ? null : Number(k))}
        />
      </Col>

      <ScrollView
        style={{ flex: 1, marginTop: m.s3 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: m.s5 }}
      >
        {tab === 'team' && <TeamTab report={rep} split={split} />}
        {tab === 'players' && <PlayersTab report={rep} split={split} />}
        {tab === 'zones' && <ZonesTab report={rep} shots={shots} ft={ft} />}
      </ScrollView>
    </View>
  );
}
