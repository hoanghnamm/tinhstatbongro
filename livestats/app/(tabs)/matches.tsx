import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../../components/panels/PanelHost';
import { Bloom } from '../../components/ui/Bloom';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useTabInset } from '../../hooks/useTabInset';
import { HISTORY_CAP, dayMonthLabel, resultOf, summaryKind } from '../../lib/history';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, LS_TIGHT, LS_TITLE, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameSummary } from '../../lib/history';

/**
 * THE SHELF — every match that has ended, newest first.
 *
 * IT IS CALLED MATCHES, and the room is the tab of that name. A "game" is what
 * the board is keeping and what `GameState` is a state of; a MATCH is one of
 * them, over, on a shelf. The types keep the old word because they are the old
 * thing — only the room the scorer walks into is renamed.
 *
 * The list reads the INDEX and nothing else: a summary is five numbers, thirty
 * of them are nothing, and the events — which are the bulk of a game by two
 * orders of magnitude — stay on disk until a row is actually tapped. That split
 * is the whole storage design; see `lib/history.ts`.
 *
 * THE WIN/LOSS BADGE IS NOT GREEN AND RED. `accent` marks a win and `ink2` a
 * loss, because `danger` on this board means "this will destroy something" and
 * a game you lost is not an error. A draw takes `ink2` too and says D.
 *
 * Deleting is a LONG PRESS, and it confirms. A swipe would need a gesture
 * handler and a second interaction vocabulary for one destructive action that
 * already has a confirm panel waiting for it.
 *
 * IT IS DRAWN ON BLACK, like the other three rooms, and it says so NOWHERE:
 * the palette is the group's and is declared once in `app/(tabs)/_layout.tsx`.
 * All this screen adds is the `<Bloom />` — the warm corner every room shares —
 * and even that is a component rather than a gradient written out here. The
 * rows themselves are unchanged: they ask for `surface`, `rule` and `ink2`
 * exactly as they did on the light skin, and the answers happen to be
 * translucent white now.
 */
function Badge({ result }: { result: 'W' | 'L' }) {
  const m = useMetrics();
  const t = useTheme();
  const d = Math.round(m.fsXl * 1.15);
  const win = result === 'W';
  return (
    <View
      style={{
        width: d,
        height: d,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: m.rSm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: win ? t.accent : t.surface2,
        borderWidth: win ? 0 : 1,
        borderColor: t.rule,
      }}
    >
      <Text
        style={{
          fontFamily: fNum(700),
          fontSize: m.fsMd,
          color: win ? t.accentInk : t.ink2,
        }}
      >
        {result}
      </Text>
    </View>
  );
}

/**
 * ONE ROW — and its TITLE IS WHAT THE MATCH WAS: the competition on an official
 * game, the word PRACTICE on a practice, UNFILED on an official game saved
 * before competitions existed.
 *
 * The date used to be the title and the kind used to be a pill beside it. That
 * had the shelf scanned by a number nobody remembers a match by — the eye
 * looking for "the cup game" was reading thirty dates to find it. So the name
 * takes the line and the date drops to the subtitle as `19/08`, which is where
 * the opponent already was.
 */
function GameRow({ game }: { game: GameSummary }) {
  const m = useMetrics();
  const t = useTheme();
  const open = useUiStore((s) => s.open);
  const result = resultOf(game);
  const practice = summaryKind(game) === 'practice';
  const title = practice ? 'PRACTICE' : competitionLabel(game.competition);

  return (
    <Press
      onPress={() => router.push(`/history/${game.id}`)}
      onLongPress={() => open({ kind: 'removeGame', gameId: game.id })}
      accessibilityLabel={`${title.toLowerCase()}, ${dayMonthLabel(game.endedAt)}, ${result === 'W' ? 'won' : 'lost'} ${game.score} to ${game.oppScore}`}
      style={{
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.s3,
        paddingHorizontal: m.s3,
        paddingVertical: m.s2,
        borderBottomWidth: 1,
        borderBottomColor: t.rule,
        backgroundColor: t.surface,
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      <Badge result={result} />

      <Col style={{ flexShrink: 1, minWidth: 0 }} align="flex-start">
        <Text
          numberOfLines={1}
          style={{
            maxWidth: '100%',
            fontFamily: fNum(700),
            fontSize: m.fsMd,
            letterSpacing: ls(m.fsMd, LS_LABEL),
            color: practice ? t.ink2 : t.ink,
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fUi(500), fontSize: m.fsXs, color: t.ink2 }}
        >
          {game.opponent ? `VS ${opponentLabel(game.opponent)} · ` : ''}
          {dayMonthLabel(game.endedAt)}
        </Text>
      </Col>

      <Text
        numberOfLines={1}
        style={{
          marginLeft: 'auto',
          flexGrow: 0,
          flexShrink: 0,
          fontFamily: fNum(700),
          fontSize: m.fsXl,
          letterSpacing: ls(m.fsXl, LS_TIGHT),
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {game.score} — {game.oppScore}
      </Text>

      <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
        <Path
          d="M9 5l7 7-7 7"
          stroke={t.ink3}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Press>
  );
}

export default function MatchesScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

  const index = useHistoryStore((s) => s.index);

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
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fNum(700),
            fontSize: m.fsXl,
            letterSpacing: ls(m.fsXl, LS_TITLE),
            color: t.ink,
          }}
        >
          MATCHES
        </Text>
      </Row>

      <FlatList
        data={index}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GameRow game={item} />}
        style={{ flex: 1, marginTop: m.s2 }}
        contentContainerStyle={
          index.length ? { paddingBottom: bar + m.s5 } : { flexGrow: 1 }
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fNum(500),
                fontSize: m.fsMd,
                letterSpacing: ls(m.fsMd, LS_LABEL),
                color: t.ink3,
              }}
            >
              NO MATCHES YET
            </Text>
            <Text style={{ fontFamily: fUi(400), fontSize: m.fsSm, color: t.ink3 }}>
              A match lands here the moment you end it.
            </Text>
          </Col>
        }
        ListFooterComponent={
          index.length ? (
            <Text
              style={{
                paddingVertical: m.s3,
                textAlign: 'center',
                fontFamily: fUi(400),
                fontSize: m.fsXs,
                color: t.ink3,
              }}
            >
              Long press a match to delete it. The last {HISTORY_CAP} are kept.
            </Text>
          ) : null
        }
      />

      <PanelHost />
    </View>
  );
}
