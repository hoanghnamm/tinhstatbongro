import { useMemo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelHost } from '../../components/panels/PanelHost';
import { Btn } from '../../components/panels/shell';
import { Band, Card, Seam } from '../../components/stats/parts';
import { Bloom } from '../../components/ui/Bloom';
import { Crest } from '../../components/ui/Crest';
import { Press } from '../../components/ui/Press';
import { Slug } from '../../components/ui/Slug';
import { Col, Row } from '../../components/ui/Row';
import { useLastGame } from '../../hooks/useLastGame';
import { useTabInset } from '../../hooks/useTabInset';
import { useSavedGames } from '../../hooks/useSavedGames';
import { mmss, ord, pct } from '../../lib/format';
import { ROSTER_CAP, STARTERS } from '../../lib/roster';
import { officialIn, season } from '../../lib/season';
import { opponentLabel } from '../../lib/team';
import { efg, totals, ts } from '../../lib/stats';
import { useGameStore } from '../../store/gameStore';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useTeamStore } from '../../store/teamStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import {
  LS_LABEL,
  LS_MICRO,
  LS_TIGHT,
  LS_TITLE,
  fDisplay,
  fNum,
  fUi,
  ls,
  withAlpha,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE LOBBY — a team profile, not a menu.
 *
 * Crest and wordmark, then the club's own headline; then the LIVE game if there
 * is one with the way back into it, the last game's six numbers, the season's
 * six, and NEW GAME at the foot with GAME SETTINGS under it. Everything on it is
 * derived — the live score straight off `gameStore`,
 * `totals()` over the last finished game, `season()` over the saved ones — and
 * nothing on it is stored twice.
 *
 * THE LAST GAME'S SCORELINE IS NOT HERE, though its stat line is. The scoreline
 * was the hero's FINAL state, and a card that carries a finished score is one
 * the eye reads as the live one whenever there IS a live one. Its numbers stay,
 * as the LAST GAME strip; the score itself lives on the MATCHES shelf and on the
 * game's own stats screen.
 *
 * IT FITS IN ONE WINDOW DOWN TO THE VERBS, and that is why the roster list is
 * not on it. A preview of eight rows, the FINAL STATS and MY TEAM buttons and
 * the running availability count were four blocks whose only job was to point
 * somewhere a tab already points, and together they pushed the screen past the
 * fold. The `ScrollView` stays as the small-window safety net, not as the
 * design.
 *
 * THE SEASON CARD IS THE ONE BLOCK BELOW THE BUTTONS, and it is there on
 * purpose. It moved here off the STATS tab, where it sat above a table nobody
 * reads during a possession; on the lobby it is the line a scorer actually
 * opens the app to see. Putting it UNDER the verbs is what keeps the rule
 * intact — NEW GAME does not move, and the thing that may fall past the fold on
 * a short phone is six numbers you scroll to rather than the button you came
 * for. It is a way into the STATS tab, the way the identity block is a way into
 * TEAM.
 *
 * IT IS THE OFFICIAL GAMES, like everything else that says "season" — a
 * practice keeps its box score and stays out of this. Reading them costs the
 * lobby every saved game off disk, which is the one thing the two-key storage
 * shape was meant to avoid on this screen; it is a single pass on mount, off
 * the render path, and the card simply is not drawn until it lands.
 *
 * THE HERO IS THE LIVE GAME AND ONLY THAT, so most of the time there is no
 * hero at all — a shelf full of games and nothing on the board is an ordinary
 * Tuesday and the screen says so by being short. The onboarding card stands in
 * on a fresh install, where there is neither a board nor a shelf.
 *
 * CONTINUE GAME rides with the scoreline; NEW GAME is the last VERB on the
 * screen, always, and it does not move between the two states — it only drops
 * from `accent` to `surface` while a game is on, and goes through the confirm
 * panel so a mis-tap cannot throw a live game away.
 *
 * GAME SETTINGS SITS UNDER IT AT THE LIGHTEST WEIGHT `Btn` HAS, and it is what
 * replaced the gear that used to float in this screen's top-right corner. A
 * settings list is read, compared and scrolled, which is a page rather than a
 * panel — see `app/settings.tsx` — and the way into a page is a named verb, not
 * a glyph in a circle.
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

