import { Text, View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Badge } from './Badge';
import { Press } from './Press';

/**
 * One cell of a tile grid: an abbreviation dominant, the word under it, and an
 * optional count in the corner.
 *
 * Two rules the grid depends on:
 *
 *  - NO border and NO borderRadius. The 1px divider between tiles *is* the grid
 *    gap — a rule-coloured parent showing through 1px seams — so a tile that
 *    paints its own edge destroys the seam. Selection is drawn as an inset ring
 *    on an overlay instead, which takes no layout space.
 *  - An opaque `backgroundColor`. A transparent tile shows the rule colour
 *    through its whole face and the grid reads as one flat slab.
 */
export function Tile({
  code,
  caption,
  badge,
  selected = false,
  disabled = false,
  big = false,
  onPress,
  accessibilityLabel,
}: {
  code: string | number;
  caption?: string;
  badge?: number;
  selected?: boolean;
  disabled?: boolean;
  /** two tiles instead of four, so the abbreviation takes the next size up */
  big?: boolean;
  onPress?(): void;
  accessibilityLabel?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const size = big ? m.fs4xl : m.fs3xl;

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        position: 'relative',
        minHeight: m.tap,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.s1,
        paddingHorizontal: m.s2,
        backgroundColor: t.surface,
        opacity: disabled ? 0.38 : 1,
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      {badge !== undefined && (
        <Badge
          value={badge}
          tone={badge ? 'on' : 'quiet'}
          style={{ position: 'absolute', top: m.s2, right: m.s2, zIndex: 1 }}
        />
      )}

      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: size,
          lineHeight: size * 1.1,
          textAlign: 'center',
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {code}
      </Text>

      {!!caption && (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            maxWidth: '100%',
            textAlign: 'center',
            fontFamily: fUi(600),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_LABEL),
            color: t.ink2,
          }}
        >
          {caption}
        </Text>
      )}

      {/* the selection ring is an overlay, so it never eats a pixel of the seam */}
      {selected && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, left: 0,
            borderWidth: 2,
            borderColor: t.accent,
          }}
        />
      )}
    </Press>
  );
}
