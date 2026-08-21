import { LinearGradient } from 'expo-linear-gradient';

import { useMetrics } from '../../theme/metrics';
import {
  BLOOM_END,
  BLOOM_HEIGHT,
  BLOOM_START,
  BLOOM_STOPS,
  bloomWash,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE WARM CORNER EVERY TAB IS DRAWN IN, and there is one of it.
 *
 * It is the accent at low alpha falling out of the top-left and running out
 * well before the fold, so the top of a room is warm and the bottom is the
 * near-black its cards sit on. It is a GROUND and not a mark: it names nothing,
 * it is behind everything, and no control is picked out by it — which is the
 * whole reason it does not count against the two things accent is allowed to
 * mean on these screens.
 *
 * It began as the lobby's own `LinearGradient`, inline, and it is a component
 * now because four screens draw it. Four copies of three colour stops and an
 * axis is four chances for one room to sit at a different angle to the light
 * than the room next door — which is exactly the thing the eye catches when it
 * moves between two tabs.
 *
 * IT IS ALSO WHAT MAKES THE GLASS WORTH HAVING. A `BlurView` samples what is
 * behind it, so over a flat slab it is a slightly lighter flat slab; this is
 * the thing the lobby's cards and its circular control actually pick up.
 *
 * TWO RULES FOR THE CALLER, and both have bitten:
 *
 *   - `pointerEvents="none"`, because it covers the header and every control
 *     in it. A decorative layer that eats taps is invisible when it goes wrong.
 *   - It goes OUTSIDE the padded flow, as the first child of the screen's own
 *     root view, so it runs edge to edge UNDER the safe-area inset. A gradient
 *     that starts below the status bar draws a line across the top of the
 *     screen, which is the opposite of a bloom.
 */
export function Bloom() {
  const m = useMetrics();
  const t = useTheme();

  return (
    <LinearGradient
      colors={bloomWash(t.accent)}
      locations={BLOOM_STOPS}
      start={BLOOM_START}
      end={BLOOM_END}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: m.win.h * BLOOM_HEIGHT,
      }}
    />
  );
}
