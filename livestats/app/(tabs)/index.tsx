import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../../components/panels/PanelHost';
import { Btn } from '../../components/panels/shell';
import { Band, Card, Seam } from '../../components/stats/parts';
import { Crest } from '../../components/ui/Crest';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useLastGame } from '../../hooks/useLastGame';
import { mmss, ord, pct } from '../../lib/format';
import { dateLabel, timeLabel } from '../../lib/history';
import { ROSTER_CAP, STARTERS } from '../../lib/roster';
import { opponentLabel } from '../../lib/team';
import { totals } from '../../lib/stats';
import { useGameStore } from '../../store/gameStore';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useTeamStore } from '../../store/teamStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE LOBBY — a team profile, not a menu.
 *
 * Crest, wordmark, gear; then one hero card, the last game's six numbers, and
 * the one or two things a scorer can do. Everything on it is derived —
 * `totals()` and `pct()` over a game state, `index[0]` out of the history —
 * and nothing on it is stored twice.
 *
 * IT FITS IN ONE WINDOW, and that is why the roster list is not on it. A
 * preview of eight rows, the FINAL STATS and MY TEAM buttons and the running
 * availability count were four blocks whose only job was to point somewhere a
 * tab already points, and together they pushed the screen past the fold. The
 * `ScrollView` stays as the small-window safety net, not as the design.
 *
 * THE HERO CARD HAS THREE STATES AND IS ONE COMPONENT. Empty is not a different
 * screen with a different shape; it is the same card saying what it has, which
 * is nothing yet. The mockup only ever drew the third.
 *
 * ACCENT IS SPENT ON TWO THINGS HERE and no others: the primary button, and our
 * own score. Not the crest ring, not the roster count, not the jerseys, not the
 * pills. On the board `accent` means the primary action or a made shot, and a
 * screen that paints nine things with it has taught the eye to ignore all nine.
 *
 * Layout is keyed on WIDTH, not orientation — this is not the board, and a
 * tablet in portrait is wide enough for a six-across strip whichever way it is
 * held. The column itself is capped at that same line.
 *
 * `Band` / `Card` / `Seam` come from the stats screen's furniture rather than
 * being redrawn here, and every one of the pieces below is module-level: a
 * component declared inside `LobbyScreen` would be a new type on every render,
 * and a running clock would remount the whole page once a second.
 */

/** Six-across from here up, and the column's own cap. The same line
 *  `team.tsx` and `RotateGate` draw. */
const TWO_UP = 700;

/* ---- the pieces ---------------------------------------------------- */

