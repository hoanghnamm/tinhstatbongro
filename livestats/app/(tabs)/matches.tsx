import { useMemo, useRef, useState } from 'react';
import { FlatList, Text, View, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelHost } from '../../components/panels/PanelHost';
import { Seg, type SegItem } from '../../components/stats/parts';
import { Bloom } from '../../components/ui/Bloom';
import { ClubMark } from '../../components/team/ClubMark';
import { GlowText } from '../../components/ui/GlowText';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useActiveSquad } from '../../hooks/useActiveSquad';
import { squadIn } from '../../lib/squads';
import { useTabInset } from '../../hooks/useTabInset';
import { useTopOnBlur } from '../../hooks/useTopOnBlur';
import {
  dayMonthLabel,
  filterIn,
  outcomeOf,
  summaryKind,
  type MatchFilter,
} from '../../lib/history';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
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
 * is the whole storage design; see `lib/history.ts`. IT IS ALSO THE WHOLE
 * BUDGET A ROW HAS TO SPEND: every field on it comes off the summary, and a
 * shooting line beside the score would mean opening thirty full games on every
 * render of this tab.
 *
 * ## A FLAT LIST, AND IT HAD TO COME BACK TO ONE
 *
 * This screen has been wrong in both directions. It was a DATABASE TABLE — one
 * line, four cells, a practice and a league game weighing exactly the same. The
 * fix over-corrected into STRUCTURE: date headings, matches grouped under them,
 * a day's practices folded into a run of chips beside a label. That answered
 * "which day was that" and lost the thing the screen is for, because a row had
 * become a block inside a group inside a section — three levels of nesting over
 * a list whose entire content is a score, a name and a date.
 *
 * SO: ONE ROW PER SAVED MATCH, EVERY ROW THE SAME SHAPE, and the separation is
 * done with TYPE AND SPACE rather than with containers. TWO COLUMNS, and the
 * score is the right-hand one:
 *
 *     vs CCV · HBL              16 — 64
 *     21/08  L
 *
 *     Practice                   2 — 0
 *     25/08
 *
 * A practice is the same shape with `Practice` where the opponent goes. It is
 * TEXT, not a chip, not a badge, not a section — the chips are gone, and so is
 * the giant W/L code that used to sit over the score.
 *
 * IT WAS THREE STACKED LINES WITH THE SCORE ON TOP, and stacking cost the row
 * a third of its height to say three short things that fit beside each other.
 * Side by side, the score is READ AGAINST the two lines rather than above them:
 * **`fs2xl` is very nearly the height of `fsSm` + `s1` + `fsXs`**, so the
 * figures stand exactly as tall as the block they are answering, and the row
 * comes down to two lines without any of them getting smaller. It is a ramp
 * step and not that sum computed out, because a size on this screen is a step
 * on the ramp like every other one — the two agree to within a point on every
 * window the app runs in, and the step is what survives a change to either.
 *
 * ## THE FOUR THINGS THAT MAKE IT READ
 *
 * **THE DASH IS A SEPARATE CELL AT A SMALLER SIZE**, and that is the whole fix
 * for the score. An em dash is ONE EM WIDE by definition, so `—` inside a
 * string at `fs2xl` drew a rule as long as the digits were tall and the score
 * read as `16 ————— 64`, a divider with numbers at each end. Set at `fsMd` in
 * `ink3` between two `s2` gaps it is a hyphen between two figures again. It is
 * NOT the row separator and must never be confused with one: that line is
 * 1px, full width, and belongs to the list.
 *
 * **THE SCORE IS A THREE-CELL GRID, ours right-aligned and theirs left.** Each
 * cell is one `cell` wide — three tabular digits — which is what puts every
 * dash on the shelf at the same x and every score block at the same width;
 * without it each row's score is a different length and the right edge of the
 * list reads as ragged noise. The block carries `flexShrink: 0`, because those
 * two fixed cells ARE the alignment: let it shrink and the dash column
 * collapses on exactly the rows with the longest opponent names.
 *
 * **THE TEXT COLUMN STARTS AT THE ROW'S OWN LEFT EDGE**, every row, both kinds.
 * `vs Các tô`, `Practice` and `vs DWAFT` sit on one x down the whole list, and
 * the date under each of them on another, which is what lets the eye drop
 * straight down instead of hunting for where each row begins. It takes the
 * row's whole slack (`flex: 1`, `minWidth: 0`), so a long club name ellipsises
 * rather than pushing the score off the right edge.
 *
 * **THE HIERARCHY IS FOUR STEPS OF SIZE AND INK, NOT FOUR CONTAINERS.** Score
 * at `fs2xl`, ours in `accent` and theirs in `ink`; opponent at `fsSm` in
 * `ink2`; competition at `fsXs` in `ink3`; date at `fsXs` in `ink3` with the
 * result beside it. Nothing on this screen has a fill, an edge, a radius or a
 * chevron except the filter strip.
 *
 * ## THE INK SAYS WHICH FIGURE IS OURS; THE LETTER SAYS WHICH WAY IT WENT
 *
 * These are TWO QUESTIONS and they were being answered by one colour, badly.
 * The ink used to be `accent` on a win and `ink` otherwise — on BOTH cells, off
 * one shared style object, so a win lit the opponent's number orange too. The
 * row said "we won" twice and never said which of the two numbers was us, which
 * is the thing you actually have to know to read `16 — 64` at a glance.
 *
 * SO THE ACCENT IS OURS AND IT IS OURS ON EVERY ROW — a win, a loss, a tie, a
 * practice. That is the hue's own job in the rest of the app (OURS: the primary
 * action, our score, a made shot), and the left figure being lit is what makes
 * the block readable without counting which side the dash is on.
 *
 * AND THE RESULT IS A `W` OR AN `L` BESIDE THE DATE, which is where the two
 * quiet facts about a finished match already live. It is a CODE, so it is caps
 * at `LS_CAPS` like every other abbreviation here, and it is one letter at the
 * date's own size — the row still has no fill, no badge and no pill, and the
 * giant W/L that once sat over the score is still not coming back.
 *
 * THE LOSS IS `danger`, WHICH IS A DEPARTURE, and it is worth being honest
 * about: elsewhere `danger` means "this will destroy something" or "this has
 * stopped", and the old note here argued that a game you lost is not an error
 * so a loss should simply not be lit. That held while the result WAS the score
 * and an unlit score was a legible answer. A letter is not: an `L` in `ink3`
 * beside a date in `ink3` is a typo, not a result. So the pair is lit as a
 * pair — accent for W, danger for L — and it is the one place on the shelf a
 * colour is spent on an outcome.
 *
 * A tie or a `0 — 0` draws NO letter; `outcomeOf` answers null there rather
 * than calling it a win. A practice is never asked, because a practice is not
 * a result — its date line is the date and nothing else.
 *
 * ## WHAT DID NOT CHANGE
 *
 * The rows are TYPE ON THE ROOM'S OWN GROUND with the bloom showing through — the shelf is part of the room, not a stack of cards laid on
 * it. Deleting is a LONG PRESS with a confirm. NOTHING HEADS IT: the filter is
 * a control, not a title, and the room's own tab already carries the word one
 * row below. It is drawn on black and it says so NOWHERE — the palette is the
 * group's, declared once in `app/(tabs)/_layout.tsx`.
 */

