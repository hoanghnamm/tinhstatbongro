import { useEffect } from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import type { Rect } from '../../store/layoutStore';
import type { Position } from '../../types';

/** One full cycle: down, ripple, back, wait. */
const CYCLE = 1200;

/**
 * THE TAP, LOOPING, OVER WHATEVER THE STEP IS POINTING AT.
 *
 * Three things at the same point, which between them are what a tap looks like:
 * a RIPPLE that starts at the contact point and runs out, a DOT that is the
 * contact itself, and the HAND, which is `gesture-tap` out of the tab bar's own
 * icon set because a second icon family on one screen reads as a screen
 * borrowed from another app.
 *
 * ## IT IS OFFSET DOWN AND RIGHT, AND THAT IS THE WHOLE POINT
 *
 * A hand drawn centred on a button covers the button. The glyph is placed so
 * its own contact point — the top-left of `gesture-tap`, where the fingertip
 * is — sits on the target's centre, which puts the hand itself over the empty
 * quarter below and right of it. `HAND_BIAS` is that offset as a share of the
 * glyph, and it is the only number here that was found by looking rather than
 * derived.
 *
 * ## REDUCE MOTION GETS A RING AND NOTHING ELSE
 *
 * This app's rule is that reduced motion kills the animation outright —
 * `hooks/useReducedMotion.ts` says so and `Court`, `PanelHost` and `Toast` all
 * obey it — so the fallback here is a STATIC accent ring around the target
 * rather than a pulsing one. A pulse is still motion, and a scorer who has
 * asked for none has asked for none. The ring says the same thing the loop
 * does: this, here.
 *
 * ## THE COURT IS POINTED AT BY THE SPOT, NOT BY THE MIDDLE
 *
 * Every control is one thing, so its centre is where a finger belongs. The
 * floor is seven zones, and its centre is a two — which is the wrong place to
 * be hovering while the caption says *out past the arc*. `spot` is a share of
 * the target's own box, exactly as a shot's position is, and `lib/tutorial.ts`
 * derives it from the step's own SHOW so the hand and the app's own tap can
 * never point at two different zones. Absent, it is the middle again.
 *
 * ## IT IS `pointerEvents="none"`, ALWAYS
 *
 * It is drawn over the one live hole on the screen. A decoration that ate the
 * tap it is asking for would be the tour refusing to be finished.
 */
export function Finger({ at, spot }: { at: Rect | null; spot?: Position | null }) {
  const m = useMetrics();
  const t = useTheme();
  const reduced = useReducedMotion();

  // the cycle, 0 → 1, and everything below is a function of it
  const beat = useSharedValue(0);

  useEffect(() => {
    if (reduced || !at) return;
    beat.value = 0;
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: CYCLE * 0.3, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: CYCLE * 0.3, easing: Easing.in(Easing.quad) }),
        // the wait is what makes it read as a tap rather than as a throb
        withDelay(CYCLE * 0.4, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(beat);
  }, [beat, reduced, at]);

  const hand = useAnimatedStyle(() => ({
    transform: [
      { translateY: beat.value * 6 },
      { scale: 1 - beat.value * 0.12 },
    ],
    opacity: 0.85 + beat.value * 0.15,
  }));

  // the ring runs OUT and fades, which is the half that says contact was made
  const ripple = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + beat.value * 1.1 }],
    opacity: beat.value * 0.55,
  }));

  if (!at) return null;

  const cx = at.x + (spot ? spot.x * at.w : at.w / 2);
  const cy = at.y + (spot ? spot.y * at.h : at.h / 2);
  const glyph = Math.round(Math.min(44, Math.max(28, m.fs2xl)));
  const ring = glyph * 1.15;

  /* -- reduced motion: the ring the loop would have drawn, held still -- */
  if (reduced) {
    // AROUND THE SPOT WHEN THERE IS ONE. A ring around the whole floor says
    // "the court", which is the one thing the step pointing at a zone is not
    // saying — the same argument the offset above makes about the hand.
    if (spot) {
      return (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: cx - ring / 2,
            top: cy - ring / 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 3,
            borderColor: t.accent,
          }}
        />
      );
    }
    const pad = 4;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: at.x - pad,
          top: at.y - pad,
          width: at.w + pad * 2,
          height: at.h + pad * 2,
          borderWidth: 3,
          borderColor: t.accent,
          borderRadius: m.rSm + pad,
        }}
      />
    );
  }

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: cx - ring / 2,
            top: cy - ring / 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 2,
            borderColor: t.accent,
          },
          ripple,
        ]}
      />

      {/* the contact point itself, and it does not move: the hand comes down to
          it, which is the only way the offset reads as a fingertip landing */}
      <View
        style={{
          position: 'absolute',
          left: cx - 4,
          top: cy - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: t.accent,
        }}
      />

      <Animated.View
        style={[
          {
            position: 'absolute',
            // the glyph's contact point is its top-left corner, so the box is
            // hung from the target's centre rather than centred on it
            left: cx - glyph * HAND_BIAS,
            top: cy - glyph * HAND_BIAS,
          },
          hand,
        ]}
      >
        <MaterialCommunityIcons name="gesture-tap" size={glyph} color={t.accent} />
      </Animated.View>
    </View>
  );
}

/** Where the fingertip sits inside the `gesture-tap` glyph's own box. */
const HAND_BIAS = 0.22;
