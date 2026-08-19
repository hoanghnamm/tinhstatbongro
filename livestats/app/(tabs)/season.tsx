import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeasonTable } from '../../components/stats/SeasonTable';
import { Band, Seam, Seg, Tile, type SegItem } from '../../components/stats/parts';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useSavedGames } from '../../hooks/useSavedGames';
import {
  competitions,
  officialIn,
  season,
  type CompetitionSeason,
  type Season,
  type SeasonMode,
} from '../../lib/season';
import { competitionLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const MODES: SegItem<SeasonMode>[] = [
  { key: 'totals', label: 'TOTALS' },
  { key: 'perGame', label: 'PER GAME' },
];

const gamesLabel = (n: number): string => `${n} GAME${n === 1 ? '' : 'S'}`;

/** `4-2` win-loss record. */
const record = (s: Season): string => `${s.wins}-${s.losses}`;

/**
 * A TEAM AVERAGE, to one decimal.
 *
 * One decimal and not none: 68 and 68.4 points a game are the same number to a
 * reader, and the difference between two competitions is often the tenth. The
 * whole-season card above rounds whole because it is a headline and has no
 * second card to be compared with.
 */
const avg = (total: number, games: number): number =>
  games ? Math.round((total / games) * 10) / 10 : 0;

/**
 * ONE COMPETITION, AS THREE NUMBERS.
 *
 * The header is the whole answer to "which run of games is this and how many
 * of them": the COUNT sits at the left, where the eye already is, and the NAME
 * at the right, because a name is what you read once to identify a card and a
 * count is what you compare between them. It is `Band`, the same strip every
 * card on this screen wears — a heading of its own here would be a second kind
 * of card header for no reason.
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
 */
function CompCard({ comp, onPress }: { comp: CompetitionSeason; onPress(): void }) {
  const m = useMetrics();
  const t = useTheme();
  const S = comp.season;
  const name = competitionLabel(comp.name);

  return (
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
              fontFamily: fNum(700),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_LABEL),
              color: t.ink,
            }}
          >
            {name}
          </Text>
        }
      />
      <Seam>
        <Tile value={avg(S.team.pts, S.games)} label="POINTS" />
        <Tile value={avg(S.team.reb, S.games)} label="REBOUNDS" />
        <Tile value={avg(S.team.ast, S.games)} label="ASSISTS" />
      </Seam>
    </Press>
  );
}

/**
 * THE SEASON — every OFFICIAL game added up, one row per player.
 *
 * This is the one tab that has to read the full games rather than the index,
 * because a season line is made of stat lines and a summary has none. So it
 * loads all of them once, through `useSavedGames`, and re-loads only when the
 * index changes — thirty rows off AsyncStorage, on a screen nobody opens
 * during a possession.
 *
 * A PRACTICE IS NOT IN ANY OF THIS. It is a real game with a real box score
 * and it is on the shelf and it opens; it is simply not what a season is made
 * of, which is exactly what the scorer said when they tapped PRACTICE at the
 * door. NOTHING ON THE SCREEN COUNTS THE ONES LEFT OUT: the number of games
 * that are not on a screen is not a fact about the screen, and the empty state
 * is where the rule is said out loud instead.
 *
 * PER GAME DIVIDES BY GAMES THE PLAYER APPEARED IN, not by games in the season.
 * A twelfth man who turned up twice averages over two; the other reading
 * punishes a player for the nights the team played without them. `lib/season.ts`
 * owns that rule and `npm run check` asserts it.
 *
 * The table is `BoxTable`, the same component the stats screen renders for one
 * game: a season line and a game line are the same twenty columns over the same
 * `Player[]`, which is why the aggregate is built as players rather than as a
 * shape of its own.
 *
 * THE SEASON'S OWN SIX NUMBERS ARE NOT ON THIS SCREEN ANY MORE — they are the
 * card on the LOBBY. They were a headline over a table, and a headline belongs
 * on the screen the app opens on rather than on the one you come to when you
 * already want the detail. Nothing heads this screen but the word SEASON.
 *
 * SO THE FIRST THING ON IT IS THE COMPETITIONS, one card each, and with no
 * BY COMPETITION heading over them: a heading over the first thing on a screen
 * names what the eye has already read. They are the
 * same numbers cut the way a scorer keeps them — a league run is a thing you
 * are having a good or a bad one of, and the whole-season line answers a
 * different question. Each card is a way in to its own page.
 */
export default function SeasonScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const index = useHistoryStore((s) => s.index);
  const roster = useRosterStore((s) => s.players);
  const games = useSavedGames();

  const [mode, setMode] = useState<SeasonMode>('totals');

  // the season is the official games, and the split is made here rather than
  // inside `season()` — one competition's page filters first and aggregates the
  // same way, so the filter belongs to the caller
  const official = useMemo(() => (games ? officialIn(games) : null), [games]);

  const S = useMemo(() => (official ? season(official, roster, mode) : null), [official, roster, mode]);
  const comps = useMemo(() => (official ? competitions(official, roster) : []), [official, roster]);

  const empty = index.length === 0;
  const noneOfficial = !!official && official.length === 0;

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
      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fNum(700),
            fontSize: m.fsXl,
            letterSpacing: ls(m.fsXl, LS_BTN),
            color: t.ink,
          }}
        >
          SEASON
        </Text>
      </Row>

      {empty || noneOfficial ? (
        <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fNum(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {empty ? 'NO GAMES YET' : 'NO OFFICIAL GAMES YET'}
          </Text>
          <Text
            style={{
              paddingHorizontal: m.s4,
              textAlign: 'center',
              fontFamily: fUi(400),
              fontSize: m.fsSm,
              color: t.ink3,
            }}
          >
            {empty
              ? 'End a game and its line is added here.'
              : 'A practice keeps its own box score and stays off the season. Start a game as OFFICIAL and it lands here.'}
          </Text>
        </Col>
      ) : (
        <ScrollView
          style={{ flex: 1, marginTop: m.s3 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: safe.bottom + m.s5 }}
        >
          {S ? (
            <Col gap={m.s3}>
              {comps.length > 0 && (
                <Col gap={m.s2}>
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

              <Seg items={MODES} value={mode} onChange={(k) => setMode(k)} />

              <SeasonTable
                season={S}
                mode={mode}
                onPlayerPress={(id) =>
                  router.push({
                    pathname: '/player/[id]',
                    params: { id, games: JSON.stringify(official) },
                  })
                }
              />
            </Col>
          ) : (
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
              READING {index.length} GAME{index.length === 1 ? '' : 'S'}…
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
