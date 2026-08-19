import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PlaysList } from '../../components/panels/PlaysList';
import { ExportButton } from '../../components/stats/ExportButton';
import { PlayersTab } from '../../components/stats/PlayersTab';
import { TeamTab } from '../../components/stats/TeamTab';
import { ZonesTab } from '../../components/stats/ZonesTab';
import { Card, Seg, type SegItem } from '../../components/stats/parts';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { numDateLabel, summaryKind } from '../../lib/history';
import { freeThrowsIn, periodsOf, report, shotsIn, type Split } from '../../lib/box';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameState } from '../../types';

type Tab = 'team' | 'players' | 'zones' | 'plays';

const TABS: SegItem<Tab>[] = [
  { key: 'team', label: 'TEAM' },
  { key: 'players', label: 'PLAYERS' },
  { key: 'zones', label: 'ZONES' },
  { key: 'plays', label: 'PLAYS' },
];

/** Q1–Q4, then overtimes. */
const periodLabel = (p: number): string => (p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `OT${p - 4}`);

/**
 * ONE SAVED GAME — full final stats.
 *
 * Shows the same three stat tabs as the live stats screen (TEAM, PLAYERS,
 * ZONES) with the same quarter-by-quarter split control, plus PLAY BY PLAY.
 * All tabs read from the saved game loaded off disk; nothing here mutates
 * anything.
 *
 * IT IS ALSO WHERE THE GAME LEAVES THE APP. `ExportButton` sits at the foot of
 * TEAM / ALL — everything on these four tabs, printed as one FIBA-shaped sheet
 * — because that tab is where the game is a whole thing rather than a list, and
 * ALL is the only slice `lib/pdf.ts` builds.
 *
 * THERE IS NO BOX SCORE TAB. It was the twenty-column table a second time, and
 * PLAYERS already prints it, split by quarter. The board's own box-score panel
 * is gone as well, so this screen and `/stats` are where the full line lives.
 *
 * It is outside the tab group on purpose. This is a place you go INTO from the
 * MATCHES list and come back out of, so it gets a back button and the full window
 * rather than a tab bar that would suggest it is a fifth room.
 *
 * IT IS ALSO WHERE END GAME LANDS. The confirm files the game and `replace`s
 * the board with this page, so the finished game is read here the same way any
 * other game on the shelf is — and the back arrow, having no board left under
 * it, comes out on the LOBBY.
 */
export default function SavedGameScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useHistoryStore((s) => s.index.find((g) => g.id === id));
  const loadGame = useHistoryStore((s) => s.loadGame);

  const [tab, setTab] = useState<Tab>('team');
  const [split, setSplit] = useState<Split>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [reading, setReading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setReading(true);
    void loadGame(id).then((g) => {
      if (!alive) return;
      setGame(g);
      setReading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, loadGame]);

  const missing = !reading && !game;

  // Derived stats — only computed when the game is loaded
  const rep = useMemo(() => (game ? report(game, split) : null), [game, split]);
  const shots = useMemo(() => (game ? shotsIn(game.events, split) : []), [game, split]);
  // NOT [] — free throws all land on one spot, so this is a COUNT, not a list
  const ft = useMemo(
    () => (game ? freeThrowsIn(game.events, split) : { m: 0, a: 0 }),
    [game, split],
  );

  const splits: SegItem<string>[] = game
    ? [
        { key: 'all', label: 'ALL' },
        ...periodsOf(game).map((p) => ({ key: String(p), label: periodLabel(p) })),
      ]
    : [{ key: 'all', label: 'ALL' }];

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
      {/* ── Header ── */}
      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          // whatever is under this screen: the MATCHES shelf it was opened
          // from, or the LOBBY, because END GAME REPLACES the board with this
          // page rather than pushing over it
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
              d="M15 4L7 12l8 8"
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
              fontFamily: fNum(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_BTN),
              color: t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {/* WHO IT WAS AGAINST is the title: a shelf of thirty games is
                remembered by opponent, never by the word FINAL, which every one
                of them would wear */}
            {summary ? opponentLabel(summary.opponent) : 'FINAL'}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fUi(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_LABEL),
              color: t.ink2,
            }}
          >
            {/* the kind leads the line: it is the one thing on this screen that
                decides whether the numbers under it are in the season */}
            {summary
              ? `${summaryKind(summary) === 'practice' ? 'PRACTICE · ' : summary.competition ? `${competitionLabel(summary.competition)} · ` : ''}${numDateLabel(summary.endedAt)}`
              : ''}
          </Text>
          {/* the note is on the GAME, not the summary, so it arrives with the
              read — which is also why it is the last line and not the first */}
          {!!game?.note && (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ fontFamily: fUi(400), fontSize: m.fsXs, color: t.ink3 }}
            >
              {game.note}
            </Text>
          )}
        </Col>

        {!!summary && (
          /* THEM : US, in that order, because the title beside it is THEIR
             name — the eye reads the name and then the number it belongs to.
             Accent still marks OUR score and still only when we won. */
          <Row gap={m.s2} style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
            <Text
              style={{
                fontFamily: fNum(700),
                fontSize: m.fsXl,
                color: t.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {summary.oppScore}
            </Text>
            <Text style={{ fontFamily: fNum(500), fontSize: m.fsMd, color: t.ink3 }}>:</Text>
            <Text
              style={{
                fontFamily: fNum(700),
                fontSize: m.fsXl,
                color: summary.score > summary.oppScore ? t.accent : t.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {summary.score}
            </Text>
          </Row>
        )}
      </Row>

      {/* ── Tab + split controls (only shown when game is loaded) ── */}
      {!!game && (
        <Col gap={m.s2} style={{ marginTop: m.s2, flexGrow: 0, flexShrink: 0 }}>
          <Seg items={TABS} value={tab} onChange={(k) => setTab(k)} />
          {tab !== 'plays' && (
            <Seg
              items={splits}
              value={split === null ? 'all' : String(split)}
              onChange={(k) => setSplit(k === 'all' ? null : Number(k))}
            />
          )}
        </Col>
      )}

      {/* ── Body ── */}
      <ScrollView
        style={{ flex: 1, marginTop: m.s3 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: m.s5 }}
      >
        {reading || missing ? (
          <Text
            style={{
              paddingVertical: m.s6,
              textAlign: 'center',
              fontFamily: fNum(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {missing ? 'THIS GAME IS NO LONGER ON THE SHELF' : 'READING…'}
          </Text>
        ) : game && rep ? (
          <>
            {tab === 'team' && (
              <>
                <TeamTab report={rep} split={split} />
                {/* THE LAST THING ON TEAM / ALL, and only there: the sheet is
                    built from the whole game, so a quarter has none to offer */}
                {split === null && <ExportButton game={game} />}
              </>
            )}
            {tab === 'players' && <PlayersTab report={rep} split={split} />}
            {tab === 'zones' && <ZonesTab report={rep} shots={shots} ft={ft} />}
            {tab === 'plays' && (
              <Card>
                <PlaysList events={game.events} players={game.players} />
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