const FILTERS: SegItem<MatchFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'official', label: 'Official' },
  { key: 'practice', label: 'Practice' },
];

/** What an empty shelf says. The title alone — the line under it is gone. */
const EMPTY: Record<MatchFilter, { title: string }> = {
  all: { title: 'No matches yet' },
  official: { title: 'No official matches yet' },
  practice: { title: 'No practice yet' },
};

/**
 * THE ROW SEPARATOR, and it is the OTHER line on this screen.
 *
 * A hairline the full width of the list — deliberately as unlike the score's
 * dash as it can be, because those two are the pair a reader must never have to
 * disambiguate. This one is 1px tall, `rule`-coloured and spans everything; the
 * dash is a glyph at caption size sitting between two numbers.
 *
 * It is an `ItemSeparatorComponent` rather than a border on the row, because a
 * border draws under the LAST row as well, and a rule with nothing beneath it
 * reads as the list being cut off rather than as ending.
 */
function Seam() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.rule }} />;
}

/**
 * ONE SAVED MATCH — and there is one of these, for both kinds.
 *
 * A practice and an official game are the SAME THREE LINES in the same three
 * places; what differs is the middle line and how lit the score is. Two
 * components would be two layouts to keep in step, and keeping them in step is
 * the entire point of the alignment this row exists to hold.
 */
