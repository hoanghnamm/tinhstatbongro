import { Platform, StyleSheet, Text } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { BLOOM_END, BLOOM_START, glowInk } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

/**
 * ORANGE INK, LIT — an accent letter or number painted with `glowInk` instead
 * of filled flat, so the type catches the same corner light the room does.
 *
 * THE RULE IS THE INK, NOT THE CALL SITE. This renders a PLAIN `Text` unless
 * the colour it was handed IS the palette's accent, which is what lets every
 * conditional site stay one line: a score that is `won ? t.accent : t.ink`
 * glows when it is orange and is ordinary ink when it is not, with no second
 * branch to keep in step. Swapping a `Text` for a `GlowText` is therefore
 * always safe — a component that never goes orange simply never lights.
 *
 * WHICH IS ALSO HOW THE BOARD STAYS OUT OF IT. `app/game.tsx` draws no bloom
 * and no ground of any kind, because a court read at arm's length in a gym spends every
 * gram of contrast on the marks — so the board's own accent text (the POSS
 * count, a made tile) keeps `Text` and is never handed this. The rule is a
 * matter of which components import it, not of a palette check: the dark board
 * is still the board.
 *
 * IT IS A MASK, WHICH IS TWO COPIES OF THE STRING. React Native has no
 * text-gradient at any level — Fabric included — so the only general way is a
 * `MaskedView` whose mask is the type and whose child is the ramp. The child
 * needs something to size it, and that something is the SAME string rendered
 * transparent; anything else (a fixed height, a measured box) is a second
 * layout that drifts from the first the moment the face or the ramp changes.
 *
 * THE TWO COPIES ARE HIDDEN FROM THE SCREEN READER AND THE WRAPPER SPEAKS.
 * Otherwise a jersey number is announced twice, once for the mask and once for
 * the copy holding the gradient open.
 *
 * WEB FALLS BACK TO FLAT. `react-native-web` has no honest mask for this, and
 * a wordmark that renders as an empty rectangle is worse than one that renders
 * in a solid orange — so on web the ink is simply the accent.
 */
export function GlowText({
  children,
  style,
  containerStyle,
  numberOfLines,
  accessibilityLabel,
}: {
  children: ReactNode;
  /** the text style, ink included — it is read to decide whether this lights */
  style?: StyleProp<TextStyle>;
  /**
   * LAYOUT GOES HERE, NOT IN `style`. The mask is a `View` wrapping two copies
   * of the type, so a `flex` or a `minWidth` meant for the text box has to
   * land on the wrapper — spent on the inner `Text` it would size a child of
   * the thing it was supposed to size.
   */
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const flat = StyleSheet.flatten(style) ?? {};
  const lit = flat.color === t.accent && Platform.OS !== 'web';

  const label = (
    <Text numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );

  if (!lit) {
    return containerStyle ? (
      <Text numberOfLines={numberOfLines} style={[style, containerStyle as StyleProp<TextStyle>]}>
        {children}
      </Text>
    ) : (
      label
    );
  }

  return (
    <MaskedView
      style={containerStyle}
      accessible
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      maskElement={
        <Text
          numberOfLines={numberOfLines}
          style={style}
          importantForAccessibility="no-hide-descendants"
        >
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={glowInk(t.accent) as unknown as readonly [string, string]}
        start={BLOOM_START}
        end={BLOOM_END}
      >
        {/* the same string, invisible — it is what holds the ramp open */}
        <Text
          numberOfLines={numberOfLines}
          style={[style, { opacity: 0 }]}
          importantForAccessibility="no-hide-descendants"
        >
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
