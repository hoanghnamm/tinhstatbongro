import { useMemo, type ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelHost } from '../../components/panels/PanelHost';
import { Btn } from '../../components/panels/shell';
import { Band, Card, Seam } from '../../components/stats/parts';
import { Bloom } from '../../components/ui/Bloom';
import { Crest } from '../../components/ui/Crest';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useTabInset } from '../../hooks/useTabInset';
import { useSavedGames } from '../../hooks/useSavedGames';
import { pct } from '../../lib/format';
import { ROSTER_CAP, STARTERS } from '../../lib/roster';
import { competitions, officialIn, season, type SeasonLine } from '../../lib/season';
import { competitionLabel } from '../../lib/team';
import { efficiency } from '../../lib/stats';
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
 * THE LOBBY — TWO BLOCKS AND THE VERBS.
 *
 * The lockup and its tagline over the ball, then the LEAGUE, then the MVP, then
 * one row carrying NEW GAME and the gear. That is the whole screen.
 *
 * THE LEAGUE IS THE UPPER BLOCK AND THE MVP IS THE LOWER ONE. They were the
 * other way round, and the order is an argument about what the screen is for:
 * how the season is going is the question a scorer opens the app with, and who
 * is carrying it is the one they ask next.
 *
 * WHAT IT USED TO BE WAS FIVE BLOCKS, and four of them have gone: the LIVE
 * hero with CONTINUE under it, the LAST GAME strip of six numbers, THE SEASON
 * card of six more, and the club headline over all of them. The screen was a
 * dashboard — every number the app knows, stacked, none of them the reason
 * anybody opened it. It is a POSTER now: the player who is carrying the season,
 * and how the season is going. Both are one tap into the room that holds the
 * detail, which is what the six-number strips were standing in for.
 *
 * THE TAGLINE IS ONE SMALL LINE UNDER THE MARK, AND THE CLUB HAS ITS SLOT.
 * Ball don't lie. Stats neither. sits hard against `HOOPLOG` at `fs2xs`, which
 * is what a tagline is — the lockup's small print — and the slot it used to
 * take two lines of air over is the CREST AND THE NAME. It is a readout and
 * NOT the identity block coming back: nothing here opens the team editor, and
 * the accent on the tagline's second half is still the LOCKUP'S rather than
 * the screen's, so it spends nothing against the budget below.
 *
 * `fDisplay` IS THE WORDMARK'S ALONE ON THIS SCREEN. It used to land on two
 * NAMES as well — the MVP's and the club's — and both are text a scorer typed:
 * a player set in the app's own logotype reads as a poster shouting a surname,
 * and a club name a hair under the wordmark's size reads as a second logotype
 * stacked on the first. Both are the BODY face now, and SIZE is what says which
 * name the screen is about: the MVP at `fsXl`, the club a step under it at
 * `fsLg`. The crest's monogram is the one other place the face survives, and it
 * is a mark rather than a label.
 *
 * ACCENT IS THE PRIMARY VERB AND THE ONE NUMBER EACH BLOCK IS ABOUT — the MVP's
 * jersey and the league's points — and nothing else. Not the record, not the
 * FG, not the tiles, not the league band's note. The old rule said "the primary button
 * and our own score", and with the live score off the screen this is the same
 * rule over the same count: three marks, each of them the thing its block
 * exists to say.
 *
 * THERE IS NO LIVE HERO, so the way back into a running game is the FOOT of the
 * screen: CONTINUE GAME takes the primary slot while a game is on and NEW GAME
 * steps down under it at `surface`, behind the confirm panel. The verbs stack;
 * a third block does not reappear.
 *
 * AND THE LAST OF THOSE ROWS IS SPLIT FOUR TO ONE, with the gear in the fifth.
 * GAME SETTINGS was a full-width named verb of its own directly under NEW GAME
 * — a page opened once a season wearing the same width as the one opened every
 * night. It is a glyph on the right of the verb's own row now, which is the
 * ratio said out loud, and it is the only icon-only control in the app outside
 * the tab bar.
 *
 * The wordmark LEANS and carries no full stop. `HOOPLOG.` was set upright; the
 * lean comes from `WORDMARK_SLANT` rather than from `fontStyle`, for the reason
 * written on that constant.
 *
 * The MVP is the PER-GAME POINTS LEADER over the season's official games,
 * averaged over the games each player APPEARED in — the same denominator
 * `lib/season.ts` uses everywhere, which is what stops a twelfth man who turned
 * up twice being punished for the nights the team played without them. The
 * LEAGUE is the CURRENT COMPETITION, not the whole season: `competitions()`
 * hands its groups back newest first, so the one being played this month heads
 * the list and is the one this card is made of.
 *
 * Both are read off every saved game, which is the one thing the two-key
 * storage shape was meant to avoid on this screen: a single pass on mount
 * through `useSavedGames`, off the render path, memoised.
 *
 * Layout is keyed on WIDTH, not orientation — this is not the board. The column
 * is capped at the same line, or a tablet draws a jersey number a foot across.
 *
 * `Band` / `Card` / `Seam` come from the stats screen's furniture rather than
 * being redrawn here, and every piece below is module-level: a component
 * declared inside `LobbyScreen` would be a new type on every render.
 */

