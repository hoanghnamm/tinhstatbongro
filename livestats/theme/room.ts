import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMetrics } from './metrics';

/** Off-board reading measure. Nothing in the live board consumes this ramp. */
export const ROOM_WIDTH = 700;

export function useRoomMetrics() {
  const m = useMetrics();
  const safe = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const width = Math.max(0, Math.min(ROOM_WIDTH, m.win.w - safe.left - safe.right - m.s4 * 2));
  return {
    width,
    narrow: width < m.tap * 10 * fontScale,
  };
}