function Label({ children, tone }: { children: ReactNode; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: fNum(500),
        fontSize: m.fsXs,
        letterSpacing: ls(m.fsXs, LS_LABEL),
        color: tone ?? t.ink2,
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

/**
 * One side of the scoreline: whose it is, the number, and the pill under it.
 *
 * The pill is `surface2` on both sides. The mockup gives US an accent fill, and
 * that is one of the nine places the accent stopped meaning anything — the
 * SCORE already says which side is ours, and it says it in the one ink the eye
 * has been trained to read as ours.
 */
function Side({ title, value, pill, tone }: { title: string; value: number; pill: string; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Col
      align="center"
      gap={m.s2}
      style={{ flex: 1, minWidth: 0, paddingVertical: m.s4, backgroundColor: t.surface }}
    >
      <Label>{title}</Label>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: m.fs3xl,
          lineHeight: m.fs3xl * 1.08,
          color: tone ?? t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <View
        style={{
          flexGrow: 0,
          flexShrink: 0,
          borderRadius: 99,
          paddingVertical: 2,
          paddingHorizontal: m.s3,
          backgroundColor: t.surface2,
        }}
      >
        <Label>{pill}</Label>
      </View>
    </Col>
  );
}

/** A cell of the LAST GAME strip. Opaque and edgeless — it lives in a `Seam`. */
function Stat({ value, label }: { value: string | number; label: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Col
      align="center"
      justify="center"
      gap={2}
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: m.s3,
        paddingHorizontal: m.s1,
        backgroundColor: t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: m.fsXl,
          lineHeight: m.fsXl * 1.1,
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fUi(600),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
    </Col>
  );
}

/* ---- the screen ----------------------------------------------------- */

export default function LobbyScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const roster = useRosterStore((s) => s.players);
  // THE HEADER IS THE CLUB AS IT IS TODAY; the hero's scoreline is the game as
  // it was played, so the two names come from two different places on purpose
  const club = useTeamStore((s) => s.profile);
  const team = useGameStore((s) => s.team.name);
  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  // the live game's opponent; a finished one carries its own
  const oppName = useGameStore((s) => s.opponent);
  const period = useGameStore((s) => s.period);
  const remaining = useGameStore((s) => s.remaining);
  const running = useGameStore((s) => s.running);
  const ended = useGameStore((s) => s.ended);
  const played = useGameStore((s) => s.events.length > 0);
  const open = useUiStore((s) => s.open);

  const last = useLastGame();
  // the newest summary is what dates a saved game — the state itself does not
  // carry a date, because a game does not know when it was put on the shelf
  const newest = useHistoryStore((s) => s.index[0]);

  const inProgress = played && !ended;
  const available = roster.filter((p) => p.available);
  const enough = available.length >= STARTERS;
  const wide = m.win.w >= TWO_UP;

  // the six numbers are the LAST FINISHED game's, whichever copy that is —
  // never the live one, which would read as a final line for a game still on
  const T = last ? totals(last.state.players) : null;

  const newGame = () => {
    // losing a live game to a mis-tap is the worst thing this screen can do
    if (inProgress) open({ kind: 'newGame' });
    else router.push('/start');
  };

  const crestSize = Math.round(m.fsXl * 1.9);

  /* -- the hero, three states, one card -- */
  const hero = (
    <Card>
      {inProgress ? (
        <Band
          label="LIVE"
          tone={t.accent}
          note={
            <Row gap={m.s2}>
              {/* the live dot borrows the court's mark colour — the one hue the
                  palette spends nowhere else, and it already means "now" */}
              {running && (
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    flexGrow: 0,
                    flexShrink: 0,
                    backgroundColor: t.mark,
                  }}
                />
              )}
              <Label>
                {ord(period).toUpperCase()} · {mmss(remaining)}
              </Label>
            </Row>
          }
        />
      ) : last ? (
        <Band
          label="FINAL"
          note={
            <Label>
              {last.live || !newest
                ? `${ord(last.state.period).toUpperCase()} · ${mmss(last.state.remaining)}`
                : `${dateLabel(newest.endedAt)} · ${timeLabel(newest.endedAt)}`}
            </Label>
          }
        />
      ) : (
        <Band label="NO GAME YET" />
      )}

      {inProgress || last ? (
        <Seam>
          <Side
            title={team.toUpperCase()}
            value={inProgress ? score : last!.state.score}
            pill="US"
            tone={t.accent}
          />
          <Side
            title={opponentLabel(inProgress ? oppName : last!.state.opponent)}
            value={inProgress ? oppScore : last!.state.oppScore}
            pill="THEM"
          />
        </Seam>
      ) : (
        <Col align="center" gap={m.s2} style={{ paddingVertical: m.s6, paddingHorizontal: m.s4 }}>
          <Text
            numberOfLines={2}
            style={{
              textAlign: 'center',
              fontFamily: fNum(700),
              fontSize: m.fsXl,
              lineHeight: m.fsXl * 1.2,
              letterSpacing: ls(m.fsXl, LS_BTN),
              color: t.ink,
            }}
          >
            START YOUR FIRST GAME
          </Text>
          <Label>
            {roster.length}/{ROSTER_CAP} PLAYERS
          </Label>
        </Col>
      )}
    </Card>
  );

  /* -- the last game's six numbers. Hidden outright when there is no
        finished game: six zeros would read as a game that went badly. -- */
  const strip = T && (
    <Card>
      <Band label="LAST GAME" />
      {wide ? (
        <Seam>
          <Stat value={T.pts} label="POINTS" />
          <Stat value={pct(T.fgm, T.fga)} label="FG%" />
          <Stat value={pct(T.ftm, T.fta)} label="FT%" />
          <Stat value={T.reb} label="REBOUNDS" />
          <Stat value={T.ast} label="ASSISTS" />
          <Stat value={T.to} label="TURNOVERS" />
        </Seam>
      ) : (
        <Col gap={1} style={{ backgroundColor: t.rule }}>
          <Seam>
            <Stat value={T.pts} label="POINTS" />
            <Stat value={pct(T.fgm, T.fga)} label="FG%" />
            <Stat value={pct(T.ftm, T.fta)} label="FT%" />
          </Seam>
          <Seam>
            <Stat value={T.reb} label="REBOUNDS" />
            <Stat value={T.ast} label="ASSISTS" />
            <Stat value={T.to} label="TURNOVERS" />
          </Seam>
        </Col>
      )}
    </Card>
  );

  /* -- the verbs. The primary is whichever one the hero is about.

        FINAL STATS and MY TEAM are deliberately NOT here: both are one tap
        away on a tab, and the lobby's rule is that it fits in one screen. -- */
  const buttons: ReactNode[] = [];
  if (inProgress)
    buttons.push(
      <Btn key="resume" label="RESUME GAME" variant="accent" onPress={() => router.push('/game')} />,
    );
  buttons.push(
    <Btn
      key="new"
      label="NEW GAME"
      variant={inProgress ? 'surface' : 'accent'}
      disabled={!enough}
      onPress={newGame}
    />,
  );

  const actions = (
    <Col gap={m.s2}>
      {wide ? (
        <Row align="stretch" gap={m.s2}>
          {buttons}
        </Row>
      ) : (
        <Col align="stretch" gap={m.s2}>
          {buttons.map((b, i) => (
            <Row key={i} align="stretch">
              {b}
            </Row>
          ))}
        </Col>
      )}
      {/* only the WARNING survives — it is why NEW GAME is dark. A count
          nobody has to act on was a row the screen could not spare. */}
      {!enough && (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            textAlign: 'center',
            fontFamily: fNum(500),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.danger,
            fontVariant: ['tabular-nums'],
          }}
        >
          NEED AT LEAST {STARTERS} AVAILABLE PLAYERS
        </Text>
      )}
    </Col>
  );

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
      {/* ---- identity ------------------------------------------------ */}
      <Row gap={m.s2} style={{ flexGrow: 0, flexShrink: 0, minHeight: m.tap }}>
        {/* the whole block is the way into the club, because the crest is the
            thing a scorer reaches for when they want to change the crest */}
        <Press
          onPress={() => open({ kind: 'editTeam' })}
          accessibilityLabel="edit team"
          style={{
            flexShrink: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: m.s3,
            paddingRight: m.s2,
            borderRadius: m.rSm,
          }}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          <Crest name={club.name} uri={club.logoUri} size={crestSize} />

          <Col style={{ flexShrink: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(700),
                fontSize: m.fsXl,
                lineHeight: m.fsXl * 1.15,
                letterSpacing: ls(m.fsXl, LS_BTN),
                color: t.ink,
              }}
            >
              HOOPLOG
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fUi(500), fontSize: m.fsXs, color: t.ink2 }}
            >
              {club.name.toUpperCase()}
              {club.coach ? ` · ${club.coach}` : ''}
            </Text>
          </Col>
        </Press>

        <Press
          onPress={() => open({ kind: 'settings' })}
          accessibilityLabel="settings"
          style={{
            marginLeft: 'auto',
            flexGrow: 0,
            flexShrink: 0,
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
              d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
              stroke={t.ink2}
              strokeWidth={1.8}
              fill="none"
            />
            <Path
              d="M19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L15 3.5H9.9l-.3 2.6a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L5.5 11a7.6 7.6 0 000 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 001.7 1l.3 2.6H15l.3-2.6a7.6 7.6 0 001.7-1l2.4 1 2-3.4-2-1.5z"
              stroke={t.ink2}
              strokeWidth={1.8}
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Press>
      </Row>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, marginTop: m.s3 }}
        contentContainerStyle={{ paddingBottom: safe.bottom + m.s5, alignItems: 'center' }}
      >
        {/* ONE COLUMN, and it fits. The roster list is gone from here — it is
            a tab of its own, and it was the only block that made this screen
            taller than the window. Capped at the two-up line rather than run
            full width, or a tablet draws a scoreline a foot across. */}
        <Col gap={m.s3} style={{ width: '100%', maxWidth: TWO_UP }}>
          {hero}
          {strip}
          {actions}
        </Col>
      </ScrollView>

      <PanelHost />
    </View>
  );
}
