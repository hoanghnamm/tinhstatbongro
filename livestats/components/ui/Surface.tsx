import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * Anything whose fill is the plain surface. On the two glass skins it frosts
 * instead: that is the one rule the token table cannot express, because a blur
 * needs the fill to be see-through while `surface` doubles as the ink colour on
 * an inverted bar.
 *
 * `pressed` deliberately drops back to an opaque tint — the press feedback is
 * the only touch confirmation the board has and must not lose to the frosting.
 */
export function Surface({
  style,
  children,
  pressed = false,
  innerRef,
  onLayout,
  ...rest
}: {
  style?: ViewStyle | ViewStyle[];
  children?: ReactNode;
  pressed?: boolean;
  innerRef?: React.Ref<View>;
  onLayout?(): void;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}) {
  const t = useTheme();
  const fill = pressed ? t.surface2 : t.surface;

  if (!t.glass || pressed) {
    return (
      <View {...rest} ref={innerRef} onLayout={onLayout} style={[{ backgroundColor: fill }, style]}>
        {children}
      </View>
    );
  }

  return (
    // innerRef is deliberately not forwarded here: BlurView's ref type is not a
    // View's, and the only surface that is measured (the rail) would need a cast
    // to say otherwise. Wrap this in a plain measured View if a glass skin ever
    // has to feed the layout store.
    <BlurView
      {...rest}
      onLayout={onLayout}
      intensity={40}
      tint={t.dark ? 'dark' : 'light'}
      style={[
        { backgroundColor: withAlpha(t.surface, 0.58), borderColor: withAlpha(t.ink, 0.14) },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}
