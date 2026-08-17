import { View, type StyleProp, type ViewStyle } from 'react-native';

import { FOULS } from '../../constants/game';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';

/**
 * Display player fouls as a row of dots. Filled dots represent fouls incurred,
 * empty dots represent available fouls before disqualification.
 */
export function FoulDots({
  value,
  inverted = false,
  style,
}: {
  value: number;
  inverted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const m = useMetrics();
  const t = useTheme();

  const dotSize = Math.max(6, m.s1);
  const gap = m.s1 / 2;
  const dotsContainerWidth = dotSize * FOULS + gap * (FOULS - 1);

  // Determine colors based on foul count
  let dotColor: string;
  if (value >= FOULS) {
    dotColor = t.danger;
  } else if (value >= FOULS - 1) {
    dotColor = t.accent;
  } else {
    dotColor = inverted ? t.accentInk : t.ink2;
  }

  return (
    <View
      style={[
        {
          flexGrow: 0,
          flexShrink: 0,
          alignSelf: 'center',
          width: dotsContainerWidth,
          flexDirection: 'row',
          gap: gap,
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        style,
      ]}
    >
      {Array.from({ length: FOULS }).map((_, i) => (
        <View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: i < value ? dotColor : t.surface2,
            borderWidth: i < value ? 0 : 1,
            borderColor: inverted ? t.accentInk : t.ink2,
          }}
        />
      ))}
    </View>
  );
}
