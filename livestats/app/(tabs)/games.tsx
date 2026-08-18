import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../../components/panels/PanelHost';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { HISTORY_CAP, dateLabel, periodsLabel, resultOf, timeLabel, yearLabel } from '../../lib/history';
import { opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameSummary } from '../../lib/history';

/**
 * THE SHELF — every game that has ended, newest first.
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
 */
function Badge({ result }: { result: 'W' | 'L' | 'D' }) {
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

function GameRow({ game }: { game: GameSummary }) {
  const m = useMetrics();
  const t = useTheme();
  const open = useUiStore((s) => s.open);
  const result = resultOf(game);

  return (
    <Press
      onPress={() => router.push(`/history/${game.id}`)}
      onLongPress={() => open({ kind: 'removeGame', gameId: game.id })}
      accessibilityLabel={`${dateLabel(game.endedAt)}, ${result === 'W' ? 'won' : result === 'L' ? 'lost' : 'drew'} ${game.score} to ${game.oppScore}`}
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

      <Col style={{ flexShrink: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fNum(700),
            fontSize: m.fsMd,
            letterSpacing: ls(m.fsMd, LS_LABEL),
            color: t.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {dateLabel(game.endedAt)} {yearLabel(game.endedAt)}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fUi(500), fontSize: m.fsXs, color: t.ink2 }}
        >
          {game.opponent ? `VS ${opponentLabel(game.opponent)} · ` : ''}
          {timeLabel(game.endedAt)} · {periodsLabel(game.periods)}
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

export default function GamesScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

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
          GAMES
        </Text>
        <Text
          style={{
            marginLeft: 'auto',
            flexGrow: 0,
            flexShrink: 0,
            fontFamily: fNum(500),
            fontSize: m.fsMd,
            color: t.ink2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {index.length}/{HISTORY_CAP}
        </Text>
      </Row>

      <FlatList
        data={index}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GameRow game={item} />}
        style={{ flex: 1, marginTop: m.s2 }}
        contentContainerStyle={
          index.length ? { paddingBottom: safe.bottom + m.s5 } : { flexGrow: 1 }
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
              NO GAMES YET
            </Text>
            <Text style={{ fontFamily: fUi(400), fontSize: m.fsSm, color: t.ink3 }}>
              A game lands here the moment you end it.
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
              Long press a game to delete it. The last {HISTORY_CAP} are kept.
            </Text>
          ) : null
        }
      />

      <PanelHost />
    </View>
  );
}
