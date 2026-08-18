import { View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';

/**
 * The availability dot, and it is a TOGGLE rather than decoration.
 *
 * Available is a quiet `ink3`; unavailable is `danger` — the same ink the rail
 * gives a player who cannot take the floor, because it is the same fact a day
 * earlier. A dot that is always the same colour says nothing, and the mockup's
 * always-green one said nothing twice.
 *
 * It is not an inverted surface and never will be: nothing is written inside a
 * dot, so there is no ink to lose with the fill. That is why this is its own
 * file — `selfcheck`'s pair guard exempts it by name, the way it exempts the
 * shot chart's marks, and the screens that use it stay under the guard.
 */
export function Dot({ on }: { on: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const d = Math.round(m.fsSm * 0.62);
  return (
    <View
      style={{
        width: d,
        height: d,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: d,
        backgroundColor: on ? t.ink3 : t.danger,
      }}
    />
  );
}
