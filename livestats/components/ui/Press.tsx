import { useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The only Pressable this app uses. Do not reach for React Native's directly.
 *
 * RN's `style={({ pressed }) => …}` form is unusable under NativeWind. Its babel
 * transform wraps every `jsx` call, and the interop resolves props by walking a
 * `["style", …]` path through `assignToTarget`:
 *
 *     if (typeof parent[prop] !== "object") parent[prop] = {}
 *
 * A function is not an object, so the entire style is replaced with `{}` and
 * every rule inside it — flexDirection, alignItems, backgroundColor — is lost
 * without a warning. Object and array styles survive, which is why half the
 * board looked right and half did not.
 *
 * So the pressed state comes from onPressIn/onPressOut and the style stays a
 * plain array.
 */
export interface PressProps {
  style?: StyleProp<ViewStyle>;
  /** merged on top of `style` while the finger is down */
  pressedStyle?: StyleProp<ViewStyle>;
  onPress?(): void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * A render prop when the CONTENT has to react to the press too — an inverted
   * button flips its ink with its fill, and dropping one half of that pair is
   * how a control turns into a blank slab.
   */
  children?: ReactNode | ((pressed: boolean) => ReactNode);
}

export function Press({
  style,
  pressedStyle,
  onPress,
  disabled = false,
  accessibilityLabel,
  children,
}: PressProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[style, pressed && !disabled ? pressedStyle : null]}
    >
      {typeof children === 'function' ? children(pressed && !disabled) : children}
    </Pressable>
  );
}
