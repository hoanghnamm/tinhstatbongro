import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Toast } from '../../components/Toast';
import { PanelHost } from '../../components/panels/PanelHost';
import { Btn } from '../../components/panels/shell';
import { Band, Card } from '../../components/stats/parts';
import { EmptyState } from '../../components/offcourt/EmptyState';

import { RoomGround } from '../../components/offcourt/RoomGround';
import { GlowText } from '../../components/ui/GlowText';
import { Press } from '../../components/ui/Press';
import { Wordmark } from '../../components/ui/Wordmark';
import { Col, Row } from '../../components/ui/Row';
import { TUTORIAL_COPY } from '../../constants/tutorial';
import { useGate, useLaunchPaywall } from '../../hooks/useGate';
import { useIntro } from '../../hooks/useIntro';
import { useTabInset } from '../../hooks/useTabInset';
import { useTopOnBlur } from '../../hooks/useTopOnBlur';
import { useSavedGames } from '../../hooks/useSavedGames';
import { pct } from '../../lib/format';
import { STARTERS } from '../../lib/roster';
import { competitions, officialIn, season, type SeasonLine } from '../../lib/season';
import { competitionLabel } from '../../lib/team';
import { efficiency } from '../../lib/stats';
import { useGameStore } from '../../store/gameStore';
import { useHistoryStore } from '../../store/historyStore';
import { useActiveSquad } from '../../hooks/useActiveSquad';
import { membersOf, squadIn } from '../../lib/squads';
import { useTutorialStore } from '../../store/tutorialStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { ROOM_WIDTH } from '../../theme/room';
import { LS_LABEL, LS_MICRO, LS_TIGHT, LS_TITLE, fNum, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// Two blocks and the verbs. Presentation stays local; the game rules do not change.
function HeaderArt() {
  const m = useMetrics(); const t = useTheme();
  const w = m.win.w * 0.82; const h = m.win.h * 0.24;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: w, height: h }}>
    <Image source={require('../../assets/hero-court.jpg')} resizeMode="cover" style={{ width: w, height: h }} />
    <LinearGradient colors={[t.bg, withAlpha(t.bg, 0.55), 'transparent']} locations={[0, 0.42, 1]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', inset: 0 }} />
    <LinearGradient colors={['transparent', withAlpha(t.bg, 0.6), t.bg]} locations={[0.35, 0.75, 1]}
      style={{ position: 'absolute', inset: 0 }} />
  </View>;
}
function Label({ children }: { children: ReactNode }) {
  const m = useMetrics(); const t = useTheme();
  return <Text style={{ ...fUi(400), fontSize: m.fsXs, letterSpacing: ls(m.fsXs, LS_MICRO), color: t.ink2 }}>{children}</Text>;
}
function Stat({ value, label }: { value: string | number; label: string }) {
  const m = useMetrics(); const t = useTheme();
  return <Col gap={m.s1} style={{ flex: 1, minWidth: 0 }}>
    <Text numberOfLines={1} style={{ ...fNum(700), fontSize: m.fsLg, letterSpacing: ls(m.fsLg, LS_TIGHT),
      color: t.ink, fontVariant: ['tabular-nums'] }}>{value}</Text><Label>{label}</Label>
  </Col>;
}
function LeagueCard({ name, points, record, games, fgm, fga, onPress }: {
  name: string; points: number; record: string; games: number; fgm: number; fga: number; onPress(): void;
}) {
  const m = useMetrics(); const t = useTheme();
  return <Press onPress={onPress} accessibilityLabel={`${name}, ${points} total points, record ${record}. Open competition`}
    style={{ borderRadius: m.r }} pressedStyle={{ opacity: 0.7 }}>
    <Card glass><Band label="League" tone={t.accent} />
      <Col gap={m.s3} style={{ padding: m.s4 }}>
        <Text numberOfLines={2} style={{ ...fUi(600), fontSize: m.fsMd, lineHeight: m.fsMd * 1.3,
          letterSpacing: ls(m.fsMd, LS_LABEL), color: t.ink }}>{name}</Text>
        <Row gap={m.s4}>
          <Col gap={m.s1} style={{ flex: 1.15, minWidth: 0 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ ...fNum(700), fontSize: m.fs3xl, lineHeight: m.fs3xl * 1.08,
                letterSpacing: ls(m.fs3xl, LS_TIGHT), color: t.ink, fontVariant: ['tabular-nums'] }}>{points}</Text>
            <Label>Total points</Label>
          </Col><Stat value={record} label="Record" /><Stat value={games} label="Games" />
        </Row>
        <Row gap={m.s2} style={{ borderTopWidth: 1, borderTopColor: t.rule, paddingTop: m.s3, flexWrap: 'wrap' }}>
          <Label>Field goals</Label>
          <Text style={{ marginLeft: 'auto', ...fNum(600), fontSize: m.fsSm, color: t.ink, fontVariant: ['tabular-nums'] }}>{fgm}/{fga} · {pct(fgm, fga)}</Text>
        </Row>
      </Col>
    </Card>
  </Press>;
}
function MvpCard({ number, name, ppg, apg, rpg, onPress }: {
  number: number; name: string; ppg: string; apg: string; rpg: string; onPress(): void;
}) {
  const m = useMetrics(); const t = useTheme();
  return <Press onPress={onPress} accessibilityLabel={`MVP, ${name}, number ${number}, ${ppg} points per game. Open player season`}
    style={{ borderRadius: m.r }} pressedStyle={{ opacity: 0.7 }}>
    <Card glass><Band label="MVP" tone={t.accent} note={<Label>Per game</Label>} />
      <Col gap={m.s3} style={{ padding: m.s4 }}>
        <Row gap={m.s3}>
          <Text style={{ ...fNum(600), fontSize: m.fs2xl, letterSpacing: ls(m.fs2xl, LS_TIGHT), color: t.ink2, fontVariant: ['tabular-nums'] }}>#{number}</Text>
          <Text numberOfLines={2} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, ...fUi(600), fontSize: m.fsLg,
            lineHeight: m.fsLg * 1.3, letterSpacing: ls(m.fsLg, LS_TITLE), color: t.ink }}>{name}</Text>
        </Row>
        <Row gap={m.s3} style={{ borderTopWidth: 1, borderTopColor: t.rule, paddingTop: m.s3 }}>
          <Stat value={ppg} label="Points" /><Stat value={rpg} label="Rebounds" /><Stat value={apg} label="Assists" />
        </Row>
      </Col>
    </Card>
  </Press>;
}
function ReadingState() {
  const m = useMetrics(); const t = useTheme();
  return <Col gap={m.s3}>
    <Text accessibilityLiveRegion="polite" style={{ ...fUi(400), fontSize: m.fsSm, color: t.ink2 }}>Reading your games…</Text>
    {[0, 1].map((key) => <View key={key} accessible={false} style={{ height: m.tap * 3, backgroundColor: t.surface, borderRadius: m.r }} />)}
  </Col>;
}
function TutorialRow({ busy, onPress }: { busy: boolean; onPress(): void }) {
  const m = useMetrics(); const t = useTheme();
  return <Col gap={m.s1}>
    <Press onPress={busy ? undefined : onPress} disabled={busy} accessibilityLabel={TUTORIAL_COPY.entry}
      style={{ minHeight: m.tap, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: m.s2,
        borderRadius: m.rSm, opacity: busy ? 0.45 : 1 }} pressedStyle={{ backgroundColor: t.surface }}>
      <MaterialCommunityIcons name="gesture-tap" size={m.fsMd} color={t.ink2} />
      <Text style={{ flexShrink: 1, ...fUi(500), fontSize: m.fsSm, letterSpacing: ls(m.fsSm, LS_LABEL), color: t.ink2 }}>{TUTORIAL_COPY.entry}</Text>
    </Press>
    {busy && <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', ...fUi(400), fontSize: m.fsXs,
      lineHeight: m.fsXs * 1.4, color: t.ink2 }}>{TUTORIAL_COPY.busy}</Text>}
  </Col>;
}
const avg = (n: number): string => Number.isInteger(n) ? String(n) : n.toFixed(1);