/** The column's own cap. The same line `team.tsx` and `RotateGate` draw. */
const TWO_UP = 700;

/**
 * THE WORDMARK'S LEAN, as a skew rather than an italic face.
 *
 * Anton has one weight, no italic, and nothing to synthesise from on iOS, so
 * `fontStyle: 'italic'` is a rule one platform honours and the other ignores.
 * TWELVE DEGREES IS THE TOP OF THE RANGE and it is where this sits: it was nine
 * for one revision and nine on a face this condensed reads as a mark set very
 * slightly crooked rather than as a mark that LEANS. Past twelve the counters
 * start to close and Anton goes to mush, so this is the last stop before the
 * lean costs the letterforms. It is a raw value like a hex and it is a lockup's,
 * not a layout's — nothing else in the app leans, and nothing else should.
 */
const WORDMARK_SLANT = '-12deg';

/** The ball, as a share of the window. Wide enough to run off the right edge —
 *  a photograph that ends inside the screen is a picture pasted onto it. */
const ART_W = 0.82;
const ART_H = 0.24;

/* ---- the pieces ---------------------------------------------------- */

/**
 * THE BALL BEHIND THE LOCKUP.
 *
 * It obeys the two rules `Bloom` obeys, for the same reasons: it is the first
 * thing in the screen and OUTSIDE the padded flow, so it runs under the status
 * bar rather than starting below it, and it eats no taps — the wordmark sits on
 * top of it.
 *
 * IT IS FADED BY TWO GRADIENTS, NOT BY OPACITY. A flat `opacity` on the image
 * greys the whole photograph including the black it is mostly made of, which
 * reads as a grey rectangle over a near-black room. The two washes instead run
 * the room's own `bg` back OVER the picture — solid at the left edge and at the
 * bottom, clear at the top-right corner — so the ball emerges out of the room
 * rather than being pasted onto it, and the corner keeps its full contrast.
 */
function HeaderArt() {
  const m = useMetrics();
  const t = useTheme();
  const w = m.win.w * ART_W;
  const h = m.win.h * ART_H;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: w,
        height: h,
      }}
    >
      <Image
        source={require('../../assets/hero-ball.png')}
        resizeMode="cover"
        style={{ width: w, height: h }}
      />
      {/* the left edge, back into the room */}
      <LinearGradient
        colors={[t.bg, withAlpha(t.bg, 0.55), 'transparent']}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* and the bottom edge, so the cards below it start on clean ground */}
      <LinearGradient
        colors={['transparent', withAlpha(t.bg, 0.6), t.bg]}
        locations={[0.35, 0.75, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );
}

/**
 * BALL DON'T LIE. STATS NEITHER.
 *
 * ONE LINE, TIGHT UNDER THE WORDMARK. It was two lines sitting in a slot of
 * their own with air above them, which made the tagline read as a second block
 * rather than as part of the mark — and it left the club with nowhere to go.
 * The slot it vacated is the club's; see `Identity`.
 *
 * IT IS SET AT `fs2xs`, WHICH IS THE RAMP'S NEW BOTTOM STEP AND ITS ONLY
 * CALLER. The ramp stopped at `fsXs` because that is the smallest thing on the
 * board a scorer has to read at arm's length in a gym; a tagline is read once
 * and never again, so it is the one string allowed under that floor. There is
 * a NEGATIVE `s1` above it, which is how it sits on the mark rather than a step
 * below it. Squeezing the wordmark's own `lineHeight` was the first attempt and
 * it CLIPPED the face — see the note there. Pulling the small print up into the
 * mark's leading costs the mark nothing.
 *
 * TWO TONES ON THE ONE LINE, which is the construction the two lines had and
 * the same reason: the colour lands on the half that is the point. It is set in
 * the BODY face and not in `fDisplay` — the wordmark above it is the mark, and
 * a tagline in the same face at half the size reads as the mark repeating
 * itself rather than as a line under it. It is SENTENCE CASE, like everything
 * else that is a sentence.
 *
 * The accent on the second half is the LOCKUP'S, not the screen's: it names no
 * control and opens nothing, exactly as `LOG` in the wordmark does, so it does
 * not count against the marks below.
 */
