import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Rect } from '../../store/layoutStore';

/** The sheet, a step lighter than a panel's — see the note on double-dimming. */
const SCRIM = 'rgba(0,0,0,0.5)';

/**
 * THE SHEET WITH A HOLE IN IT, AND THE HOLE IS LIVE.
 *
 * ## WHY IT IS ONE PATH AND NOT FOUR BANDS
 *
 * `PanelHost`'s scrim is four rectangles tiled around the lit control, which is
 * the right construction there and the wrong one here: four rectangles cannot
 * round a corner, and this cut-out has to match the radius of the control it is
 * cut around or the ring reads as a box drawn near a button rather than around
 * it. One `Path` with `fillRule="evenodd"` — the window, then the rounded
 * rect — is exact by construction, the same argument `lib/court.ts` makes for
 * eleven closed paths over five wedges and two masks.
 *
 * ## THE PAINT AND THE BLOCK ARE TWO DIFFERENT LAYERS
 *
 * An `<Svg>` that swallowed touches would swallow them over the hole as well,
 * which is the one place they have to land — the whole point of running the
 * tour on the real board is that the scorer performs the real action. So the
 * SVG is `pointerEvents="none"` and the blocking is done by FOUR TRANSPARENT
 * BANDS around the hole, on the gesture responder system rather than on a press
 * component: they have nothing to DO when tapped except refuse to let the tap
 * through, and `onStartShouldSetResponder` is how a plain View says that.
 *
 * The bands are `Math.round`ed for the reason the panel's are: whole pixels, so
 * the four edges meet rather than leaving a hairline of live board along a
 * fractional boundary. Unlike the panel's they MAY overlap harmlessly — nothing
 * is painted here, so there is no darker seam to draw.
 *
 * ## AND WHY IT IS SOMETIMES NOT DRAWN AT ALL
 *
 * When the thing being pointed at IS an open panel, `PanelHost` has already put
 * a scrim over everything but that panel — which is the spotlight, already
 * drawn, by the component whose job it is. Painting a second one over the top
 * would be two sheets compositing into a hole nobody can see out of. The
 * overlay asks for `paint={false}` in that case and keeps only the blocking,
 * which the panel's own scrim does not do the way the tour needs.
 */
export function Spotlight({
  hole,
  radius,
  paint = true,
}: {
  hole: Rect | null;
  radius: number;
  /** false while a panel is already doing the dimming; see above */
  paint?: boolean;
}) {
  // no box yet — a step whose control has not reported one gets a plain sheet
  // rather than a hole in the wrong place
  if (!hole) {
    return (
      <View
        onStartShouldSetResponder={() => true}
        pointerEvents="auto"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: paint ? SCRIM : 'transparent',
        }}
      />
    );
  }

  const x = Math.round(hole.x);
  const y = Math.round(hole.y);
  const w = Math.round(hole.w);
  const h = Math.round(hole.h);
  // a radius wider than the box is a shape, not a rounding
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));

  const band = { position: 'absolute' as const, backgroundColor: 'transparent' };
  const block = () => true;

  return (
    <>
      {paint && (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <Svg width="100%" height="100%">
            <Path d={sheet(x, y, w, h, r)} fill={SCRIM} fillRule="evenodd" />
          </Svg>
        </View>
      )}

      {/* the four bands: everything but the hole refuses the tap */}
      <View
        onStartShouldSetResponder={block}
        style={{ ...band, left: 0, right: 0, top: 0, height: Math.max(0, y) }}
      />
      <View
        onStartShouldSetResponder={block}
        style={{ ...band, left: 0, right: 0, top: y + h, bottom: 0 }}
      />
      <View
        onStartShouldSetResponder={block}
        style={{ ...band, left: 0, width: Math.max(0, x), top: y, height: h }}
      />
      <View
        onStartShouldSetResponder={block}
        style={{ ...band, left: x + w, right: 0, top: y, height: h }}
      />
    </>
  );
}

/**
 * The window, then the rounded rect, as one string.
 *
 * `100%` is not a thing a path can say, so the outer rectangle is drawn absurdly
 * large rather than measured: the SVG is sized by its container and clips, so
 * any rectangle that certainly covers the window is the same rectangle. The
 * inner contour is written out corner by corner — four lines and four arcs,
 * `A r r 0 0 1` for each, which is the small-arc, positive-sweep quarter turn.
 */
function sheet(x: number, y: number, w: number, h: number, r: number): string {
  const outer = 'M-9999 -9999 H19998 V19998 H-19998 Z';
  if (r <= 0) return `${outer} M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  return (
    `${outer} ` +
    `M${x + r} ${y} ` +
    `H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
    `V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} ` +
    `H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}