/*
 * THE CIRCULAR GLASS CONTROL IS GONE, and `IconBtn` with it.
 *
 * It was the one piece of glass on this screen — a `BlurView` clipped to a
 * circle in the top-right corner, holding a gear — and it was the only control
 * in the app whose entire label was a glyph. What it opened is a full page now
 * (`app/settings.tsx`), reached by a NAMED verb at the foot of this screen,
 * directly under NEW GAME. A settings list is read and scrolled, which is a
 * page, and the way into it is a word.
 *
 * The `expo-blur` dependency did not leave with it: `Card`'s `glass` variant is
 * still the lobby's alone and is still the reason the bloom is worth drawing.
 */

/**
 * The club name at headline size, in TWO TONES.
 *
 * The reference sets "Professional **Match** Insights" with the weight of the
 * sentence on one word and the rest stepped back a tone, which is what stops a
 * three-word headline from reading as three equal shouts. The rule here is the
 * generic form of that: every word but the LAST is `ink2`, the last is `ink`.
 * `KHANH HOA Warriors` lands the emphasis on the noun, which is the half of a
 * club's name that is actually its name — and a single-word club simply gets a
 * white headline, with no special case needed.
 *
 * It is `numberOfLines={2}` and not one: club names are long, this is the
 * biggest type on the screen, and a name that will not fit on one line should
 * wrap rather than turn into an ellipsis. Two is the budget the one-window rule
 * can afford.
 *
 * AND IT IS THE MARK'S FACE, NOT THE BODY'S — `fDisplay`, in caps, lit by an
 * accent glow, under a three-point accent slug. This block is the one thing on
 * the lobby that is not information: it is the club saying who it is, and it
 * was set in the same Helvetica as the numbers under it, at a size the numbers
 * beat, with nothing on it but two greys. The face, the slug and the glow are
 * the three things that make it read as an identity rather than as a caption.
 */
function Headline({ text }: { text: string }) {
  const m = useMetrics();
  const t = useTheme();
  const words = text.trim().split(/\s+/);
  const head = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1] ?? '';
  const fs = m.fs3xl;

  return (
    <>
      {/* the accent rule over the name — see `components/ui/Slug`, which owns
          the whole of the argument for it being there and for it being a
          component rather than three lines of style on this screen */}
      <View style={{ marginTop: m.s4 }}>
        <Slug />
      </View>

      <Text
        numberOfLines={2}
        style={{
          marginTop: m.s2,
          // THE MARK'S FACE, set in CAPS — see `fDisplay`. Anton is condensed,
          // so the step UP to `fs3xl` costs the screen nothing: a club name
          // that took two lines of Helvetica at `fs2xl` takes one of these, and
          // the leading is pulled in to 0.92 because a display face stacked at
          // body leading reads as two separate lines rather than as a block.
          fontFamily: fDisplay(),
          fontSize: fs,
          lineHeight: fs * 0.92,
          // CAPS, always. Anton has a lowercase and it is not what it is for:
          // the mark is a block of capitals, and a club typed in sentence case
          // on the TEAM tab must still arrive here as one.
          textTransform: 'uppercase',
          letterSpacing: ls(fs, LS_TITLE),
          // AND IT IS LIT. The glow is the bloom arriving on the one piece of
          // type the bloom is behind: a warm halo at 40%, no offset, so it
          // reads as light coming off the letters rather than as a drop shadow
          // under them. It is the only text shadow in the app, and it is here
          // because this is the only text that is a MARK.
          textShadowColor: withAlpha(t.accent, 0.4),
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 22,
          color: t.ink,
        }}
      >
        {!!head && <Text style={{ color: t.ink2 }}>{head} </Text>}
        {tail}
      </Text>
    </>
  );
}

