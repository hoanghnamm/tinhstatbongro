import { Text, View } from 'react-native';

import { mmss, ord } from '../../lib/format';
import { litControl } from '../../lib/lit';
import { useGameStore } from '../../store/gameStore';
import { dockFooterOverlap, useLitRect, useMeasure, useRects } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_TIGHT, LS_TITLE, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { isDocked } from '../panels/placement';
import { Press } from '../ui/Press';
import { Surface } from '../ui/Surface';
import { ScoreCell } from './ScoreCell';

/**
 * The seam between two cells, either way round. `axis` is the RULE'S OWN
 * direction: a row of cells is ruled vertically, and the halved fourth cell
 * stacks its two, which needs the same 1px the other way.
 */
function Divider({ axis = 'v' }: { axis?: 'v' | 'h' }) {
  const t = useTheme();
  const v = axis === 'v';
  return (
    <View
      style={{
        flexGrow: 0, flexShrink: 0,
        width: v ? 1 : '60%', height: v ? '60%' : 1,
        alignSelf: 'center',
        backgroundColor: t.rule,
      }}
    />
  );
}

/**
 * A HAND-COUNTED NUMBER AND THE WORD FOR IT — the fourth footer cell, or one
 * half of it.
 *
 * Two of these exist because the cell counts two things: timeouts always, and
 * possessions when `options.poss` says so. One tap is one of them, and the
 * running count sits in the cell so the tap and its result never need a second
 * glance. UNDO takes one back — both go through the same snapshot as every stat.
 *
 * `half` is what the split costs, and it is a SIZE and not a layout: the cell
 * keeps its full quarter of the row and gives up its height instead, so the
 * word still has the width to be a word. Halving the row would leave about
 * 45pt for `Timeout` beside a number on a phone in portrait, which is a cell
 * that clips its own label.
 *
 * A HALF IS UNDER THE 48pt TAP FLOOR AND THERE IS NO WAY IT IS NOT: `m.ftr` is
 * 59–74 whole, so half of it is about 30 however it is spent. It is the one
 * place on the board that goes under, and it is paid for in the other
 * dimension — a half is the footer's full quarter WIDE, 85pt on the narrowest
 * phone this runs on and 150 in landscape, which is a target no thumb misses
 * vertically-centred. Growing the footer instead would move `computeMetrics`'
 * court arithmetic for a setting, which is a court that changes size when a
 * switch is flipped.
 */
