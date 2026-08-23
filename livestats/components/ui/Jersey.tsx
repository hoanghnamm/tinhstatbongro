import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useMetrics } from '../../theme/metrics';
import {
  BLOOM_END,
  BLOOM_START,
  BLOOM_STOPS,
  LS_BTN,
  LS_TIGHT,
  fDisplay,
  fNum,
  ls,
  plateWash,
  withAlpha,
} from '../../theme/tokens';
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
 * ── THE PLATE IS DRESSED, AND ALL OF IT IS GROUND ──────────────────────────
 *
 * Three layers under the number, in the order they are drawn:
 *
 *   1. THE MONOGRAM — the club's initials in `fDisplay`, oversized and bled off
 *      the far corner at 16% of the accent. It is the mark stamped on a real
 *      shirt, and it is the club's rather than the player's for exactly that
 *      reason: five plates in the rail wear one mark, the way five shirts do.
 *   2. THE CORNER BLOOM — `plateWash` on the room's own axis, so a plate is lit
 *      from the same corner as the screen it is standing on.
 *   3. THE ACCENT EDGE — a 2px rule down the left, which is the one solid thing
 *      here. A wash needs a hard edge somewhere or it reads as a smudge.
 *
 * **NONE OF IT COUNTS AGAINST WHAT ACCENT MEANS**, by the same argument that
 * lets `Bloom` off: it names nothing, it is behind everything, and no control
 * is picked out by it. The number on top is what is read.
 *
 * **AND IT IS THE RESTING PLATE'S ALONE.** `selected` and `out` are STATES —
 * a starter, a player who has fouled out — and a state is the whole of what
 * that plate is saying. Warming a red slab with an orange corner is two
 * messages in one 40pt box, and the orange would be the louder of them.
 *
 * **THE MONOGRAM NEEDS A PLATE TO SIT ON, so it is gated on `m.tap`.** The
 * picker draws a 40×34 plate and the rail draws a 64×80 one; two initials at
 * display size in the smaller of those is texture nobody can name. `tap` is
 * the ramp's own floor for a thing a finger is meant to find, which is the
 * right line for a thing an eye is meant to notice. The wash and the edge cross
 * it — both are legible at any size a plate is ever drawn at.
 */
export type JerseyTone = 'floor' | 'selected' | 'out';

export function Jersey({
  number,
  w,
  h,
  tone = 'floor',
  monogram,
}: {
  number: number;
  w: number;
  h: number;
  tone?: JerseyTone;
  /** The club's initials. Omitted, the plate simply wears no mark. */
  monogram?: string;
}) {
  const m = useMetrics();
  const t = useTheme();

  const fill = tone === 'out' ? t.danger : tone === 'selected' ? t.accentInk : t.court;
  const ink = tone === 'out' ? t.dangerInk : tone === 'selected' ? t.accent : t.courtLine;
  const fs = Math.min(h * 0.62, w * 0.62);

  const dressed = tone === 'floor';
  const mono = dressed && h >= m.tap ? (monogram ?? '').trim() : '';
  const monoFs = h * 0.86;

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
        // the three layers below are absolute and oversized on purpose; the
        // clip is what keeps them inside the plate's own corners. There is no
        // shadow here to lose to it — a plate sits ON the rail, not over it.
        overflow: 'hidden',
        backgroundColor: fill,
      }}
    >
      {mono !== '' && (
        <Text
          numberOfLines={1}
          accessible={false}
          style={{
            position: 'absolute',
            right: -w * 0.12,
            bottom: -h * 0.24,
            ...fDisplay(),
            fontSize: monoFs,
            // Anton is tall and condensed with almost no descender, so a line
            // box under about 1.15 clips the caps rather than saving space
            lineHeight: monoFs * 1.2,
            letterSpacing: ls(monoFs, LS_BTN),
            color: withAlpha(t.accent, 0.16),
          }}
        >
          {mono}
        </Text>
      )}

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
