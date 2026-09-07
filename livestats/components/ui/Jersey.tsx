import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useMetrics } from '../../theme/metrics';
import {
  BLOOM_END,
  BLOOM_START,
  BLOOM_STOPS,
  LS_TIGHT,
  fNum,
  ls,
  plateWash,
} from '../../theme/tokens';
import type { Palette } from '../../theme/tokens';
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
 *
 * ── THE PLATE IS DRESSED, AND BOTH LAYERS ARE GROUND ───────────────────────
 *
 * Two layers under the number, in the order they are drawn:
 *
 *   1. THE CORNER BLOOM — `plateWash` on the room's own axis, so a plate is lit
 *      from the same corner as the screen it is standing on.
 *   2. THE ACCENT EDGE — a 2px rule down the left, which is the one solid thing
 *      here. A wash needs a hard edge somewhere or it reads as a smudge.
 *
 * **THERE WAS A THIRD AND IT IS GONE: THE CLUB'S MONOGRAM.** Two initials in
 * `fDisplay`, oversized and bled off the far corner at 16% of the accent. The
 * idea was right and the SURFACE was wrong — a mark that says whose board this
 * is belongs on the rooms you stand in around a game, not inside a control a
 * scorer is reading a two-digit number off mid-possession. It moved to the
 * rooms as a PINSTRIPE, and the pinstripe has since been cut as well, so the
 * mark now lives nowhere. Do not put one back on this plate.
 *
 * **NEITHER LAYER COUNTS AGAINST WHAT ACCENT MEANS**, by the same argument that
 * lets `Bloom` off: it names nothing, it is behind everything, and no control
 * is picked out by it. The number on top is what is read.
 *
 * **AND IT IS THE RESTING PLATE'S ALONE.** `selected` and `out` are STATES —
 * a starter, a player who has fouled out — and a state is the whole of what
 * that plate is saying. Warming a red slab with an orange corner is two
 * messages in one 40pt box, and the orange would be the louder of them.
 */
export type JerseyTone = 'floor' | 'selected' | 'out';

/**
 * The plate's type size and its ink, exported for the ONE caller that draws
 * neither — the TEAM tab, which lays a `TextInput` over a `blank` plate so the
 * number can be typed on it. Both are re-derived below rather than there, so a
 * typed number and a stencilled one cannot come out at different sizes.
 */
export const plateFs = (w: number, h: number) => Math.min(h * 0.62, w * 0.62);

export const plateInk = (t: Palette, tone: JerseyTone = 'floor') =>
  tone === 'out' ? t.dangerInk : tone === 'selected' ? t.accent : t.courtLine;

export function Jersey({
  number,
  w,
  h,
  tone = 'floor',
  blank,
}: {
  number: number;
  w: number;
  h: number;
  tone?: JerseyTone;
  /**
   * Draw the plate and its two ground layers and NOT the number, for a caller
   * that puts its own type over the top. The TEAM tab is the one: a jersey is
   * typed there, and a `TextInput` inside a 35pt plate is a target under the
   * tap floor — so the input is a full-height overlay and the plate underneath
   * it is only the surface. Nothing else should ask for this.
   */
  blank?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  const fill = tone === 'out' ? t.danger : tone === 'selected' ? t.accentInk : t.court;
  const ink = plateInk(t, tone);
  const fs = plateFs(w, h);

  const dressed = tone === 'floor';

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
        // the two layers below are absolute; the clip is what keeps them inside
        // the plate's own corners. There is no shadow here to lose to it — a
        // plate sits ON the rail, not over it.
        overflow: 'hidden',
        backgroundColor: fill,
      }}
    >
      {dressed && (
        <LinearGradient
          colors={plateWash(t.accent)}
          locations={BLOOM_STOPS}
          start={BLOOM_START}
          end={BLOOM_END}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      )}

      {dressed && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: t.accent,
          }}
        />
      )}

      {!blank && (
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
      )}
    </View>
  );
}
