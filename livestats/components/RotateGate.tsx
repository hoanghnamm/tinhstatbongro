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
import { LS_BTN, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

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
 * The one thing on screen while the phone is upright. It covers the board, the
 * panels and the toast (zIndex 80) and swallows every touch, because a tap that
 * lands on a board this cramped is a mis-entry in a live game.
 */
export function RotateGate() {
  const m = useMetrics();
  const t = useTheme();
  const reduced = useReducedMotion();
  const blocked = usePortraitBlocked();

  // ONE shared value. The arrows are derived from the rotation itself, so the
  // pulse cannot drift out of step with the turn, and the holds at 0 and 90
  // land on 0.25 without anything having to say so.
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!blocked || reduced) return;
    rotation.value = 0;
    rotation.value = withRepeat(
      withSequence(
        withDelay(HOLD, withTiming(90, SPIN)),
        withDelay(HOLD, withTiming(0, SPIN)),
      ),
      -1,
    );
    return () => cancelAnimation(rotation);
  }, [blocked, reduced, rotation]);

  const phone = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const arrows = useAnimatedStyle(() => ({
    opacity: interpolate(rotation.value, [0, 45, 90], [0.25, 1, 0.25]),
  }));

  if (!blocked) return null;

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
        <Text
          style={{
            color: t.ink2,
            ...fUi(500),
            fontSize: m.fsSm,
            textAlign: 'center',
          }}
        >
          Your device may be in orientation lock.
        </Text>
      </View>
    </Animated.View>
  );
}
