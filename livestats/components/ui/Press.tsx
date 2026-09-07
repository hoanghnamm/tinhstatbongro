import { useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type View, type ViewStyle } from 'react-native';

import { useMergedRef, useTutorialTarget } from '../../hooks/useTutorialTarget';
import type { TargetId } from '../../constants/tutorial';

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
  /**
   * The one gesture beyond a tap this app has, and it has exactly one caller:
   * deleting a saved game. It is here rather than on a gesture handler because
   * a second interaction vocabulary for one destructive action — which already
   * has a confirm panel behind it — is not worth a dependency.
   */
  onLongPress?(): void;
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
   * THE NAME THE WALKTHROUGH KNOWS THIS CONTROL BY, and the only thing a
   * control has to do to be spotlit.
   *
   * It is a prop rather than a wrapper because a wrapper would take the flex
   * rules and leave the paint on the child — the same argument `innerRef` is
   * here for, one layer up. Setting it costs a real game nothing: see
   * `hooks/useTutorialTarget.ts`, which measures only while the tour is open.
   *
   * The two refs are MERGED, not chosen between. Three of the tour's targets
   * are controls the scrim already cuts a hole for, so both hooks want this
   * node and React takes one ref per node.
   */
  targetId?: TargetId;
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
  onLongPress,
  disabled = false,
  accessibilityLabel,
  innerRef,
  onLayout,
  targetId,
  children,
}: PressProps) {
  const [pressed, setPressed] = useState(false);
  const target = useTutorialTarget(targetId);
  const ref = useMergedRef(innerRef, target.ref);

  // both, always, and in that order — the scrim's hole and the tour's are two
  // different questions about the same node
  const layout = (): void => {
    onLayout?.();
    target.onLayout?.();
  };

  return (
    <Pressable
      ref={ref}
      onLayout={layout}
      onPress={onPress}
      onLongPress={onLongPress}
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