function Tagline() {
  const m = useMetrics();
  const t = useTheme();

  const line = {
    ...fUi(500),
    fontSize: m.fs2xs,
    lineHeight: m.fs2xs * 1.2,
    letterSpacing: ls(m.fs2xs, LS_MICRO),
  };

  return (
    <Text numberOfLines={1} style={{ ...line, color: t.ink2, marginTop: -m.s1 }}>
      Ball don&apos;t lie. <Text style={{ color: t.accent }}>Stats neither.</Text>
    </Text>
  );
}

/**
 * THE CLUB, IN THE SLOT THE TAGLINE GAVE UP — the crest and the name.
 *
 * The lockup says what the APP is; this says whose board it is, which is the
 * one thing about the club that belongs on a screen that no longer edits it.
 * It is a READOUT and not a way in: the club is edited on the TEAM tab, one tap
 * away, and a crest that opened an editor here is exactly the route that was
 * cut when the identity block went.
 *
 * THE NAME IS THE BODY FACE, AND A STEP BELOW THE MVP'S. It was `fDisplay` at
 * `fsXl` — the wordmark's own face at a size a hair under the wordmark's own —
 * which made the club read as a SECOND LOGOTYPE stacked under the first rather
 * than as the answer to whose board this is. A club name is text a scorer
 * typed; it is set the way every other name in the app is set, and it is not
 * shouted back in capitals either. `fsLg` keeps it under the MVP, who is the
 * name this screen is about.
 */
function Identity() {
  const m = useMetrics();
  const t = useTheme();
  const club = useTeamStore((s) => s.profile);

  return (
    <Row gap={m.s3} style={{ marginTop: m.s4 }}>
      <Crest name={club.name} uri={club.logoUri} size={Math.round(m.fsLg * 1.6)} />
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          // THE BODY FACE, BECAUSE THE CLUB'S NAME IS TEXT A SCORER TYPED.
          // It was `fDisplay` at a size a hair off the wordmark's, which made
          // the club read as a SECOND LOGOTYPE stacked under the first rather
          // than as the answer to whose board this is. The mark is the app's
          // and is set in the app's face; a name out of the roster is set in
          // the face every other name in the app is set in.
          ...fUi(600),
          fontSize: m.fsLg,
          lineHeight: m.fsLg * 1.25,
          letterSpacing: ls(m.fsLg, LS_LABEL),
          color: t.ink,
        }}
      >
        {club.name}
      </Text>
    </Row>
  );
}

