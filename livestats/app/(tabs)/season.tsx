import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PlayerList } from '../../components/stats/PlayerList';
import { Band, Seam, Tile } from '../../components/stats/parts';
import { Bloom } from '../../components/ui/Bloom';
import { ClubMark } from '../../components/team/ClubMark';
import { Locked } from '../../components/ui/Locked';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useLocked } from '../../hooks/useGate';
import { useSavedRows, type SavedGame } from '../../hooks/useSavedGames';
import { useTabInset } from '../../hooks/useTabInset';
import { dayMonthLabel, summaryKind } from '../../lib/history';
import { competitions, season, type CompetitionSeason, type Season } from '../../lib/season';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useMetrics } from '../../theme/metrics';
import {
  ELEV_CARD,
  LS_LABEL,
  LS_MICRO,
  fNum,
  fUi,
  isTranslucent,
  ls,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const gamesLabel = (n: number): string => `${n} game${n === 1 ? '' : 's'}`;

/** `4-2` win-loss record. */
const record = (s: Season): string => `${s.wins}-${s.losses}`;

/**
 * A TEAM AVERAGE, to one decimal.
 *
 * One decimal and not none: 68 and 68.4 points a game are the same number to a
 * reader, and the difference between two competitions is often the tenth.
 */
const avg = (total: number, games: number): number =>
  games ? Math.round((total / games) * 10) / 10 : 0;

/**
 * ONE COMPETITION, AS THREE NUMBERS.
 *
 * The header is the whole answer to "which run of games is this and how many
 * of them": the COUNT sits at the left, where the eye already is, and the NAME
 * at the right, because a name is what you read once to identify a card and a
 * count is what you compare between them.
 *
 * Three tiles and no more, and all three are AVERAGES — points, rebounds and
 * assists a game. A competition card is a SUMMARY with a whole page behind it,
 * and per-game is the only reading that compares between cards: a six-game cup
 * run and a twenty-game league season have totals that cannot be put beside
 * each other. The RECORD is the one fact that is not an average, and it rides
 * in the header beside the count rather than eating a tile.
 *
 * IT PRESSES ON OPACITY, not on a fill, and that is the one place this screen
 * departs from the board's convention. A tile is opaque by construction — the
 * 1px seams between them ARE the grid — so a background change on the card
 * underneath cannot be seen anywhere except its edges.
 *
 * THE COMPETITIONS SIT ABOVE THE PLAYERS, and the order of those two is the
 * order of the questions. How the LEAGUE is going is what a scorer opens this
 * tab asking — it is the same argument that put the lobby's league block above
 * its MVP — and who is having a season is the follow-up you scroll to. It is
 * also the shape that puts the cards near the top of a screen made of quiet
 * type and the long list at the bottom, where a list belongs.
 */
function CompCard({ comp, onPress }: { comp: CompetitionSeason; onPress(): void }) {
  const m = useMetrics();
  const t = useTheme();
  const S = comp.season;
  const name = competitionLabel(comp.name);

  return (
    // the shadow lives on the wrapper and the clip on the Press, for the same
    // reason `Card` is two views: one view cannot both clip its children to a
    // radius and cast outside its own bounds…
    //
    // …and the wrapper's fill goes on a translucent palette, exactly as
    // `Card`'s does: a 5% white painted here and again on the `Press` is the
    // same surface composited twice, and it would put an opaque slab in front
    // of the bloom this card is meant to sit in.
    <View
      style={{
        borderRadius: m.r,
        backgroundColor: isTranslucent(t) ? 'transparent' : t.surface,
        ...ELEV_CARD,
      }}
    >
      <Press
        onPress={onPress}
        accessibilityLabel={`${name}, ${gamesLabel(S.games).toLowerCase()}`}
        style={{
          borderWidth: 1,
          borderColor: t.rule,
          borderRadius: m.r,
          overflow: 'hidden',
          backgroundColor: t.surface,
        }}
        pressedStyle={{ opacity: 0.6 }}
      >
        <Band
          label={`${gamesLabel(S.games)} · ${record(S)}`}
          note={
            <Text
              numberOfLines={1}
              style={{
                ...fUi(600),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink,
              }}
            >
              {name}
            </Text>
          }
        />
        <Seam>
          <Tile value={avg(S.team.pts, S.games)} label="Points" />
          <Tile value={avg(S.team.reb, S.games)} label="Rebounds" />
          <Tile value={avg(S.team.ast, S.games)} label="Assists" />
        </Seam>
      </Press>
    </View>
  );
}

/**
 * THE WAY INTO THE LAST GAME'S ANALYSIS.
 *
 * A ruled row rather than a filled card: everything else on this screen above
 * the competitions is type on the room's own ground, and a `surface` block
 * here would be the only slab between the headline and the table. What says it
 * is a CONTROL is the 1px edge and the chevron, and what says which game it is
 * about is the line under the verb — a door with no idea behind it is a tap
 * nobody takes twice.
 *
 * IT IS DRAWN WHENEVER THERE IS AN OFFICIAL GAME, including when that game is
 * the only one there is. A comparison against nothing is still the last game's
 * own six numbers with `—` beside them, and a scorer who has played one game
 * gets a page that says so rather than a control that is missing for a reason
 * the screen never states.
 */
function AnalysisRow({ last }: { last: SavedGame }) {
  const m = useMetrics();
  const t = useTheme();

  const opponent = last.summary.opponent ?? last.game.opponent ?? '';
  const subtitle = [
    opponent ? `vs ${opponentLabel(opponent)}` : 'Last official game',
    dayMonthLabel(last.summary.endedAt),
  ].join(' · ');

  return (
    <Press
      onPress={() => router.push('/analysis')}
      accessibilityLabel="last game analysis"
      style={{
        borderWidth: 1,
        borderColor: t.rule,
        borderRadius: m.r,
        paddingVertical: m.s3,
        paddingHorizontal: m.s3,
        minHeight: m.tap,
        justifyContent: 'center',
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Row gap={m.s3}>
        <Col style={{ flex: 1, minWidth: 0 }} gap={2}>
          <Text
            numberOfLines={1}
            style={{
              ...fUi(600),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink,
            }}
          >
            Last game analysis
          </Text>
          <Text
            numberOfLines={1}
            style={{
              ...fUi(400),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.ink3,
            }}
          >
            {subtitle}
          </Text>
        </Col>
        <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
          <Path
            d="M9 5l7 7-7 7"
            stroke={t.ink3}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Row>
    </Press>
  );
}

/** A block's own name, outside whatever it names. */
function SectionLabel({ children }: { children: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      style={{
        ...fUi(600),
        fontSize: m.fsSm,
        letterSpacing: ls(m.fsSm, LS_LABEL),
        color: t.ink2,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * THE SEASON — every OFFICIAL game added up.
 *
 * This is the one tab that has to read the full games rather than the index,
 * because a season line is made of stat lines and a summary has none. So it
 * loads all of them once, through `useSavedRows`, and re-loads only when the
 * index changes.
 *
 * A PRACTICE IS NOT IN ANY OF THIS. It is a real game with a real box score
 * and it is on the shelf and it opens; it is simply not what a season is made
 * of, which is exactly what the scorer said when they tapped PRACTICE at the
 * door. NOTHING ON THE SCREEN COUNTS THE ONES LEFT OUT: the number of games
 * that are not on a screen is not a fact about the screen, and the empty state
 * is where the rule is said out loud instead.
 *
 * THE ORDER IS THE HIERARCHY, and it was rebuilt to be one. It reads: WHOSE
 * season and how it has gone (the club and the record), HOW THE LAST GAME
 * COMPARED, HOW EACH COMPETITION is going, and finally WHO played in it. Every
 * step is a narrower question than the one above it, and nothing on the screen
 * is a container inside a container: one scroller, hairlines instead of boxes,
 * and the only cards are the ways OUT.
 *
 * THERE ARE NO TEAM HEADLINE FIGURES ON IT. Points, rebounds and assists a
 * game sat under the record for a revision, at the top, as the biggest type in
 * the room. They were three numbers nobody had asked for yet: the RECORD above
 * them already says how the season has gone, each competition card carries the
 * same three for the slice it is about, and the one comparison that makes a
 * points-per-game figure mean anything is a tap away on the row beneath. Do
 * not put them back without being asked.
 *
 * AND THERE IS NO TOTALS / PER GAME STRIP. The list is PER GAME, always. A
 * season's totals are a number with nothing to be compared against — a
 * twenty-game league and a six-game cup have totals that cannot be put beside
 * each other — and the strip was a control whose two positions a scorer had to
 * try in order to find out which one they wanted. What is left says PER GAME
 * in the column header, so the reading is stated rather than chosen.
 *
 * THE TWENTY-COLUMN BOX SCORE IS NOT HERE ANY MORE. A table that scrolls
 * sideways is a table nobody reads on the screen they arrive at — the list is
 * three numbers and a name, and the full line is one tap away on the player's
 * own page, which also has their splits, their chart and their game log.
 * `BoxTable` is untouched and still has its two callers, a saved game and a
 * competition's page.
 *
 * PER GAME DIVIDES BY GAMES THE PLAYER APPEARED IN, not by games in the season.
 * A twelfth man who turned up twice averages over two; the other reading
 * punishes a player for the nights the team played without them — which is
 * exactly why G stays on the row.
 */
export default function SeasonScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

  const index = useHistoryStore((s) => s.index);
  const roster = useRosterStore((s) => s.players);
  const rows = useSavedRows();

  // the season is the official games, and the split is made here rather than
  // inside `season()` — one competition's page filters first and aggregates the
  // same way, so the filter belongs to the caller
  const official = useMemo<SavedGame[] | null>(
    () => (rows ? rows.filter((r) => summaryKind(r.summary) !== 'practice') : null),
    [rows],
  );
  const games = useMemo(() => official?.map((r) => r.game) ?? null, [official]);

  // ONE aggregate, and it is PER GAME. There is no strip to answer any more,
  // so there is no second reading to build.
  const S = useMemo(() => (games ? season(games, roster, 'perGame') : null), [games, roster]);
  const comps = useMemo(() => (games ? competitions(games, roster) : []), [games, roster]);

  /**
   * THE WHOLE ROOM IS BEHIND THE WALL, not one card in it.
   *
   * A season is the aggregate — every official game added up — and there is no
   * half of that worth showing for free. So the gate is asked ONCE, at the
   * top, and the screen either is itself or is a door. It is checked BEFORE
   * the empty states below, because a locked screen that first says 'no games
   * yet' is telling a scorer their data is missing when it is only unpaid for.
   */
  const gated = useLocked('season');

  const empty = index.length === 0;
  const noneOfficial = !!official && official.length === 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s3,
        paddingLeft: safe.left + m.s4,
        paddingRight: safe.right + m.s4,
      }}
    >
      <Bloom />

      {/* THE CLUB HEADS THIS ROOM, AND IT IS DRAWN ABOVE EVERY BRANCH — the
          wall, both empty states and the table alike. Whose season this is
          does not depend on whether there is one yet, and a room that loses
          its own header the moment it has nothing in it reads as a screen that
          failed to load rather than as an empty shelf.

          THE RECORD RIDES AT THE FAR END OF THE MARK'S OWN ROW. It is the one
          fact about a season that is not a number you average, and it belongs
          beside the name for the same reason a competition card carries it in
          the band: it identifies the run rather than describing it. It is NOT
          LIT — a `12-4` is a win and a loss in one string, and colouring it
          would mean choosing which half of a season to shout. */}
      <Row gap={m.s3} align="center">
        <View style={{ flex: 1, minWidth: 0 }}>
          <ClubMark />
        </View>
        {!gated && !!S && S.games > 0 && (
          <Text
            numberOfLines={1}
            style={{
              flexGrow: 0,
              flexShrink: 0,
              ...fNum(600),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {record(S)} · {gamesLabel(S.games)}
          </Text>
        )}
      </Row>

      {gated ? (
        <Col justify="center" style={{ flex: 1 }}>
          <Locked
            gate="season"
            blurb="Every official game added up — the table, the competitions and each player's own season."
          />
        </Col>
      ) : empty || noneOfficial ? (
        <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
          <Text
            style={{
              ...fUi(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {empty ? 'No games yet' : 'No official games yet'}
          </Text>
          <Text
            style={{
              paddingHorizontal: m.s4,
              textAlign: 'center',
              ...fUi(400),
              fontSize: m.fsSm,
              color: t.ink3,
            }}
          >
            {empty
              ? 'End a game and its line is added here.'
              : 'A practice keeps its own box score and stays off the season. Start a game as official and it lands here.'}
          </Text>
        </Col>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: m.s4, paddingBottom: bar + m.s5 }}
        >
          {S && official ? (
            <Col gap={m.s5}>
              {official.length > 0 && <AnalysisRow last={official[0]} />}

              {comps.length > 0 && (
                <Col gap={m.s2}>
                  <SectionLabel>Competitions</SectionLabel>
                  {comps.map((c) => (
                    <CompCard
                      key={c.key}
                      comp={c}
                      onPress={() =>
                        router.push({ pathname: '/competition', params: { key: c.key } })
                      }
                    />
                  ))}
                </Col>
              )}

              {/* THE LIST IS LAST, and it is the longest thing on the screen —
                  which is the other half of why the competitions moved above
                  it. A twenty-row list between two blocks pushes whatever
                  follows it off the bottom of every phone. */}
              <Col gap={m.s2}>
                <SectionLabel>Players</SectionLabel>
                <PlayerList
                  season={S}
                  onPlayerPress={(id) =>
                    router.push({
                      pathname: '/player/[id]',
                      params: { id, games: JSON.stringify(games) },
                    })
                  }
                />
              </Col>
            </Col>
          ) : (
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
              Reading {index.length} game{index.length === 1 ? '' : 's'}…
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
