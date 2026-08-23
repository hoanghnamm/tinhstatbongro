import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export type BadgeTone = 'quiet' | 'on' | 'warn' | 'out';

/**
 * A small count pill. It is a PILL, not a bar: it carries its own width from its
 * text and never stretches, which in a column parent means saying `alignSelf`
 * and `flexShrink:0` out loud.
 *
 * `inverted` is for the one case where the row underneath is already accent —
 * the badge then flips to the accent's ink so it stays legible.
 */
export function Badge({
  value,
  tone = 'quiet',
  inverted = false,
  style,
}: {
  value: number | string;
  tone?: BadgeTone;
  inverted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const m = useMetrics();
  const t = useTheme();

  const bg =
    tone === 'out' ? t.danger
    : tone === 'warn' ? t.accent
    : tone === 'on' ? t.accent
    : inverted ? t.accentInk
    : t.surface2;

  const fg =
    tone === 'out' ? t.dangerInk
    : tone === 'warn' || tone === 'on' ? t.accentInk
    : inverted ? t.accent
    : t.ink2;

  return (
    <View
      style={[
        {
          flexGrow: 0,
          flexShrink: 0,
          alignSelf: 'center',
          minWidth: m.s5,
          paddingHorizontal: m.s1,
          paddingVertical: 2,
          borderRadius: 99,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...fNum(700),
          fontSize: m.fsSm,
          lineHeight: m.fsSm * 1.25,
          color: fg,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
