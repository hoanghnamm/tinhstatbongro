import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PlaysList } from '../../components/panels/PlaysList';
import { Btn } from '../../components/panels/shell';
import { ExportButton } from '../../components/stats/ExportButton';
import { PlayersTab } from '../../components/stats/PlayersTab';
import { TeamTab } from '../../components/stats/TeamTab';
import { ZonesTab } from '../../components/stats/ZonesTab';
import { Card, Seg, type SegItem } from '../../components/stats/parts';
import { showPaywall, useGate } from '../../hooks/useGate';
import { GlowText } from '../../components/ui/GlowText';
import { Bloom } from '../../components/ui/Bloom';
import { DarkRoom } from '../../components/ui/DarkRoom';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { numDateLabel, outcomeOf, summaryKind } from '../../lib/history';
import { freeThrowsIn, periodsOf, report, shotsIn, type Split } from '../../lib/box';
import { periodLabel } from '../../lib/format';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TIGHT, LS_TITLE, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameState } from '../../types';

type Tab = 'team' | 'players' | 'zones' | 'plays';

const TABS: SegItem<Tab>[] = [
  { key: 'team', label: 'Team' },
  { key: 'players', label: 'Players' },
  { key: 'zones', label: 'Zones' },
  { key: 'plays', label: 'Plays' },
];

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
 *
 * IT IS DARK, LIKE THE SHELF IT IS OPENED FROM. MATCHES is a dark room and
 * this is one of its rows opened up, so a light page here was the app blinking
 * once on the way through — the same argument that took `start`, `settings`
 * and a player's own page onto `DarkRoom`. It draws the `<Bloom />` those
 * rooms draw, on the same ground, so a room and the page under it are one
 * building. THE BOARD IS STILL LIGHT, and that is the line: what is dark is
 * every screen a game is READ on, and what is light is the one it is PLAYED
 * on. Nothing needed a colour changed — every value here was already a token,
 * so `Card`, `Seg`, `BoxTable` and the two courts followed on their own.
 */
function SavedGameScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useHistoryStore((s) => s.index.find((g) => g.id === id));
  const loadGame = useHistoryStore((s) => s.loadGame);

  /* A practice is not a result and is never asked, exactly as on the shelf; a
     tie answers null on its own. Either way the line above draws no letter. */
  const outcome =
    summary && summaryKind(summary) !== 'practice' ? outcomeOf(summary) : null;

  const [tab, setTab] = useState<Tab>('team');

  /**
   * THREE OF THE FOUR TABS ARE PAID, AND `team` IS THE ONE THAT IS NOT.
   *
   * The free game keeps its TEAM line — the scoreline, the four team blocks
   * and every quarter split of them — and PLAYERS, ZONES and PLAYS are what
   * the wall is in front of. That is the whole of 'the game stats, and nothing
   * else': a scorer sees what their team did, not what each player did.
   *
   * THE QUARTER STRIP IS NOT GATED. It is a slice of the same team line, so
   * locking it would be selling the same tab twice.
   */
  const { locked: deepLocked, guard: guardDeep } = useGate('deepStats');
  const { locked: exportLocked } = useGate('export');

  // the padlock is drawn on the three that are behind it, so the strip reads
  // as a door rather than as a control that ignored the tap
  const tabs: SegItem<Tab>[] = TABS.map((it) =>
    it.key === 'team' ? it : { ...it, locked: deepLocked },
  );

  /**
   * A LOCKED TAB DOES NOT BECOME THE SELECTED TAB. The paywall opens over this
   * screen and closing it has to put the scorer back where they were — on
   * TEAM — rather than on an empty PLAYERS they never got to see. So the
   * guard wraps `setTab` itself: locked, and the state never moves.
   */
  const pickTab = (k: Tab): void => {
    if (k === 'team') setTab(k);
    else guardDeep(() => setTab(k))();
  };
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
        { key: 'all', label: 'All' },
        // the labels are the GAME's own — a night played in halves reads H1/H2
        // however the settings are set today
        ...periodsOf(game).map((p) => ({ key: String(p), label: periodLabel(p, game.periods) })),
      ]
    : [{ key: 'all', label: 'All' }];

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
      <Bloom />

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
              fontVariant: ['tabular-nums'],
            }}
          >
            {/* WHO IT WAS AGAINST is the title: a shelf of thirty games is
                remembered by opponent, never by the word FINAL, which every one
                of them would wear */}
            {summary ? opponentLabel(summary.opponent) : 'Final'}
          </Text>
          {/* THE QUIET LINE — kind, competition, date, and how it went. The
              result rides at the END of it, beside the date, for the reason it
              does on the shelf: the SCORE's accent is spent saying which of the
              two figures is ours, so the W or the L is what is left to say
              which way it went. Caps at `LS_CAPS`, because it is a CODE. */}
          <Row gap={m.s2} style={{ minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                minWidth: 0,
                ...fUi(500),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink2,
              }}
            >
              {/* the kind leads the line: it is the one thing on this screen that
                  decides whether the numbers under it are in the season */}
              {summary
                ? `${summaryKind(summary) === 'practice' ? 'Practice · ' : summary.competition ? `${competitionLabel(summary.competition)} · ` : ''}${numDateLabel(summary.endedAt)}`
                : ''}
            </Text>
            {outcome ? (
              <Text
                style={{
                  flexShrink: 0,
                  ...fNum(700),
                  fontSize: m.fsXs,
                  letterSpacing: ls(m.fsXs, LS_CAPS),
                  color: outcome === 'W' ? t.accent : t.danger,
                }}
              >
                {outcome}
              </Text>
            ) : null}
          </Row>
          {/* the note is on the GAME, not the summary, so it arrives with the
              read — which is also why it is the last line and not the first */}
          {!!game?.note && (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ ...fUi(400), fontSize: m.fsXs, color: t.ink3 }}
            >
              {game.note}
            </Text>
          )}
        </Col>

        {!!summary && (
          /* THEM : US, in that order, because the title beside it is THEIR
             name — the eye reads the name and then the number it belongs to.
             ACCENT MARKS OUR SCORE, AND IT MARKS IT ON EVERY GAME — it used to
             be lit only on a win, which made one colour answer two questions
             and left a loss with nothing saying which figure was ours. Which
             way it went is the W/L on the line above. */
          <Row gap={m.s2} style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
            <Text
              style={{
                ...fNum(700),
                fontSize: m.fsXl,
                letterSpacing: ls(m.fsXl, LS_TIGHT),
                color: t.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {summary.oppScore}
            </Text>
            <Text style={{ ...fNum(500), fontSize: m.fsMd, color: t.ink3 }}>:</Text>
            <GlowText
              style={{
                ...fNum(700),
                fontSize: m.fsXl,
                letterSpacing: ls(m.fsXl, LS_TIGHT),
                color: t.accent,
                fontVariant: ['tabular-nums'],
              }}
            >
              {summary.score}
            </GlowText>
          </Row>
        )}
      </Row>

      {/* ── Tab + split controls (only shown when game is loaded) ── */}
      {!!game && (
        <Col gap={m.s2} style={{ marginTop: m.s2, flexGrow: 0, flexShrink: 0 }}>
          <Seg items={tabs} value={tab} onChange={pickTab} />
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
              ...fUi(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {missing ? 'This game is no longer on the shelf' : 'Reading…'}
          </Text>
        ) : game && rep ? (
          <>
            {tab === 'team' && (
              <>
                <TeamTab report={rep} split={split} />
                {/* THE LAST THING ON TEAM / ALL, and only there: the sheet is
                    built from the whole game, so a quarter has none to offer.

                    LOCKED, IT IS STILL A BUTTON RATHER THAN A PADLOCK. The
                    control keeps its place and its word at the foot of the
                    tab; what changes is where the press goes. Swapping it for
                    a lock icon would take the verb off the screen and leave a
                    scorer wondering whether the export had been removed. */}
                {split === null &&
                  (exportLocked ? (
                    <Row align="stretch" style={{ marginTop: m.s4 }}>
                      {/* `Btn`'s `icon` REPLACES the label rather than joining
                          it, so the padlock cannot ride beside the word here.
                          The word carries it instead, and says exactly what
                          the press does. */}
                      <Btn
                        label="Unlock PDF export"
                        variant="surface"
                        onPress={() => showPaywall('export')}
                      />
                    </Row>
                  ) : (
                    <ExportButton game={game} />
                  ))}
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

/** The palette and the status bar, from the same wrapper the tab group uses. */
export default function SavedGame() {
  return (
    <DarkRoom>
      <SavedGameScreen />
    </DarkRoom>
  );
}
