import { useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type View, type ViewStyle } from 'react-native';

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
   * Same convention as `Surface`. A control the scrim has to cut a hole for
   * must be measurable, and wrapping one in a plain View to get a ref would put
   * the flex rules on the wrapper and the paint on the child.
   */
  innerRef?: React.Ref<View>;
  onLayout?(): void;
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
  innerRef,
  onLayout,
  children,
}: PressProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      ref={innerRef}
      onLayout={onLayout}
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
