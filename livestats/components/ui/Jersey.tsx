import { Text, View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { LS_TIGHT, fNum, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * The jersey plate: a number stencilled on the hardwood.
 *
 * It is a PLATE, not a bubble — a rectangle, so the number gets the whole
 * height of whatever box it is given rather than a circle's inscribed square,
 * which on a rail row is most of the difference between two legible digits and
 * two small ones.
 *
 * The resting pair is the FLOOR: `court` for the fill and `courtLine` for the
 * ink, the one pair in the palette that is white in every skin. The other two
 * are inversions and are written as pairs on purpose — a fill without its ink
 * is how a plate turns into a blank slab.
 *
 * Both dimensions are the caller's: the rail measures its row (a `flex:1`
 * leftover no ramp can name), the team list takes a size off the ramp. The
 * type is then sized against BOTH sides, so two digits stay inside the plate on
 * a wide rail and a short row alike.
 */
export type JerseyTone = 'floor' | 'selected' | 'out';

export function Jersey({
  number,
  w,
  h,
  tone = 'floor',
}: {
  number: number;
  w: number;
  h: number;
  tone?: JerseyTone;
}) {
  const m = useMetrics();
  const t = useTheme();

  const fill = tone === 'out' ? t.danger : tone === 'selected' ? t.accentInk : t.court;
  const ink = tone === 'out' ? t.dangerInk : tone === 'selected' ? t.accent : t.courtLine;
  const fs = Math.min(h * 0.62, w * 0.62);

  return (
    <View
      style={{
        width: w,
        height: h,
        flexGrow: 0,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: m.rSm,
        backgroundColor: fill,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          ...fNum(700),
          fontSize: fs,
          lineHeight: fs * 1.1,
          // a plate is a jersey: two digits set tight read as ONE number the
          // width of the plate, where the default tracking makes them two
          letterSpacing: ls(fs, LS_TIGHT),
          textAlign: 'center',
          color: ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {number}
      </Text>
    </View>
  );
}
