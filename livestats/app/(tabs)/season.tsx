import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeasonTable } from '../../components/stats/SeasonTable';
import { Band, Card, Seam, Seg, Tile, type SegItem } from '../../components/stats/parts';
import { Col, Row } from '../../components/ui/Row';
import { pct } from '../../lib/format';
import { season, type SeasonMode } from '../../lib/season';
import { efg, ts } from '../../lib/stats';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameState } from '../../types';

const MODES: SegItem<SeasonMode>[] = [
  { key: 'totals', label: 'TOTALS' },
  { key: 'perGame', label: 'PER GAME' },
];

/**
 * THE SEASON — every saved game added up, one row per player.
 *
 * This is the one screen that has to read the full games rather than the index,
 * because a season line is made of stat lines and a summary has none. So it
 * loads all of them once, on mount, and re-loads only when the index changes —
 * thirty rows off AsyncStorage, on a screen nobody opens during a possession.
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
 * The card above it is always TOTALS, whatever the toggle says. A points-per-
 * game tile computed off per-game numbers would divide by the games twice.
 */
export default function SeasonScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const index = useHistoryStore((s) => s.index);
  const loadGame = useHistoryStore((s) => s.loadGame);
  const roster = useRosterStore((s) => s.players);

  const [mode, setMode] = useState<SeasonMode>('totals');
  const [games, setGames] = useState<GameState[] | null>(null);

  // the ids, joined — a stable dependency, so the effect fires when the shelf
  // changes and not when zustand hands back a fresh array of the same games
  const ids = index.map((g) => g.id).join(',');

  useEffect(() => {
    let alive = true;
    setGames(null);
    void Promise.all(index.map((g) => loadGame(g.id))).then((loaded) => {
      // a row that will not parse is dropped rather than zeroing the season
      if (alive) setGames(loaded.filter((g): g is GameState => g !== null));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, loadGame]);

  const S = useMemo(() => (games ? season(games, roster, mode) : null), [games, roster, mode]);
  // the headline card reads the season whole, never the toggle's view of it
  const whole = useMemo(() => (games ? season(games, roster, 'totals') : null), [games, roster]);

  const empty = index.length === 0;

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
        <Col style={{ flexShrink: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fNum(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_BTN),
              color: t.ink,
            }}
          >
            SEASON
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
            {S ? `${S.games} GAME${S.games === 1 ? '' : 'S'} SAVED` : 'READING THE SHELF'}
          </Text>
        </Col>
      </Row>

      {empty ? (
        <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fNum(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            NO GAMES YET
          </Text>
          <Text style={{ fontFamily: fUi(400), fontSize: m.fsSm, color: t.ink3 }}>
            End a game and its line is added here.
          </Text>
        </Col>
      ) : (
        <ScrollView
          style={{ flex: 1, marginTop: m.s3 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: safe.bottom + m.s5 }}
        >
          {S && whole ? (
            <Col gap={m.s3}>
              <Card>
                <Band label="THE SEASON" />
                <Col gap={1} style={{ backgroundColor: t.rule }}>
                  <Seam>
                    <Tile value={whole.games} label="GAMES" />
                    <Tile
                      value={`${whole.wins}-${whole.losses}${whole.draws ? `-${whole.draws}` : ''}`}
                      label="RECORD"
                    />
                    <Tile
                      value={whole.games ? Math.round(whole.team.pts / whole.games) : 0}
                      label="POINTS / GAME"
                    />
                  </Seam>
                  <Seam>
                    <Tile value={pct(whole.team.fgm, whole.team.fga)} label="FG%" />
                    <Tile value={efg(whole.team)} label="EFFECTIVE FG" />
                    <Tile value={ts(whole.team)} label="TRUE SHOOTING" />
                  </Seam>
                </Col>
              </Card>

              <Seg items={MODES} value={mode} onChange={(k) => setMode(k)} />

              <SeasonTable season={S} mode={mode} />
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
