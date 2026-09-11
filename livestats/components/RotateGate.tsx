import { useEffect } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { useMetrics } from '../theme/metrics';
import { DARK, LS_BTN, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Bloom } from './ui/Bloom';
import { DarkRoom } from './ui/DarkRoom';

/**
 * A phone held upright cannot show this board: the court is aspect-locked at
 * 792×521 and everything else on screen is sized off what it leaves, so on a
 * 390pt-wide screen the floor is ~250pt tall and the five rail rows, the action
 * bar and the footer have to share what is under it. The portrait layout exists
 * and is not going anywhere — it is the TABLET layout (an 820×1180 iPad in
 * portrait is wide but must stack), so this gate is keyed on portrait AND a
 * narrow screen, never on orientation alone.
 */
const NARROW = 700;

export function usePortraitBlocked(): boolean {
  const { width, height } = useWindowDimensions();
  const portrait = height > width;
  const narrow = Math.min(width, height) < NARROW; // phones only
  return portrait && narrow;
}

/* ---- the glyph ------------------------------------------------------
 * Two stacked SVGs in one square box: a static ring of arrows whose opacity
 * pulses, and a phone that turns a quarter of a circle inside it. Both are
 * drawn in a 100-unit viewBox and scaled by `m.rot`.
 * -------------------------------------------------------------------- */

const R = 42; // the arrow ring
const C = 50; // its centre, and the box's
const HEAD = 15; // how far an arrowhead reaches back along the tangent
const WING = 9; // and how far it spreads either side of it

const n = (v: number) => v.toFixed(2);

/** 0° is 3 o'clock and the angle grows CLOCKWISE, because y grows downward. */
const at = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a), a };
};

const arc = (a0: number, a1: number) => {
  const p0 = at(a0);
  const p1 = at(a1);
  return `M${n(p0.x)} ${n(p0.y)}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${n(p1.x)} ${n(p1.y)}`;
};

/** The head that closes an arc: a triangle standing on the tangent at `deg`. */
const head = (deg: number) => {
  const { x, y, a } = at(deg);
  const tx = -Math.sin(a);
  const ty = Math.cos(a); // clockwise tangent
  const nx = Math.cos(a);
  const ny = Math.sin(a); // radial
  const bx = x - tx * HEAD;
  const by = y - ty * HEAD;
  return `M${n(x)} ${n(y)}L${n(bx + nx * WING)} ${n(by + ny * WING)}L${n(bx - nx * WING)} ${n(by - ny * WING)}Z`;
};

// half a ring each, 180° apart: over the top from 9 o'clock, and under the
// bottom from 3 o'clock. Each arc stops short of its own head so the two meet
// rather than overlap.
const ARC_TOP = arc(180, 330);
const ARC_BOTTOM = arc(0, 150);
const HEAD_TOP = head(344);
const HEAD_BOTTOM = head(164);

const HOLD = 820; // the pause at each end, where the arrows read 0.25
const SPIN = { duration: 620, easing: Easing.inOut(Easing.cubic) };

/**
 * THE GATE IS A ROOM, AND THE ROOM IS THE LOBBY'S.
 *
 * Everything else on this route is the board — the one LIGHT screen in the app,
 * read at arm's length in a gym — and the gate is the one thing on it that is
 * NOT the board: nothing is being played while it is up, and nothing on it is
 * read at arm's length. So it is drawn the way every other screen in the app is
 * drawn: `DarkRoom` for the palette and the status bar, the `Bloom` for the
 * warm corner. (There was a `Pinstripe` under that bloom on every one of these
 * screens and it is gone from all of them.) Turning the phone is then the same
 * "lights coming up" the lobby → board walk already is, rather than a white
 * sheet dropping over a white board.
 *
 * The wrapper is OUTSIDE the animated view and the `blocked` test is above it,
 * so `DarkRoom`'s focus effect mounts with the gate and its cleanup puts the
 * board's dark status-bar ink back the moment the device is turned.
 */