function MatchRow({ game }: { game: GameSummary }) {
  const m = useMetrics();
  const t = useTheme();
  const open = useUiStore((s) => s.open);

  const practice = summaryKind(game) === 'practice';
  // a practice is never a result, so it is never lit — see the header
  const outcome = practice ? null : outcomeOf(game);
  const won = outcome === 'W';

  /**
   * Three tabular digits at the score's own size.
   *
   * A digit in these faces sits near 0.55em and `LS_TIGHT` takes a hair back
   * off each one, so `1.7em` clears `108` with air to spare and never has to
   * wrap. It is derived from the type size rather than fixed, so the cell grows
   * with the ramp on a tablet exactly as the numbers in it do.
   */
  const cell = m.fs2xl * 1.7;

  /**
   * OURS IS ORANGE AND THEIRS IS NOT, ON EVERY ROW — the two figures are two
   * styles, and they were ONE. A single `score` object was handed to both cells
   * with `won ? accent : ink` on it, so a win lit the OPPONENT's number orange
   * as well: the row said "we won" twice and "which of these is us" never.
   *
   * Accent means OURS on this shelf, which is the hue's own job everywhere else
   * in the app, and it says so on a loss exactly as loudly as on a win — the
   * left figure being lit is what makes `16 — 64` readable at a glance without
   * counting which side the dash is on. WHICH WAY IT WENT is the W/L beside the
   * date; see below.
   *
   * typed, not inferred: `fontVariant` widens to `string[]` on its own and
   * `as const` narrows it to a READONLY tuple, and RN's `TextStyle` accepts
   * neither — the annotation is the only form that lands
   */
  const figure: TextStyle = {
    ...fNum(700),
    fontSize: m.fs2xl,
    letterSpacing: ls(m.fs2xl, LS_TIGHT),
    fontVariant: ['tabular-nums'],
  };
  const ours: TextStyle = { ...figure, color: t.accent };
  const theirs: TextStyle = { ...figure, color: t.ink };

  const said = practice ? 'practice' : outcome ? (won ? 'won' : 'lost') : 'unfinished';

  return (
    <Press
      onPress={() => router.push(`/history/${game.id}`)}
      onLongPress={() => open({ kind: 'removeGame', gameId: game.id })}
      accessibilityLabel={`${said}, ${game.score} to ${game.oppScore}${
        game.opponent ? `, against ${opponentLabel(game.opponent)}` : ''
      }${practice ? '' : `, ${competitionLabel(game.competition)}`}, ${dayMonthLabel(
        game.endedAt,
      )}`}
      style={{
        paddingHorizontal: m.s3,
        paddingVertical: m.s3,
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Row gap={m.s3}>
        {/* WHO AND WHEN — the two lines the score is SET AGAINST. They take the
            row's whole slack, so a long club name ellipsises rather than
            pushing the score off the right edge. */}
        <Col flex={1} gap={m.s1} style={{ minWidth: 0 }}>
          {/* WHO — or, for a practice, WHAT. One x for both, every row. */}
          <Row gap={m.s2} style={{ minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                minWidth: 0,
                ...fUi(500),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                color: practice ? t.ink3 : t.ink2,
              }}
            >
              {practice
                ? 'Practice'
                : game.opponent
                  ? `vs ${opponentLabel(game.opponent)}`
                  : 'Match'}
            </Text>

            {/* the competition rides on the same line as a MUTED tail, because
                it qualifies the opponent rather than standing beside them — and
                a practice is filed under nothing, so it draws neither half */}
            {!practice ? (
              <>
                <Text style={{ ...fUi(400), fontSize: m.fsXs, color: t.ink3 }}>·</Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    minWidth: 0,
                    ...fUi(500),
                    fontSize: m.fsXs,
                    letterSpacing: ls(m.fsXs, LS_LABEL),
                    color: t.ink3,
                  }}
                >
                  {competitionLabel(game.competition)}
                </Text>
              </>
            ) : null}
          </Row>

          {/* WHEN, AND HOW IT WENT — the date in digits, tabular, so the
              column is one width down the shelf, and the result beside it.

              THE RESULT IS A CODE AND IT LIVES HERE, not on the score, because
              the score's ink is spent saying WHICH FIGURE IS OURS. It is `W`
              and `L` in caps at the date's own size — one letter is the whole
              of what there is to say, and `LS_CAPS` is the tracking every other
              abbreviation in the app takes. A practice is never asked and a tie
              answers null, so neither draws anything and the date sits alone. */}
          <Row gap={m.s2}>
            <Text
              style={{
                ...fUi(500),
                fontSize: m.fsXs,
                color: t.ink3,
                fontVariant: ['tabular-nums'],
              }}
            >
              {dayMonthLabel(game.endedAt)}
            </Text>
            {outcome ? (
              <Text
                style={{
                  ...fNum(700),
                  fontSize: m.fsXs,
                  letterSpacing: ls(m.fsXs, LS_CAPS),
                  color: won ? t.accent : t.danger,
                }}
              >
                {outcome}
              </Text>
            ) : null}
          </Row>
        </Col>

        {/* THE SCORE — three cells, so every dash on the shelf lands on one x.
            `flexShrink: 0`, because the two cells ARE the alignment: let the
            block shrink and the dash column collapses on exactly the rows with
            the longest opponent names. */}
        <Row gap={m.s2} style={{ flexShrink: 0 }}>
          <Col align="flex-end" style={{ minWidth: cell }}>
            <GlowText numberOfLines={1} style={ours}>
              {game.score}
            </GlowText>
          </Col>

          {/* SHORT. It is a glyph at caption size, not a rule — see the header. */}
          <Text
            style={{
              ...fUi(400),
              fontSize: m.fsMd,
              color: t.ink3,
            }}
          >
            —
          </Text>

          <Col align="flex-start" style={{ minWidth: cell }}>
            <GlowText numberOfLines={1} style={theirs}>
              {game.oppScore}
            </GlowText>
          </Col>
        </Row>
      </Row>
    </Press>
  );
}

