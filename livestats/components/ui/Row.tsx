import type { ReactNode, Ref } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Layout primitives that encode the three CSS→React Native differences this
 * board kept tripping over. Use these instead of a bare `<View>` whenever the
 * CSS being ported said `display:flex`.
 *
 *   1. `display:flex` in CSS lays out a ROW. In RN the default is COLUMN, so a
 *      ported rule without `flex-direction:column` needs `Row`.
 *   2. A column container defaults to `alignItems:'stretch'`, so a fixed-size
 *      child grows to full width unless it says otherwise — hence `Fixed`.
 *   3. Centering is never inherited. `align-items:center` plus
 *      `justify-content:center` has to be stated on the box itself — `Center`.
 */

interface BoxProps {
  children?: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** NativeWind classes for the fixed tokens (colours, hairlines) */
  className?: string;
  /** cross axis */
  align?: ViewStyle['alignItems'];
  /** main axis */
  justify?: ViewStyle['justifyContent'];
  flex?: number;
  /** for the boxes the panel placement measures */
  innerRef?: Ref<View>;
  onLayout?(): void;
}

/** A horizontal run of things, vertically centred — the common case by far. */
export function Row({
  children, gap, style, align = 'center', justify, flex, className, innerRef, onLayout,
}: BoxProps) {
  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
      className={className}
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flex },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A vertical stack. Explicit, so a reader never has to remember the default. */
export function Col({
  children, gap, style, align, justify, flex, className, innerRef, onLayout,
}: BoxProps) {
  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
      className={className}
      style={[
        { flexDirection: 'column', alignItems: align, justifyContent: justify, gap, flex },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Both axes centred, stated on the box. */
export function Center({
  children, gap, style, flex, className, innerRef, onLayout, row = false,
}: BoxProps & { row?: boolean }) {
  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
      className={className}
      style={[
        {
          flexDirection: row ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap,
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A child that must keep its own size. `flexShrink:0` plus explicit dimensions,
 * because a column parent would otherwise stretch it to full width and a row
 * parent would squeeze it to nothing.
 */
export function Fixed({
  children,
  width,
  height,
  style,
  center = false,
}: {
  children?: ReactNode;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  center?: boolean;
}) {
  return (
    <View
      style={[
        {
          width,
          height,
          flexGrow: 0,
          flexShrink: 0,
          alignItems: center ? 'center' : undefined,
          justifyContent: center ? 'center' : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