export function RotateGate() {
  const blocked = usePortraitBlocked();
  /**
   * THE ROOM THIS IS MOUNTED IN MAY ALREADY BE DARK — `options.board` — and a
   * second `DarkRoom` inside one is a status bar stranded: the inner cleanup
   * hands the bar back to the ROOT's `dark` ink when the gate goes down, and
   * the outer provider has no effect left to re-run. So the wrapper is only
   * mounted over a LIGHT board, which is the only board that needs it.
   */
  const dark = useTheme() === DARK;
  if (!blocked) return null;

  if (dark) return <Gate />;

  return (
    <DarkRoom>
      <Gate />
    </DarkRoom>
  );
}

/**
 * The one thing on screen while the phone is upright. It covers the board, the
 * panels and the toast (zIndex 80) and swallows every touch, because a tap that
 * lands on a board this cramped is a mis-entry in a live game.
 *
 * It is mounted only while the gate is up, which is what lets the spin be an
 * effect with nothing to test: the component exists exactly as long as the
 * animation should be running.
 */
function Gate() {
  const m = useMetrics();
  const t = useTheme();
  const reduced = useReducedMotion();

  // ONE shared value. The arrows are derived from the rotation itself, so the
  // pulse cannot drift out of step with the turn, and the holds at 0 and 90
  // land on 0.25 without anything having to say so.
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    rotation.value = 0;
    rotation.value = withRepeat(
      withSequence(
        withDelay(HOLD, withTiming(90, SPIN)),
        withDelay(HOLD, withTiming(0, SPIN)),
      ),
      -1,
    );
    return () => cancelAnimation(rotation);
  }, [reduced, rotation]);

  const phone = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const arrows = useAnimatedStyle(() => ({
    opacity: interpolate(rotation.value, [0, 45, 90], [0.25, 1, 0.25]),
  }));

  const box = m.rot;
  const glyph = { position: 'absolute' as const, width: box, height: box };

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(200)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      accessible
      accessibilityLiveRegion="assertive"
      accessibilityLabel="Rotate the device to landscape to use the board"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.spLg,
        paddingHorizontal: m.s5,
        backgroundColor: t.bg,
      }}
    >
      {/* the ground, and it is the same ONE layer every other screen draws:
          the warm corner. It is absolute and eats no taps, so it disturbs
          neither the centred column nor the overlay's job of swallowing every
          touch. */}
      <Bloom />

      {/* a fixed square: a column parent would otherwise stretch it wide */}
      <View style={{ width: box, height: box, flexGrow: 0, flexShrink: 0 }}>
        {/* reduced motion holds the phone in the PORTRAIT pose — a landscape
            one would contradict the line under it — and the arrows keep their
            full ink, since nothing is left to carry the meaning otherwise */}
        <Animated.View style={[glyph, reduced ? { opacity: 1 } : arrows]}>
          <Svg width={box} height={box} viewBox="0 0 100 100">
            <Path d={ARC_TOP} stroke={t.ink} strokeWidth={6} strokeLinecap="round" fill="none" />
            <Path d={ARC_BOTTOM} stroke={t.ink} strokeWidth={6} strokeLinecap="round" fill="none" />
            <Path d={HEAD_TOP} fill={t.ink} />
            <Path d={HEAD_BOTTOM} fill={t.ink} />
          </Svg>
        </Animated.View>

        <Animated.View style={[glyph, phone]}>
          <Svg width={box} height={box} viewBox="0 0 100 100">
            <Rect
              x={36} y={22} width={28} height={56} rx={6}
              stroke={t.ink} strokeWidth={5} fill="none"
            />
            <Rect x={45} y={27.5} width={10} height={2.5} rx={1.25} fill={t.ink} />
            <Rect x={44} y={70} width={12} height={2.5} rx={1.25} fill={t.ink} />
          </Svg>
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', gap: m.s2 }}>
        <Text
          style={{
            color: t.ink,
            ...fUi(600),
            // fsLg, not fsXl: the block is two lines — the instruction and the
            // reason — and one step down is what keeps the instruction on one of
            // them. 19 characters at fsLg come to ~290 of the 342 a 390pt phone
            // has between the paddings, and the margin only widens from there
            // (a 320pt screen is short, so the vh ramp drops the type with it).
            // Left wrappable anyway: a break is survivable, a truncation is not.
            fontSize: m.fsLg,
            lineHeight: m.fsLg * 1.15,
            letterSpacing: ls(m.fsLg, LS_BTN),
            textAlign: 'center',
          }}
        >
          Rotate to landscape
        </Text>
      </View>
    </Animated.View>
  );
}
