import { Text, View } from 'react-native';

import { mmss, ord } from '../../lib/format';
import { litControl } from '../../lib/lit';
import { useGameStore } from '../../store/gameStore';
import { dockFooterOverlap, useLitRect, useMeasure, useRects } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_TIGHT, LS_TITLE, fNum, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { isDocked } from '../panels/placement';
import { Press } from '../ui/Press';
import { Surface } from '../ui/Surface';
import { ScoreCell } from './ScoreCell';

function Divider() {
  const t = useTheme();
  return (
    <View
      style={{
        flexGrow: 0, flexShrink: 0,
        width: 1, height: '60%',
        alignSelf: 'center',
        backgroundColor: t.rule,
      }}
    />
  );
}

/**
 * UNDO | score · clock · quarter | POSS — **four parts, 1 / 2 / 1**, and the
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
 * POSS is where END used to be. Ending a game is a once-a-night decision and it
 * now lives on the quarter panel behind the period label, next to the other
 * thing that ends; a possession is tapped dozens of times and belongs on the
 * board. Losing END also lost the arm-then-confirm dance the footer needed to
 * make a mis-tap survivable — the confirm panel is still there, one level in.
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
  const setRunning = useGameStore((s) => s.setRunning);
  const undo = useGameStore((s) => s.undo);
  const addPossession = useGameStore((s) => s.addPossession);

  const panel = useUiStore((s) => s.panel);
  const open = useUiStore((s) => s.open);
  // the quarter cell stays lit through the whole chain it opens — the quarter
  // menu, SET CLOCK and END GAME are all one tap of this cell. UNDO, POSS and
  // the clock open nothing, so they light under the finger and no longer.
  const lit = useUiStore((s) => litControl(s.panel, s.what) === 'quarter');
  const hole = useLitRect(lit);

  // a docked panel runs the full height of the column beside the court, which
  // is over POSS. The footer gives back exactly the overlap so the cells
  // re-centre in what is left instead of hiding under it. Which kinds dock is
  // asked, never listed here — see components/panels/placement.
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

  const navText = {
    fontFamily: fNum(600),
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
          style={cell}
          pressedStyle={{ backgroundColor: t.press }}
        >
          <Text numberOfLines={1} style={{ ...navText, color: t.ink }}>
            UNDO
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
            style={{ ...cell, flexGrow: 0.95, gap: 0 }}
            pressedStyle={{ backgroundColor: t.press }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(700),
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
                fontFamily: fNum(600),
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
              {ord(period).toUpperCase()}
            </Text>
          </Press>
        </View>

        <Divider />

        {/* one tap is one possession, and the running count sits in the cell so
            the tap and its result never need a second glance. UNDO takes one
            back — POSS goes through the same snapshot as every stat. */}
        <Press
          onPress={() => { if (!ended) addPossession(); }}
          accessibilityLabel={`add a possession, ${possessions} so far`}
          style={cell}
          pressedStyle={{ backgroundColor: t.press }}
        >
          {/* the word yields first: on the narrowest footer the count is the
              half that carries information, so it never shrinks */}
          <Text
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{ ...navText, flexShrink: 1, minWidth: 0, color: t.ink }}
          >
            POSS
          </Text>
          <Text
            numberOfLines={1}
            style={{
              flexGrow: 0,
              flexShrink: 0,
              fontFamily: fNum(700),
              fontSize: m.fsNavLg,
              color: t.accent,
              fontVariant: ['tabular-nums'],
            }}
          >
            {possessions}
          </Text>
        </Press>
      </Surface>
    </View>
  );
}