export default function Lobby() {
  const m = useMetrics(); const t = useTheme(); const safe = useSafeAreaInsets(); const bar = useTabInset();
  // a tab is a room, and it is entered at the top of it — see the hook
  const scroller = useRef<ScrollView>(null);
  useTopOnBlur(scroller);
  // THE LOBBY IS ONE TEAM'S LOBBY. The two cards under the wordmark are a
  // LEAGUE and an MVP, and both of those are questions about a squad rather
  // than about a club: pooling three teams' games would give a season line
  // nobody played and a leading scorer picked out of two different leagues.
  const { squad, roster: pool } = useActiveSquad();
  const roster = useMemo(() => membersOf(squad, pool), [squad, pool]);
  const ended = useGameStore((s) => s.ended);
  const played = useGameStore((s) => s.events.length > 0);
  const open = useUiStore((s) => s.open);
  const savedCount = useHistoryStore((s) => s.index.length);
  const saved = useSavedGames();
  // the team's games first, then the season's own filter over them — the same
  // order every other screen applies the two in
  const official = useMemo(
    () => (saved ? officialIn(squadIn(saved, squad?.id ?? '')) : null),
    [saved, squad],
  );
  const mvp = useMemo<SeasonLine | null>(() => {
    if (!official?.length) return null;
    const { lines } = season(official, roster, 'perGame');
    if (!lines.length) return null;
    return lines.reduce((best, line) => {
      if (line.stats.points !== best.stats.points) return line.stats.points > best.stats.points ? line : best;
      const a = efficiency(line.stats); const b = efficiency(best.stats);
      if (a !== b) return a > b ? line : best;
      return line.games > best.games ? line : best;
    });
  }, [official, roster]);
  const league = useMemo(() => official?.length ? competitions(official, roster)[0] ?? null : null, [official, roster]);
  const inProgress = played && !ended;
  const beginTutorial = useTutorialStore((s) => s.begin);
  const tutorialLastStep = useTutorialStore((s) => s.lastStep);
  const outroPending = useTutorialStore((s) => s.outroPending);
  const markOutroShown = useTutorialStore((s) => s.markOutroShown);
  const say = useUiStore((s) => s.say);
  useEffect(() => {
    if (!outroPending) return;
    say(TUTORIAL_COPY.outro); markOutroShown();
  }, [outroPending, say, markOutroShown]);
  const { guard: guardNew } = useGate('newGame');
  const { guard: guardSeason } = useGate('season');
  const { pending } = useIntro();
  useLaunchPaywall(pending);
  const enough = roster.filter((p) => p.available).length >= STARTERS;
  const nothingYet = !played && savedCount === 0;
  const loading = saved === null;
  const empty = !loading && !league && !mvp;
  // Gate before confirm: never discard the live game before the scorer decides.
  const newGame = guardNew(() => {
    if (inProgress) open({ kind: 'newGame' }); else router.push('/start');
  });
  const openPlayer = (id: string) => guardSeason(() => router.push({ pathname: '/player/[id]', params: { id, games: JSON.stringify(official ?? []) } }))();
  return <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: safe.top + m.s2,
    paddingLeft: safe.left + m.s4, paddingRight: safe.right + m.s4 }}>
    <HeaderArt /><RoomGround />
    <Row style={{ width: '100%', maxWidth: ROOM_WIDTH, alignSelf: 'center', flexShrink: 0 }}><Wordmark /></Row>
    <ScrollView ref={scroller} showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: m.s4 }}
      contentContainerStyle={{ paddingBottom: bar + m.s5, alignItems: 'center' }}>
      <Col gap={m.s3} style={{ width: '100%', maxWidth: ROOM_WIDTH }}>
        {loading && <ReadingState />}
        {league && <LeagueCard name={competitionLabel(league.name)} points={league.season.team.pts}
          record={`${league.season.wins}-${league.season.losses}`} games={league.season.games} fgm={league.season.team.fgm} fga={league.season.team.fga}
          onPress={guardSeason(() => router.push({ pathname: '/competition', params: { key: league.key } }))} />}
        {mvp && <MvpCard number={mvp.number} name={mvp.name} ppg={avg(mvp.stats.points)} apg={avg(mvp.stats.assists)}
          rpg={avg(mvp.stats.offensiveRebounds + mvp.stats.defensiveRebounds)} onPress={() => openPlayer(mvp.id)} />}
        {empty && <EmptyState title={nothingYet ? 'Your team. Your first game.' : 'No official games yet'} />}
        <Col gap={m.s2}>
          {inProgress && <Row align="stretch"><Btn label="Continue game" variant="bloom" onPress={() => router.push('/game')} /></Row>}
          <Row align="stretch" gap={m.s2}>
            <View style={{ flex: 4, flexDirection: 'row' }}><Btn label="New game" variant={inProgress ? 'surface' : 'bloom'} disabled={!enough} onPress={newGame} /></View>
            <View style={{ flex: 1, flexDirection: 'row' }}><Btn label="Game settings" icon="cog" variant="plain" onPress={() => router.push('/settings')} /></View>
          </Row>
          {!enough && <Col align="center">
            <Text accessibilityLiveRegion="polite" style={{ ...fUi(400), fontSize: m.fsSm, color: t.danger, textAlign: 'center' }}>Need at least {STARTERS} available players</Text>
            <Press onPress={() => router.push('/team')} accessibilityLabel="Choose available players in Team"
              style={{ minHeight: m.tap, justifyContent: 'center', paddingHorizontal: m.s3 }} pressedStyle={{ backgroundColor: t.surface }}>
              <GlowText style={{ ...fUi(600), fontSize: m.fsSm, color: t.accent }}>Choose players in Team</GlowText>
            </Press>
          </Col>}
          <TutorialRow busy={inProgress} onPress={() => {
            if (tutorialLastStep) { open({ kind: 'resumeTutorial' }); return; }
            beginTutorial(); router.push('/game');
          }} />
        </Col>
      </Col>
    </ScrollView>
    <PanelHost /><Toast />
  </View>;
}