export default function MatchesScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

  const index = useHistoryStore((s) => s.index);
  const { squad } = useActiveSquad();
  const [filter, setFilter] = useState<MatchFilter>('all');

  // a tab is a room, and it is entered at the top of it — see the hook
  const list = useRef<FlatList<GameSummary>>(null);
  useTopOnBlur(list);

  // THE SHELF IS ONE TEAM'S SHELF. Two filters, in this order and both at the
  // screen: the team that played the game, then the strip's own slice of
  // practice or official. A club with three teams keeps three shelves and the
  // chip lit on the TEAM tab is which one is out.
  const rows = useMemo(
    () => filterIn(squadIn(index, squad?.id ?? ''), filter),
    [index, filter, squad],
  );
  const empty = EMPTY[filter];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s3,
        // NEARLY THE EDGE. The rows carry their own `s3` of breathing room, so
        // the screen keeps the safe area and a hair — a shelf with no boxes on
        // it has no margin left to justify.
        paddingLeft: safe.left + m.s1,
        paddingRight: safe.right + m.s1,
      }}
    >
      <Bloom />

      {/* THE CLUB HEADS THIS ROOM, IN THE LOBBY'S OWN LOCKUP SLOT. Nothing
          headed MATCHES — the tab under it already says the word — and what
          this adds is not a title but an OWNER: whose shelf these thirty games
          are. It is `s3` in from the edge, which is where the rows' own text
          column starts, so the mark and the first opponent's name share an x.
          It came off the LOBBY, where it was a second identity under the app's
          own; see `components/team/ClubMark.tsx`.                          */}
      <View style={{ paddingHorizontal: m.s3, paddingBottom: m.s3 }}>
        <ClubMark />
      </View>

      {/* THE FILTER IS CHROME AND IS SIZED LIKE IT — `compact`, so it sits at
          `tapSm` rather than at the board's `tap`. It does not scroll: a
          control that leaves with the content is one a scorer has to scroll
          back up to find. */}
      <View style={{ paddingHorizontal: m.s3, paddingBottom: m.s2 }}>
        <Seg items={FILTERS} value={filter} onChange={(k) => setFilter(k)} compact />
      </View>

      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <MatchRow game={item} />}
        ItemSeparatorComponent={Seam}
        style={{ flex: 1 }}
        // the bar's height comes off `useTabInset`, never `safe.bottom`: on iOS
        // the glass sits ON the scene's last points, and on Android the JS bar
        // is a flex sibling that has already reserved them. `s6` on top of it
        // is what keeps the last row clear of the bar rather than under it.
        contentContainerStyle={rows.length ? { paddingBottom: bar + m.s6 } : { flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
            <Text
              style={{
                ...fUi(500),
                fontSize: m.fsMd,
                letterSpacing: ls(m.fsMd, LS_LABEL),
                color: t.ink3,
              }}
            >
              {empty.title}
            </Text>
          </Col>
        }
      />

      <PanelHost />
    </View>
  );
}
