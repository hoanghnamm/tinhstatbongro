import { useGameStore } from '../store/gameStore';
import { dotColor } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * THE THREE MARKS THE FLOOR CARRIES, resolved once.
 *
 * A made shot, a miss and the free-throw spot are the whole grammar of every
 * chart in the app — the board's own court, the ZONES tab and a player's own
 * page — and they are the same grammar on all three, which is the reason this
 * is a hook and not three reads of `options` in three components. Three copies
 * of `dotColor(options.dotMade, t)` is three chances for one chart to draw a
 * make in a colour another one draws a miss in.
 *
 * It resolves through the PALETTE rather than through a stored hex, so NEUTRAL
 * is white on the board's cool floor and warm grey on the dark player page —
 * see `DotHue` in `theme/tokens.ts`.
 *
 * The zone HEAT is deliberately not here. It is `accent` at a computed alpha
 * and it is not a mark: it is a bucket's percentage painted over a slab of
 * floor, and it means the same thing whatever colour a scorer has given a dot.
 */
export interface Dots {
  made: string;
  miss: string;
  ft: string;
}

export function useDots(): Dots {
  const t = useTheme();
  const dotMade = useGameStore((s) => s.options.dotMade);
  const dotMiss = useGameStore((s) => s.options.dotMiss);
  const dotFt = useGameStore((s) => s.options.dotFt);

  return {
    made: dotColor(dotMade, t),
    miss: dotColor(dotMiss, t),
    ft: dotColor(dotFt, t),
  };
}
