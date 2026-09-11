import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SeasonTable } from '../components/stats/SeasonTable';
import { Band, Card, Seam, Seg, Tile, type SegItem } from '../components/stats/parts';
import { Bloom } from '../components/ui/Bloom';
import { Locked } from '../components/ui/Locked';
import { DarkRoom } from '../components/ui/DarkRoom';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { useLocked } from '../hooks/useGate';
import { useSavedGames } from '../hooks/useSavedGames';
import { pct } from '../lib/format';
import { competitions, season, type SeasonMode } from '../lib/season';
import { efg, ts } from '../lib/stats';
import { competitionLabel } from '../lib/team';
import { useActiveSquad } from '../hooks/useActiveSquad';
import { membersOf, squadIn } from '../lib/squads';
import { useMetrics } from '../theme/metrics';
import { LS_LABEL, LS_MICRO, LS_TITLE, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const MODES: SegItem<SeasonMode>[] = [
  { key: 'totals', label: 'Totals' },
  { key: 'perGame', label: 'Per game' },
];

/**
 * ONE COMPETITION, IN FULL — what a card on the SEASON tab opens.
 *
 * It is the season screen over a slice: the same six headline numbers, the same
 * TOTALS / PER GAME toggle and the same `BoxTable`, because a competition line
 * and a season line are the same twenty columns over the same `Player[]`. The
 * card that leads here shows three of these numbers; this is the rest of them.
 *
 * IT IS ADDRESSED BY THE FOLDED KEY, not by the name, and it is a query param
 * rather than a `[name]` segment. Two reasons, and they are the same reason
 * twice: a competition's name is typed by hand, so `VBA 2026` and `vba  2026`
 * are one competition and only the key says so — and the one group that has no
 * name at all (official games saved before competitions existed) has `''` for a
 * key, which is a perfectly ordinary query param and not a path segment at all.
 *
 * It is outside the tab group for the reason `history/[id]` is: a place you go
 * INTO from a card and come back out of gets a back button, not a fifth tab.
 *
 * IT IS DARK, LIKE THE ROOM IT IS OPENED FROM. This is a SEASON card opened
 * up, and a light page between two dark ones was the app blinking once on the
 * way through — the same argument that took `start`, `settings` and a player's
 * own page onto `DarkRoom`. It draws the `<Bloom />` those rooms draw, on the
 * same ground, so a room and the page under it are one building. Nothing needed
 * a colour changed: every value on it was already a token.
 */
function CompetitionScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const { key = '' } = useLocalSearchParams<{ key?: string }>();
  // ONE TEAM'S RUN IN ONE COMPETITION — the page is reached from that team's
  // season, so pooling the club's other teams here would answer a question
  // nobody asked on the way in.
  const { squad, roster: pool } = useActiveSquad();
  const roster = useMemo(() => membersOf(squad, pool), [squad, pool]);
  const games = useSavedGames();
  const gated = useLocked('season');

  const [mode, setMode] = useState<SeasonMode>('totals');

  // the grouping is done once, by the same function the SEASON tab uses, and
  // the one group asked for is picked out of it — so a card and its page can
  // never disagree about which games belong to a competition
  const comp = useMemo(
    () =>
      games
        ? (competitions(squadIn(games, squad?.id ?? ''), roster).find((c) => c.key === key) ?? null)
        : null,
    [games, roster, key, squad],
  );

  const S = useMemo(
    () => (comp ? season(comp.games, roster, mode) : null),
    [comp, roster, mode],
  );

  const whole = comp?.season ?? null;
  const name = competitionLabel(comp?.name ?? key);
  const reading = games === null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s2,
        paddingLeft: safe.left + m.s4,
        paddingRight: safe.right + m.s4,
      }}
    >
      <Bloom />

      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          onPress={() => router.back()}
          accessibilityLabel="back to the season"
          style={{
            flexGrow: 0,
            flexShrink: 0,
            width: m.tap,
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -m.s2,
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
            {name}
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
            {whole
              ? `${whole.games} game${whole.games === 1 ? '' : 's'} · ${whole.wins}-${whole.losses}`
              : reading
                ? 'Reading the shelf'
                : 'Nothing filed under this'}
          </Text>
        </Col>
      </Row>

      {/* REACHED BY DEEP LINK, THIS PAGE GUARDS ITSELF. Both routes into it —
          the lobby's LEAGUE block and the STATS tab's cards — already check
          the gate, so this branch fires only for a link that skipped them. It
          is here anyway: a page that trusts its callers is a page that is one
          new caller away from being a hole in the wall. The HEADER above
          stays drawn, so the back arrow is still there to leave by. */}
      {gated ? (
        <Col justify="center" style={{ flex: 1 }}>
          <Locked gate="season" blurb="Every game in this competition added up, and each player's line across it." />
        </Col>
      ) : S && whole ? (
        <ScrollView
          style={{ flex: 1, marginTop: m.s3 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: safe.bottom + m.s5 }}
        >
          <Col gap={m.s3}>
            <Card>
              <Band label="The competition" />
              <Col gap={1} style={{ backgroundColor: t.rule }}>
                <Seam>
                  <Tile value={whole.games} label="Games" />
                  <Tile
                    value={`${whole.wins}-${whole.losses}`}
                    label="Record"
                  />
                  <Tile
                    value={whole.games ? Math.round(whole.team.pts / whole.games) : 0}
                    label="Points / game"
                  />
                </Seam>
                <Seam>
                  <Tile value={pct(whole.team.fgm, whole.team.fga)} label="FG%" />
                  <Tile value={efg(whole.team)} label="Effective FG" />
                  <Tile value={ts(whole.team)} label="True shooting" />
                </Seam>
              </Col>
            </Card>

            <Seg items={MODES} value={mode} onChange={(k) => setMode(k)} />

            <SeasonTable season={S} mode={mode} />
          </Col>
        </ScrollView>
      ) : (
        <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
          <Text
            style={{
              ...fUi(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {reading ? 'Reading the shelf…' : 'No games here'}
          </Text>
        </Col>
      )}
    </View>
  );
}

/** The palette and the status bar, from the same wrapper the tab group uses. */
export default function Competition() {
  return (
    <DarkRoom>
      <CompetitionScreen />
    </DarkRoom>
  );
}