function Label({ children, tone }: { children: ReactNode; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: fNum(500),
        fontSize: m.fsXs,
        letterSpacing: ls(m.fsXs, LS_MICRO),
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
          letterSpacing: ls(m.fs3xl, LS_TIGHT),
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

/** A cell of the LAST GAME and THE SEASON strips. Opaque and edgeless — it
 *  lives in a `Seam`, and the seam is the 1px of parent showing between two. */
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
          letterSpacing: ls(m.fsXl, LS_TIGHT),
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
          // THE LIGHT HALF OF THE PAIR. The number above is Bold and set
          // tight; this is Regular, set wide and dim. Two weights apart is
          // what makes the figure the thing you read and the word under it a
          // legend — at the same weight the cell reads as two lines of prose.
          fontFamily: fUi(400),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
    </Col>
  );
}

/**
 * THE SEASON'S SIX NUMBERS — the card that used to head the STATS tab.
 *
 * The same six, in the same order, out of the same `season()` call: games,
 * record and points a game, then the three shooting numbers. It reads TOTALS
 * whatever anyone's toggle says, because points per game computed off per-game
 * numbers divides by the games twice.
 *
 * It presses on OPACITY rather than on a fill, for the reason a competition
 * card does: the cells are opaque so their 1px seams can show, and a background
 * change under them is visible nowhere but the edges.
 */
function SeasonCard({
  games,
  record,
  ppg,
  fg,
  efgv,
  tsv,
  wide,
  onPress,
}: {
  games: number;
  record: string;
  ppg: number;
  fg: string;
  efgv: string;
  tsv: string;
  wide: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  const cells = [
    <Stat key="g" value={games} label="GAMES" />,
    <Stat key="r" value={record} label="RECORD" />,
    <Stat key="p" value={ppg} label="POINTS / GAME" />,
    <Stat key="fg" value={fg} label="FG%" />,
    <Stat key="efg" value={efgv} label="EFFECTIVE FG" />,
    <Stat key="ts" value={tsv} label="TRUE SHOOTING" />,
  ];

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`the season, ${games} game${games === 1 ? '' : 's'}, open the stats tab`}
      style={{
        borderWidth: 1,
        borderColor: t.rule,
        borderRadius: m.r,
        overflow: 'hidden',
        backgroundColor: t.surface,
      }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Band label="THE SEASON" />
      {wide ? (
        <Seam>{cells}</Seam>
      ) : (
        <Col gap={1} style={{ backgroundColor: t.rule }}>
          <Seam>{cells.slice(0, 3)}</Seam>
          <Seam>{cells.slice(3)}</Seam>
        </Col>
      )}
    </Press>
  );
}

/* ---- the screen ----------------------------------------------------- */

function LobbyScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

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

  // the LAST FINISHED game, wherever it is living — `gameStore` while it is
  // still the one on the board, `historyStore` once a new game has replaced it
  const last = useLastGame();
  const savedCount = useHistoryStore((s) => s.index.length);

  // THE SEASON, which is the one thing on this screen that is not free: it
  // opens every saved game. The memo is what keeps the aggregate off the clock
  // — this screen re-renders once a second while a game is live, and
  // `useSavedGames` hands back the same array until the shelf itself changes.
  const saved = useSavedGames();
  const S = useMemo(() => {
    const official = saved ? officialIn(saved) : null;
    return official && official.length ? season(official, roster, 'totals') : null;
  }, [saved, roster]);

  const inProgress = played && !ended;
  // a board with nothing on it and a shelf with nothing on it: the one state
  // that gets the onboarding card, and it is true exactly once per install
  const nothingYet = !played && savedCount === 0;
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


  /* -- THE HERO IS THE LIVE GAME, and now it is only that.

        The FINAL state is cut. One card carrying a scoreline is unambiguous;
        the same card carrying either a live score or a finished one is a card
        the eye has to read a band to trust. So it carries the one thing that
        cannot be got anywhere else: THERE IS A GAME ON THE BOARD RIGHT NOW,
        with its score, its period and its clock, and CONTINUE directly under it
        in the same block. A finished score is on the MATCHES shelf.

        The onboarding card takes its place on a fresh install and only there:
        no board, no shelf. Once a game has been played the lobby simply has no
        hero, because there is nothing live to be about. -- */
  const live = inProgress && (
    <Col gap={m.s2}>
      <Card glass>
        <Band
          label="LIVE"
          tone={t.accent}
          note={
            <Row gap={m.s2}>
              {/* the live dot takes `live`, the same teal the running clock and
                  the court's tap mark take. All three mean "now"; `accent` is
                  the brand and means "ours". */}
              {running && (
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    flexGrow: 0,
                    flexShrink: 0,
                    backgroundColor: t.live,
                  }}
                />
              )}
              <Label>
                {ord(period).toUpperCase()} · {mmss(remaining)}
              </Label>
            </Row>
          }
        />
        <Seam>
          <Side title={team.toUpperCase()} value={score} pill="US" tone={t.accent} />
          <Side title={opponentLabel(oppName)} value={oppScore} pill="THEM" />
        </Seam>
      </Card>

      {/* CONTINUE is part of the live block, not of the verbs at the foot: it
          is the same tap as the card over it — "the game that is on" — and a
          scorer coming back mid-quarter should not read past the season to
          find it. The gap is the tight one, because the two are one thing. */}
      <Row align="stretch">
        <Btn label="CONTINUE GAME" variant="accent" onPress={() => router.push('/game')} />
      </Row>
    </Col>
  );

  const onboard = nothingYet && (
    <Card glass>
      <Band label="NO GAME YET" />
      <Col align="center" gap={m.s2} style={{ paddingVertical: m.s6, paddingHorizontal: m.s4 }}>
        <Text
          numberOfLines={2}
          style={{
            textAlign: 'center',
            fontFamily: fNum(700),
            fontSize: m.fsXl,
            lineHeight: m.fsXl * 1.2,
            letterSpacing: ls(m.fsXl, LS_TITLE),
            color: t.ink,
          }}
        >
          START YOUR FIRST GAME
        </Text>
        <Label>
          {roster.length}/{ROSTER_CAP} PLAYERS
        </Label>
      </Col>
    </Card>
  );

  /* -- THE LAST GAME'S SIX NUMBERS, and they are the last FINISHED game's,
        never the live one — a final line for a game still being played is a
        lie. Hidden outright when there is none: six zeros read as a game that
        went badly rather than as no data.

        Its SCORELINE is not here, and that is what was cut: the hero's FINAL
        state carried it and the hero is the live game only now. -- */
  const strip = T && (
    <Card glass>
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

  /* -- the season's six, over NEW GAME. Hidden while the shelf is being read
        and hidden outright when no OFFICIAL game has been played — six zeros
        under the word SEASON reads as a bad one, not as an empty one. -- */
  const seasonCard = S && (
    <SeasonCard
      games={S.games}
      record={`${S.wins}-${S.losses}`}
      ppg={S.games ? Math.round(S.team.pts / S.games) : 0}
      fg={pct(S.team.fgm, S.team.fga)}
      efgv={efg(S.team)}
      tsv={ts(S.team)}
      wide={wide}
      onPress={() => router.push('/season')}
    />
  );

  /* -- NEW GAME IS THE LAST THING ON THE SCREEN, always, and it is one button.

        It used to share a row with RESUME, which meant the primary verb moved
        depending on whether a game was on. It does not move now: the way back
        into a live game is up with the scoreline, and the foot of the screen is
        where the one thing that starts something lives. While a game IS on it
        drops to `surface` and goes through the confirm panel — losing a live
        game to a mis-tap is the worst thing this screen can do. -- */
  const actions = (
    <Col gap={m.s2}>
      <Row align="stretch">
        {/* THE VERB IS LIT THE WAY THE ROOM IS. `bloom` is the accent filled
            with the bloom's own gradient, on the bloom's own axis, so the one
            button that starts something belongs to the screen behind it rather
            than sitting on it as a slab. While a game is ON it drops to
            `surface` and stops catching any light at all — which is the whole
            of what that state is saying. */}
        <Btn
          label="NEW GAME"
          variant={inProgress ? 'surface' : 'bloom'}
          disabled={!enough}
          onPress={newGame}
        />
      </Row>
      {/* GAME SETTINGS, and it is the SECOND WEIGHT under the first.
          It replaces the gear that used to float in this screen's top-right
          corner — a glyph in a circle, with no word on it, in the one row that
          is the club's own identity. A settings list is read and scrolled, so
          it is a page now, and the way into a page is a named verb. `plain` is
          the lightest weight `Btn` has, which is the whole of what this button
          is saying beside the one above it: you came here to start a game. */}
      <Row align="stretch">
        <Btn label="GAME SETTINGS" variant="plain" onPress={() => router.push('/settings')} />
      </Row>
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
      {/* THE BLOOM. It is a component now, because the other three rooms
          draw the same one — see `components/ui/Bloom.tsx` for why it must be
          the first child, outside the padding, and why it eats no taps. */}
      <Bloom />
      {/* ---- identity ------------------------------------------------ *
          THE BRAND LOCKUP AND THE HEADLINE, in that order and on two rows.

          One row: the mark and the wordmark at the left, the circular control
          at the right. Then the club NAME at headline size underneath. It used
          to be crest + HOOPLOG with the club as a `fsXs` subtitle beside the
          coach — which put the one thing this screen is ABOUT in the smallest
          type on it. The club is the headline now and HOOPLOG is the small
          mark above it, which is the right way round: nobody opens this app
          wondering what it is called.

          THE COACH IS NO LONGER HERE. It was the `· NAME` half of that
          subtitle, and the subtitle is gone. It is a fact about the club, it
          is edited on the TEAM tab, and this screen has a hard one-window
          budget that the headline has just spent.                            */}
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <Row gap={m.s2} style={{ minHeight: m.tap }}>
          {/* the whole block is the way into the club, because the crest is the
              thing a scorer reaches for when they want to change the crest — and
              it goes to the TAB that edits it rather than opening a second editor
              over the top of this screen. `EditTeamPanel` was that second editor
              and is gone: two forms over three fields is one field added twice. */}
          <Press
            onPress={() => router.push('/team')}
            accessibilityLabel="open the team tab to edit the club"
            style={{
              flexShrink: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: m.s2,
              paddingRight: m.s2,
              borderRadius: 999,
            }}
            pressedStyle={{ opacity: 0.6 }}
          >
            <Crest name={club.name} uri={club.logoUri} size={m.fsXl} />
            {/* THE WORDMARK, AND IT IS SPLIT — `HOOP` in ink, `LOG` in accent.
                A logotype is the one place in this app a colour is allowed to
                mean nothing but ITSELF: it names no control, it opens nothing,
                and it is four characters, so it cannot compete with the two
                things accent is spent on lower down the screen. It is the same
                Anton the headline under it is set in, tracked out to `LS_LABEL`
                because a condensed face at label size closes up without it. */}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fDisplay(),
                fontSize: m.fsLg,
                letterSpacing: ls(m.fsLg, LS_LABEL),
                color: t.ink,
              }}
            >
              HOOP<Text style={{ color: t.accent }}>LOG</Text>
            </Text>
          </Press>
        </Row>

        <Headline text={club.name} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, marginTop: m.s3 }}
        contentContainerStyle={{ paddingBottom: bar + m.s5, alignItems: 'center' }}
      >
        {/* ONE COLUMN, and it fits. The roster list is gone from here — it is
            a tab of its own, and it was the only block that made this screen
            taller than the window. Capped at the two-up line rather than run
            full width, or a tablet draws a scoreline a foot across. */}
        {/* live game and its way back in, the season, then the one verb.
            Nothing between them is a fixed block: on a shelf with no live game
            the column is the season card and NEW GAME, and that is the whole
            screen. */}
        <Col gap={m.s3} style={{ width: '100%', maxWidth: TWO_UP }}>
          {live}
          {onboard}
          {strip}
          {seasonCard}
          {actions}
        </Col>
      </ScrollView>

      <PanelHost />
    </View>
  );
}

/**
 * THE PALETTE AND THE STATUS BAR ARE THE GROUP'S NOW, not this screen's.
 *
 * This file used to wrap itself in `ThemeProvider value={DARK}` and mount its
 * own `<StatusBar style="light" />`, because it was the one screen in the app
 * drawn on black. All four rooms are, so both moved up one level to
 * `app/(tabs)/_layout.tsx` — one declaration for the group, which is also what
 * stops the four from drifting apart. See the note there, including why the
 * status bar is flipped on FOCUS rather than by a mounted component.
 */
export default function Lobby() {
  return <LobbyScreen />;
}
