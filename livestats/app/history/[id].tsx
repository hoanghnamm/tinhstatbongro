import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BoxScore } from '../../components/panels/BoxScore';
import { PlaysList } from '../../components/panels/PlaysList';
import { Card, Seg, type SegItem } from '../../components/stats/parts';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { dateLabel, periodsLabel, timeLabel, yearLabel } from '../../lib/history';
import { opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { GameState } from '../../types';

type View_ = 'box' | 'plays';

const VIEWS: SegItem<View_>[] = [
  { key: 'box', label: 'BOX SCORE' },
  { key: 'plays', label: 'PLAY BY PLAY' },
];

/**
 * ONE SAVED GAME — and not one line of it is new.
 *
 * The box score is `BoxScore`, the same component the board's totals panel
 * renders over the live game, and the log is `PlaysList`, the same rows the
 * plays panel shows. Both take their data as props precisely so this screen can
 * hand them a game read off disk; a saved game and a live one are the same
 * shape, so a second table here would only be the one that drifts.
 *
 * It is outside the tab group on purpose. This is a place you go INTO from the
 * GAMES list and come back out of, so it gets a back button and the full window
 * rather than a tab bar that would suggest it is a fifth room.
 *
 * The game loads asynchronously, so there are three states and all three are
 * said out loud: reading, gone, and here. A row that will not parse is a game
 * that cannot be reopened, and the honest thing is to say so rather than to
 * render a box score of zeros.
 */
export default function SavedGameScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useHistoryStore((s) => s.index.find((g) => g.id === id));
  const loadGame = useHistoryStore((s) => s.loadGame);

  const [view, setView] = useState<View_>('box');
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
          accessibilityLabel="back to games"
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
            {summary ? `${dateLabel(summary.endedAt)} ${yearLabel(summary.endedAt)}` : 'GAME'}
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
            {summary
              ? `${summary.opponent ? `VS ${opponentLabel(summary.opponent)} · ` : ''}${timeLabel(summary.endedAt)} · ${periodsLabel(summary.periods)}`
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
          <Row gap={m.s2} style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
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
            <Text style={{ fontFamily: fNum(500), fontSize: m.fsMd, color: t.ink3 }}>:</Text>
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
          </Row>
        )}
      </Row>

      <View style={{ marginTop: m.s2, flexGrow: 0, flexShrink: 0 }}>
        <Seg items={VIEWS} value={view} onChange={(k) => setView(k)} />
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: m.s3 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: m.s5 }}
      >
        {game ? (
          view === 'box' ? (
            <BoxScore g={game} />
          ) : (
            <Card>
              <PlaysList events={game.events} players={game.players} />
            </Card>
          )
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
            {missing ? 'THIS GAME IS NO LONGER ON THE SHELF' : 'READING…'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