function CountCell({
  label,
  spoken,
  count,
  onPress,
  targetId,
  half = false,
}: {
  /** what the cell PRINTS — one word, and it is what the tour's title names */
  label: string;
  /** what the cell IS, for the screen reader: a verb, because it is a button */
  spoken: string;
  count: number;
  onPress(): void;
  targetId: 'poss' | 'timeout';
  /** one of two stacked halves rather than the whole cell */
  half?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();
  const fs = half ? m.fsXs : m.fsNav;

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${spoken}, ${count} so far`}
      targetId={targetId}
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: half ? m.s1 : m.s2,
        paddingHorizontal: m.s1,
      }}
      pressedStyle={{ backgroundColor: t.press }}
    >
      {/* the word yields first: on the narrowest footer the count is the half
          that carries information, so it never shrinks */}
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={{
          flexShrink: 1,
          minWidth: 0,
          // A VERB IN THE CORNER IS A WORD, so it is the body face and it is
          // not shouted — the same `fUi` the two verbs at the ends take.
          ...fUi(600),
          fontSize: fs,
          letterSpacing: ls(fs, LS_BTN),
          color: t.ink,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          ...fNum(700),
          fontSize: half ? m.fsNav : m.fsNavLg,
          color: t.accent,
          fontVariant: ['tabular-nums'],
        }}
      >
        {count}
      </Text>
    </Press>
  );
}

/**
 * UNDO | score · clock · quarter | TIMEOUT — **four parts, 1 / 2 / 1**, and
 * split is the whole layout. Every cell grows off a `flexBasis:0`, so nothing
 * sizes to its own text and nothing bunches at the left.
 *
 * **The readout takes the middle and takes double.** It is three numbers where
 * either flank is one word, so an even quarter each starved it; and the middle
 * is where the eye goes, which is the right place for the only part of the row
 * that is read rather than pressed. The two verbs keep the corners, furthest
 * apart, which is also the cheapest thing to do for a mis-tap.
 *
 * The score moved down here off the OPP column, which is why `computeMetrics`
 * no longer subtracts a score strip in portrait — that row is gone and the
 * court has its height. **The clock and the quarter are two cells with a rule
 * between them**, not one block: they are two different controls and used to be
 * told apart only by a shared tint.
 *
 * There is still no PLAY button and no CLOCK button — the time IS the clock
 * control — but its state is now carried by the **ink**, not by a fill. The
 * red/green gradient behind the pair is gone, so a running clock reads accent
 * and a stopped one reads danger, which is the same fact in the same place at a
 * quarter of the paint. Stopped is the base state, so a board nobody has
 * touched still reads red.
 *
 * **And that ink stands down while a panel is open.** The scrim darkens the
 * FILL and not the glyph, so a coloured clock survives it intact and goes on
 * reading "on" — directly beside the quarter cell, which is the one control the
 * scrim genuinely cuts a hole for. Two things reading as lit is one too many, so
 * the clock takes `ink2` for as long as anything is over the board.
 *
 * THE FOURTH CELL IS A HAND-COUNTED NUMBER, and it is where END used to be.
 * Ending a game is a once-a-night decision and it now lives on the quarter
 * panel behind the period label, next to the other thing that ends; a number
 * tapped dozens of times a game belongs on the board. Losing END also lost the
 * arm-then-confirm dance the footer needed to make a mis-tap survivable — the
 * confirm panel is still there, one level in.
 *
 * **TIMEOUTS HAVE THAT CELL AND POSSESSIONS ARE THE OPT-IN HALF OF IT.** Every
 * game has timeouts and every scorer has to know how many are gone; a
 * possession count is forty taps a quarter bought for one figure, which is a
 * trade only some scorers want to make — so `options.poss` is what SPLITS the
 * cell, and it splits it into two STACKED halves. See `CountCell`: the cell
 * keeps its quarter of the row, which is the dimension a word needs, and pays
 * in height, which is the dimension this row has to spare.
 */
export function Footer() {
  const m = useMetrics();
  const t = useTheme();
  const { ref, onLayout } = useMeasure('footer');
  const rects = useRects();

  const remaining = useGameStore((s) => s.remaining);
  const period = useGameStore((s) => s.period);
  const running = useGameStore((s) => s.running);
  const ended = useGameStore((s) => s.ended);
  const possessions = useGameStore((s) => s.possessions);
  const timeouts = useGameStore((s) => s.timeouts);
  // read LIVE, not stamped at tip-off: the switch shows and hides a count the
  // game holds either way. See `Options.poss`.
  const split = useGameStore((s) => s.options.poss === 'on');
  const setRunning = useGameStore((s) => s.setRunning);
  const undo = useGameStore((s) => s.undo);
  const addPossession = useGameStore((s) => s.addPossession);
  const addTimeout = useGameStore((s) => s.addTimeout);

  const panel = useUiStore((s) => s.panel);
  const open = useUiStore((s) => s.open);
  // the quarter cell stays lit through the whole chain it opens — the quarter
  // menu, SET CLOCK and END GAME are all one tap of this cell. UNDO, the clock
  // and the counted cell open nothing, so they light under the finger and no
  // longer.
  const lit = useUiStore((s) => litControl(s.panel, s.what) === 'quarter');
  const hole = useLitRect(lit);

  // a docked panel runs the full height of the column beside the court, which
  // is over the counted cell. The footer gives back exactly the overlap so the
  // cells re-centre in what is left instead of hiding under it. Which kinds
  // dock is asked, never listed here — see components/panels/placement.
  const trim = isDocked(panel) ? dockFooterOverlap(rects) : 0;

  /** One part of the row, or one cell of the middle: the same rule at both. */
  const cell = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignSelf: 'stretch' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: m.s2,
    paddingHorizontal: m.s1,
  };

  // A VERB IN THE CORNER IS A WORD, so it is the body face and it is not
  // shouted. It was `fNum` in caps, which is what every label in this app used
  // to be — a number's face on a word, set as if the row were an alarm.
  const navText = {
    ...fUi(600),
    fontSize: m.fsNav,
    letterSpacing: ls(m.fsNav, LS_BTN),
  };

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      style={{ height: m.ftr, flexGrow: 0, flexShrink: 0, paddingRight: trim }}
    >
      <Surface
        style={{
          flex: 1,
          minHeight: m.tap,
          borderWidth: 1,
          borderColor: t.rule,
          borderRadius: m.r,
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <Press
          onPress={undo}
          accessibilityLabel="undo the last entry"
          targetId="undo"
          style={cell}
          pressedStyle={{ backgroundColor: t.press }}
        >
          <Text numberOfLines={1} style={{ ...navText, color: t.ink }}>
            Undo
          </Text>
        </Press>

        <Divider />

        {/* The middle, and DOUBLE: three numbers, three controls, ruled
            apart. The clock and the quarter were one tinted block and are now
            two cells, which is what they always were.

            The four PARTS are 1/2/1; these three cells are 1.25/0.95/0.80, and
            deliberately uneven. `108 : 99` is six digits and `07:24` is four,
            so an even split starves the score. The quarter is three characters
            and used to be three characters a step SMALLER, which is what its
            old 0.70 was cut to; now that it renders at the same size as the two
            beside it, `2ND` needs the tenth back and the clock — which has the
            most slack of the three — is where it comes from. The weights sum to
            3, so the block itself is unchanged whatever they are. */}
        <View style={{ ...cell, flexGrow: 2, gap: 0, paddingHorizontal: 0 }}>
          <ScoreCell grow={1.25} />

          <Divider />

          <Press
            onPress={() => setRunning(!running)}
            accessibilityLabel="start or stop the clock"
            targetId="clock"
            style={{ ...cell, flexGrow: 0.95, gap: 0 }}
            pressedStyle={{ backgroundColor: t.press }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...fNum(700),
                fontSize: m.fsFtr,
                letterSpacing: ls(m.fsFtr, LS_TIGHT),
                // the clock's state, in ink rather than in a fill — and the ink
                // STANDS DOWN while a panel is up. The scrim darkens fills, not
                // glyphs, so under it this is the only coloured thing left in
                // the row and it goes on reading "on" right beside the one cell
                // that is genuinely lit. Nobody glances at a run/stop state
                // through a modal; the quarter panel prints the time in its own
                // header anyway.
                //
                // RUNNING IS `live`, NOT `accent`. This one cell means one
                // thing running and the opposite stopped, and it is read at a
                // glance from the bench — `accent` is orange now and lands
                // twenty degrees from `danger`, which is not a difference a
                // glance can make. `live` is the teal that used to be the
                // accent, kept for exactly this.
                color: panel ? t.ink2 : running ? t.live : t.danger,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {mmss(remaining)}
            </Text>
          </Press>

          <Divider />

          <Press
            onPress={() => { if (!ended) open({ kind: 'endQuarter' }); }}
            accessibilityLabel="end this quarter or adjust the clock"
            innerRef={hole.ref}
            onLayout={hole.onLayout}
            targetId="quarter"
            style={{
              ...cell,
              flexGrow: 0.8,
              gap: 0,
              backgroundColor: lit ? t.press : 'transparent',
            }}
            pressedStyle={{ backgroundColor: t.press }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...fUi(600),
                // the same step as the score and the clock: the three numbers
                // in the middle read as one row, and the quarter no longer
                // looks like a caption for the two beside it. The weight is
                // still 600 — it is a label made of letters, not a count.
                fontSize: m.fsFtr,
                letterSpacing: ls(m.fsFtr, LS_TITLE),
                color: t.ink2,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {ord(period)}
            </Text>
          </Press>
        </View>

        <Divider />

        {/* THE TIMEOUT COUNT, OR BOTH COUNTS STACKED — `options.poss` decides,
            and it is the only thing on this row that a setting moves. */}
        {split ? (
          <View style={{ ...cell, flexDirection: 'column', gap: 0, paddingHorizontal: 0 }}>
            <CountCell
              half
              label="Poss"
              spoken="add a possession"
              count={possessions}
              onPress={() => { if (!ended) addPossession(); }}
              targetId="poss"
            />
            <Divider axis="h" />
            <CountCell
              half
              label="Timeout"
              spoken="add a timeout"
              count={timeouts}
              onPress={() => { if (!ended) addTimeout(); }}
              targetId="timeout"
            />
          </View>
        ) : (
          <CountCell
            label="Timeout"
            spoken="add a timeout"
            count={timeouts}
            onPress={() => { if (!ended) addTimeout(); }}
            targetId="timeout"
          />
        )}
      </Surface>
    </View>
  );
}