function Label({ children, tone }: { children: ReactNode; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        ...fUi(500),
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

/** A cell of either block's stat strip. Opaque and edgeless — it lives in a
 *  `Seam`, and the seam is the 1px of parent showing between two. */
function Stat({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
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
          ...fNum(700),
          fontSize: m.fsXl,
          letterSpacing: ls(m.fsXl, LS_TIGHT),
          lineHeight: m.fsXl * 1.1,
          color: tone ?? t.ink,
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
          ...fUi(400),
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
 * BLOCK ONE — THE MVP.
 *
 * The jersey at the left, the name at the right, and the three numbers the
 * question is actually asked in underneath: points, assists, rebounds, all per
 * game and all to one decimal, because 18 and 18.4 are the same number to a
 * reader and the difference between two players is usually the tenth.
 *
 * THE JERSEY IS THE ONE ACCENT MARK ON THIS CARD. Not the name, not the tiles,
 * not the band — the number IS the player at courtside, and it is the one thing
 * on the block a scorer recognises before they have read anything.
 *
 * THE NAME IS THE DISPLAY FACE, and it is the biggest name on the screen — a
 * step above the club's in the header, which is which of the two the lobby is
 * about. It shrinks to fit rather than wrapping: this is one line by
 * construction, and a two-line name would push the strip under it past the
 * block's own height.
 *
 * TWO CAPTIONS ARE CUT AND NEITHER COMES BACK. `N GAMES THIS SEASON` rode the
 * band's note and `POINTS PER GAME LEADER` sat under the name; between them
 * they turned a poster into a card explaining itself. THE `Slug` WENT WITH THE
 * SECOND OF THEM — a 36×3 accent rule between a name and a caption is a join,
 * and with nothing under it to join to it was underlining thin air. The rule is not named
 * here any more — the foot of the card says POINTS / ASSISTS / REBOUNDS per
 * game, which is the rule shown rather than stated, and the player's own page
 * behind the press is where a denominator is argued with.
 *
 * It presses on OPACITY rather than on a fill, for the reason a competition
 * card does: the cells are opaque so their 1px seams can show, and a background
 * change under them is visible nowhere but the edges.
 */
function MvpCard({
  number,
  name,
  ppg,
  apg,
  rpg,
  onPress,
}: {
  number: number;
  name: string;
  ppg: string;
  apg: string;
  rpg: string;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`most valuable player, ${name}, number ${number}, ${ppg} points a game — open their season`}
      style={{ borderRadius: m.r }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Card glass>
        {/* THE BAND CARRIES THE LABEL AND NOTHING ELSE. `N GAMES THIS SEASON`
            rode the note and is cut: the denominator behind a per-game number
            is a thing to ARGUE with, which is what the player's own page is
            for, and on a poster it was a second small caption competing with
            the one under the name — which is itself now gone. */}
        <Band label="MVP" tone={t.accent} />
        <Col gap={1} style={{ backgroundColor: t.rule }}>
          <Seam>
            {/* THE JERSEY PLATE — a share of the row rather than a fixed width,
                so it holds its proportion from a 320pt phone to a tablet.
                `flexGrow` off a zero basis and not `flex`, because the row's
                height comes from the column beside it. */}
            <Col
              align="center"
              justify="center"
              style={{
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                paddingVertical: m.s4,
                backgroundColor: t.surface,
              }}
            >
              <Row gap={1} align="center" style={{ flexGrow: 0, flexShrink: 1, minWidth: 0 }}>
                <Text
                  style={{
                    ...fNum(700),
                    fontSize: m.fsMd,
                    color: t.accent,
                  }}
                >
                  #
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    ...fNum(700),
                    fontSize: m.fs3xl,
                    letterSpacing: ls(m.fs3xl, LS_TIGHT),
                    lineHeight: m.fs3xl * 1.06,
                    color: t.accent,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {number}
                </Text>
              </Row>
            </Col>

            <Col
              justify="center"
              style={{
                flexGrow: 2.4,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                paddingVertical: m.s4,
                paddingHorizontal: m.s3,
                backgroundColor: t.surface,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  // THE BODY FACE AND MIXED CASE, like every other name in the
                  // app. It was `fDisplay` in caps — a player's own name set in
                  // the wordmark's face, which made the card read as a poster
                  // shouting a surname rather than as the answer to who is
                  // carrying the season. It is still the biggest name on the
                  // screen; SIZE is what says that, not the face.
                  // `adjustsFontSizeToFit` is the floor under a long one.
                  ...fUi(700),
                  fontSize: m.fsXl,
                  lineHeight: m.fsXl * 1.2,
                  letterSpacing: ls(m.fsXl, LS_TITLE),
                  color: t.ink,
                }}
              >
                {name}
              </Text>
              {/* THE NAME AND NOTHING UNDER IT. Both the `Slug` — the 36×3
                  accent rule — and `POINTS PER GAME LEADER` under it are cut:
                  the card's own foot says POINTS / ASSISTS / REBOUNDS per
                  game, so the caption spelled out what the numbers beside it
                  already say, and with the caption gone the bar was underlining
                  nothing. `components/ui/Slug.tsx` is left standing with no
                  caller. */}
            </Col>
          </Seam>

          <Seam>
            <Stat value={ppg} label="Points" />
            <Stat value={apg} label="Assists" />
            <Stat value={rpg} label="Rebounds" />
          </Seam>
        </Col>
      </Card>
    </Press>
  );
}

/**
 * BLOCK TWO — THE LEAGUE, which is the CURRENT COMPETITION.
 *
 * Total points at the left at headline size, the record and the games it is out
 * of at the right, and the shooting under them as a pill.
 *
 * THE POINTS ARE THE ONE ACCENT MARK, for the same reason the jersey is on the
 * block above: it is the number the card exists to say. The record deliberately
 * is NOT coloured — on the shelf a win is `accent` and a loss is `ink2`, and a
 * W-L pair is both of those at once, so colouring it would mean choosing which
 * half of a season to shout.
 *
 * THE FG IS A PILL AND NOT A FOURTH TILE. It is two readings of one fact — the
 * split and the percentage — and a tile holds one number. The pill is also what
 * keeps the right column two rows rather than three, which is what lets the
 * points at the left run at `fs4xl` beside it.
 */
function LeagueCard({
  name,
  points,
  record,
  games,
  fgm,
  fga,
  onPress,
}: {
  name: string;
  points: number;
  record: string;
  games: number;
  fgm: number;
  fga: number;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${name}, ${points} points, record ${record} — open the competition`}
      style={{ borderRadius: m.r }}
      pressedStyle={{ opacity: 0.6 }}
    >
      <Card glass>
        <Band label="League" tone={t.accent} note={<Label>{name}</Label>} />
        <Seam>
          <Col
            align="center"
            justify="center"
            gap={2}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
              paddingVertical: m.s4,
              paddingHorizontal: m.s2,
              backgroundColor: t.surface,
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                ...fNum(700),
                fontSize: m.fs4xl,
                letterSpacing: ls(m.fs4xl, LS_TIGHT),
                lineHeight: m.fs4xl * 1.04,
                color: t.accent,
                fontVariant: ['tabular-nums'],
              }}
            >
              {points}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                ...fUi(400),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_MICRO),
                color: t.ink2,
              }}
            >
              Points
            </Text>
          </Col>

          <Col
            gap={1}
            style={{
              flexGrow: 1.35,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
              backgroundColor: t.rule,
            }}
          >
            <Seam>
              <Stat value={record} label="Record" />
              <Stat value={games} label="Games" />
            </Seam>
            <Row
              align="center"
              justify="center"
              style={{
                paddingVertical: m.s3,
                paddingHorizontal: m.s2,
                backgroundColor: t.surface,
              }}
            >
              <Row
                gap={m.s2}
                align="center"
                style={{
                  flexGrow: 0,
                  flexShrink: 1,
                  minWidth: 0,
                  borderRadius: 99,
                  paddingVertical: m.s1,
                  paddingHorizontal: m.s3,
                  backgroundColor: t.surface2,
                }}
              >
                <Label>FG</Label>
                <Label tone={t.ink}>
                  {fgm}/{fga}
                </Label>
                <Label>·</Label>
                <Label tone={t.ink}>{pct(fgm, fga)}</Label>
              </Row>
            </Row>
          </Col>
        </Seam>
      </Card>
    </Press>
  );
}

/* ---- the screen ----------------------------------------------------- */

/** Whole numbers stay whole; an average keeps its one decimal. */
const avg = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function LobbyScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

  const roster = useRosterStore((s) => s.players);
  const ended = useGameStore((s) => s.ended);
  const played = useGameStore((s) => s.events.length > 0);
  const open = useUiStore((s) => s.open);
  const savedCount = useHistoryStore((s) => s.index.length);

  // THE ONE EXPENSIVE READ ON THIS SCREEN: every saved game off disk, because
  // both blocks are made of stat lines and a summary has none. It lands once,
  // off the render path, and both memos hang off it.
  const saved = useSavedGames();
  const official = useMemo(() => (saved ? officialIn(saved) : null), [saved]);

  /* -- THE MVP: the per-game points leader.
        `season(…, 'perGame')` has already divided each line by the games that
        player APPEARED in, so the comparison is a straight read of `pts`.
        Ties break on efficiency and then on games played — a scorer looking at
        two identical averages wants the one who did more of everything else,
        and after that the one who did it more often. -- */
  const mvp = useMemo<SeasonLine | null>(() => {
    if (!official || !official.length) return null;
    const { lines } = season(official, roster, 'perGame');
    if (!lines.length) return null;
    return lines.reduce((best, line) => {
      const p1 = line.stats.points;
      const p2 = best.stats.points;
      if (p1 !== p2) return p1 > p2 ? line : best;
      const a = efficiency(line.stats);
      const b = efficiency(best.stats);
      if (a !== b) return a > b ? line : best;
      return line.games > best.games ? line : best;
    });
  }, [official, roster]);

  /* -- THE LEAGUE: the CURRENT competition, which is the first group back —
        `competitions()` keeps the order the games are handed in and
        `useSavedGames` hands them newest first. -- */
  const league = useMemo(
    () => (official && official.length ? (competitions(official, roster)[0] ?? null) : null),
    [official, roster],
  );

  const inProgress = played && !ended;
  // a board with nothing on it and a shelf with nothing on it: the one state
  // that gets the onboarding copy, and it is true exactly once per install
  const nothingYet = !played && savedCount === 0;
  const available = roster.filter((p) => p.available);
  const enough = available.length >= STARTERS;

  const newGame = () => {
    // losing a live game to a mis-tap is the worst thing this screen can do
    if (inProgress) open({ kind: 'newGame' });
    else router.push('/start');
  };

  // the player page reads its games out of the route, the way the season tab
  // hands them over — one shape, and no second way in
  const openPlayer = (id: string) =>
    router.push({
      pathname: '/player/[id]',
      params: { id, games: JSON.stringify(official ?? []) },
    });

  const mvpBlock = mvp && (
    <MvpCard
      number={mvp.number}
      name={mvp.name}
      ppg={avg(mvp.stats.points)}
      apg={avg(mvp.stats.assists)}
      rpg={avg(mvp.stats.offensiveRebounds + mvp.stats.defensiveRebounds)}
      onPress={() => openPlayer(mvp.id)}
    />
  );

  const leagueBlock = league && (
    <LeagueCard
      name={competitionLabel(league.name)}
      points={league.season.team.pts}
      record={`${league.season.wins}-${league.season.losses}`}
      games={league.season.games}
      fgm={league.season.team.fgm}
      fga={league.season.team.fga}
      onPress={() => router.push({ pathname: '/competition', params: { key: league.key } })}
    />
  );

  /* -- Nothing to be a poster ABOUT yet. One card stands in for both blocks
        rather than one empty state per block: two cards reading NO DATA is a
        screen apologising twice for one fact. It is drawn whenever neither
        block can be, which covers a fresh install and also a shelf with
        nothing but practices on it. -- */
  const empty = !leagueBlock && !mvpBlock && (
    <Card glass>
      <Band label={nothingYet ? 'No game yet' : 'No official game yet'} />
      <Col align="center" gap={m.s2} style={{ paddingVertical: m.s6, paddingHorizontal: m.s4 }}>
        <Text
          numberOfLines={2}
          style={{
            textAlign: 'center',
            ...fUi(600),
            fontSize: m.fsLg,
            lineHeight: m.fsLg * 1.25,
            letterSpacing: ls(m.fsLg, LS_TITLE),
            color: t.ink,
          }}
        >
          {nothingYet ? 'Start your first game' : 'A practice is not a season'}
        </Text>
        <Label>
          {nothingYet ?
            `${roster.length}/${ROSTER_CAP} players`
          : 'Mark a game official at the door'}
        </Label>
      </Col>
    </Card>
  );

  /* -- THE VERBS, and they are the whole of the way into a game now.

        With the LIVE hero cut, CONTINUE has nowhere else to be — so it takes
        the primary slot while a game is on and NEW GAME steps down under it at
        `surface`, behind the confirm panel. The stack grows by one row rather
        than the screen growing by a block, and the primary verb never moves:
        the thing at the foot of the lobby is always the thing that puts you on
        the board. -- */
  const actions = (
    <Col gap={m.s2}>
      {inProgress && (
        <Row align="stretch">
          {/* THE VERB IS LIT THE WAY THE ROOM IS. `bloom` is the accent filled
              with the bloom's own gradient, on the bloom's own axis, so the one
              button that puts you on the board belongs to the screen behind it
              rather than sitting on it as a slab. */}
          <Btn label="Continue game" variant="bloom" onPress={() => router.push('/game')} />
        </Row>
      )}
      {/* ONE ROW, SPLIT FOUR TO ONE: the verb and the way to the settings page.

          They were two stacked rows, and the lower one spelled GAME SETTINGS
          out at `plain` — a full-width named verb for a page a scorer opens
          once a season, directly under the one they open every night. Sharing
          the row says the ratio out loud: four fifths of it is what you came
          here to do, and the last fifth is the gear. The fifth is a GLYPH
          because a fifth of this row cannot hold a word — and it sits on the
          RIGHT, where nothing that starts a game has ever been.

          The weights are on the WRAPPERS rather than on the buttons, because
          `Btn` is `flex:1` inside whatever it is handed and every caller in the
          app relies on that. */}
      <Row align="stretch" gap={m.s2}>
        <View style={{ flex: 4, flexDirection: 'row' }}>
          <Btn
            label="New game"
            variant={inProgress ? 'surface' : 'bloom'}
            disabled={!enough}
            onPress={newGame}
          />
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Btn
            label="Game settings"
            icon="cog"
            variant="plain"
            onPress={() => router.push('/settings')}
          />
        </View>
      </Row>
      {/* only the WARNING survives — it is why NEW GAME is dark. A count
          nobody has to act on was a row the screen could not spare. */}
      {!enough && (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            textAlign: 'center',
            ...fUi(500),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.danger,
            fontVariant: ['tabular-nums'],
          }}
        >
          Need at least {STARTERS} available players
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
      {/* THE BALL FIRST, THEN THE BLOOM OVER IT. Both are grounds and both are
          outside the padded flow; the order is what makes the warm corner sit
          on the photograph rather than behind it, so the two read as one light
          rather than as a picture with a gradient beside it. */}
      <HeaderArt />
      <Bloom />

      {/* ---- the lockup ---------------------------------------------- *
          THE WORDMARK, ITS TAGLINE TIGHT UNDER IT, AND THEN THE CLUB.

          The tagline is one small line hard against the mark rather than two
          lines in a slot of their own, and the slot it gave up is the club's:
          the crest and the name, as a READOUT. It is not the identity block
          coming back — there is no route into the team editor from here. The
          club is edited on the TEAM tab, which is one tap away.             */}
      {/* CAPPED AND CENTRED ON THE SAME LINE THE BLOCKS ARE, which is what
          makes this a column rather than a header floating over one: run full
          width, the lockup sat hard against the left edge of a tablet while
          every card under it was centred at 700. One measure, top to bottom. */}
      <View style={{ flexGrow: 0, flexShrink: 0, width: '100%', maxWidth: TWO_UP, alignSelf: 'center' }}>
        <Row>
          {/* THE WORDMARK, AND IT IS SPLIT — `HOOP` in ink, `LOG` in accent.
              A logotype is the one place in this app a colour is allowed to
              mean nothing but ITSELF: it names no control, it opens nothing,
              and it cannot compete with the marks lower down the screen.

              IT LEANS, AND THE LEAN IS A SKEW RATHER THAN A `fontStyle`. Anton
              ships ONE face and no italic, so `fontStyle: 'italic'` is a rule
              the platform answers two different ways — Android fakes an oblique
              and iOS, which has no face to swap to, draws it upright. A skew is
              the same synthesis, stated once and identical on both. It is on
              the OUTER `Text`, so the accent half leans with the ink half; two
              skews would be two wordmarks standing at slightly different
              angles. */}
          <Text
            numberOfLines={1}
            style={{
              ...fDisplay(),
              fontSize: m.fs2xl,
              // 1.2, AND IT MAY NOT GO TIGHTER. Anton is a tall condensed face
              // with almost no descender, which makes a tight `lineHeight`
              // look like free space right up until it CLIPS — the box is what
              // the text is drawn into, so anything under about 1.15 shaves the
              // caps off the top. It was 1.04 for one revision and it cut the
              // wordmark in half. The tagline is pulled up by a margin instead.
              lineHeight: m.fs2xl * 1.2,
              letterSpacing: ls(m.fs2xl, LS_TITLE),
              color: t.ink,
              transform: [{ skewX: WORDMARK_SLANT }],
            }}
          >
            HOOP<Text style={{ color: t.accent }}>LOG</Text>
          </Text>
        </Row>

        <Tagline />
        <Identity />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, marginTop: m.s5 }}
        contentContainerStyle={{ paddingBottom: bar + m.s5, alignItems: 'center' }}
      >
        {/* TWO BLOCKS AND THE VERBS. Capped at the two-up line rather than run
            full width, or a tablet draws a jersey number a foot across. The
            `ScrollView` is the small-window safety net, not the design — do
            not put a third block back on this screen. */}
        <Col gap={m.s3} style={{ width: '100%', maxWidth: TWO_UP }}>
          {leagueBlock}
          {mvpBlock}
          {empty}
          {actions}
        </Col>
      </ScrollView>

      <PanelHost />
    </View>
  );
}

/**
 * THE PALETTE AND THE STATUS BAR ARE THE GROUP'S, not this screen's.
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
