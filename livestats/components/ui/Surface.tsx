import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/useTheme';

/**
 * Anything whose fill is the plain surface.
 *
 * It used to frost on the two glass skins, which is why it is a component and
 * not a style object. Those skins are gone and the blur went with them, but the
 * component stays: every filled box on the board goes through it, so it is the
 * one place a surface rule can be changed once.
 *
 * `pressed` drops to the canvas — the press feedback is the only touch
 * confirmation the board has.
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

  return (
    <View
      {...rest}
      ref={innerRef}
      onLayout={onLayout}
      style={[{ backgroundColor: pressed ? t.surface2 : t.surface }, style]}
    >
      {children}
    </View>
  );
}
