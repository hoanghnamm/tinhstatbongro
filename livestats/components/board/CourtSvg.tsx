import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../../theme/useTheme';
import type { Zone, ZoneSide } from '../../types';

/**
 * The court. **The line work below is the drawing, and the drawing is the
 * contract** — every zone fill here ends exactly on a line that is already
 * painted on the floor, and every line that bounds a region is a zone edge:
 *
 *   the lane          x = 277 / 513, y = 276      the paint
 *   y = 101           lane edge → 3PT straight    corner2 | wing2
 *   y = 203.7         3PT straight → sideline     corner3 | wing3
 *   the 3PT line      x = 68 / 724 + the arc      2PT | 3PT
 *   the extensions    (310,276)→(187,521)         wing | top
 *                     (480,276)→(603,521)
 *
 * The backboard, the rim and the free-throw circle bound nothing; they are
 * markings, and no one reads a circle as a zone edge.
 *
 * **The two corner cuts are at different heights on purpose** — that is what
 * is drawn. Inside the arc the corner ends at the free-throw line extended
 * (101); outside it, at the stub the three-point line turns on (203.7). So the
 * boundary steps at x = 68 / 724, and `lib/court.ts` says exactly that.
 *
 * `ZN` is the eleven zones as eleven EXACT CLOSED PATHS. The only two vertices
 * not read straight off the drawing are where each lane extension crosses the
 * arc — (540.6904, 396.8874) and (249.6808, 396.1479) — and they are solved,
 * not eyeballed. **The two sides are not mirrors**: the extensions are
 * symmetric about the lane's centre 395, the arc about the basket at 396, so
 * the two crossings differ by three quarters of a unit in y.
 *
 * This replaced five oversized wedges cut down by a `courtClip` and two
 * `Mask`s, which encoded angular sectors the floor has no line for. A closed
 * path is exact by construction and needs no `Defs`.
 *
 * `lib/selfcheck.ts` rasterises the `d` strings below and asserts all 412,632
 * cells of the viewBox resolve to the zone `zoneFor` names. **These strings
 * and `lib/court.ts` change together or not at all.**
 *
 * The zones are never hit-tested — the wrapper owns the pointer — and only the
 * one matching `zone`/`side` is rendered at all. Fills arrive as props rather
 * than as CSS classes: `var()` inside an SVG presentation attribute is what
 * forced classes on the web, and that problem does not exist here.
 */
interface Props {
  zone: Zone | null;
  side: ZoneSide | null;
  /**
   * The stats screen's zone chart: one fill per zone, painted under the line
   * work. It reads the SAME eleven paths the lit fill does — a second copy of
   * the partition for the chart is the one thing this file exists to prevent —
   * and both mirrored halves of a zone take its colour, because a zone is one
   * bucket in `zoneSplits` however many regions draw it.
   */
  heat?: Partial<Record<Zone, string>> | null;
}

const ZN: { zone: Zone; side: ZoneSide; d: string }[] = [
  { zone: 'paint', side: 'c', d: 'M277 0 L513 0 L513 276 L277 276 Z' },
  { zone: 'corner2', side: 'r', d: 'M513 0 L724 0 L724 101 L513 101 Z' },
  { zone: 'corner2', side: 'l', d: 'M277 0 L68 0 L68 101 L277 101 Z' },
  { zone: 'corner3', side: 'r', d: 'M724 0 L792 0 L792 203.7 L724 203.7 Z' },
  { zone: 'corner3', side: 'l', d: 'M68 0 L0 0 L0 203.7 L68 203.7 Z' },
  { zone: 'wing2', side: 'r', d: 'M513 101 L724 101 L724 203.7 A352 352 0 0 1 540.6904 396.8874 L480 276 L513 276 Z' },
  { zone: 'wing2', side: 'l', d: 'M277 101 L68 101 L68 203.7 A352 352 0 0 0 249.6808 396.1479 L310 276 L277 276 Z' },
  { zone: 'wing3', side: 'r', d: 'M724 203.7 L792 203.7 L792 521 L603 521 L540.6904 396.8874 A352 352 0 0 0 724 203.7 Z' },
  { zone: 'wing3', side: 'l', d: 'M68 203.7 L0 203.7 L0 521 L187 521 L249.6808 396.1479 A352 352 0 0 1 68 203.7 Z' },
  { zone: 'top2', side: 'c', d: 'M310 276 L480 276 L540.6904 396.8874 A352 352 0 0 1 249.6808 396.1479 Z' },
  { zone: 'top3', side: 'c', d: 'M540.6904 396.8874 L603 521 L187 521 L249.6808 396.1479 A352 352 0 0 0 540.6904 396.8874 Z' },
];
function CourtSvgImpl({ zone, side, heat = null }: Props) {
  const t = useTheme();
  const lit = ZN.find((z) => z.zone === zone && z.side === side);

  return (
    <Svg viewBox="0 0 792 521" width="100%" height="100%">
      <Rect x="0" y="0" width="792" height="521" fill={t.court} />

      {heat &&
        ZN.map((z) =>
          heat[z.zone] ? <Path key={z.zone + z.side} d={z.d} fill={heat[z.zone]} /> : null,
        )}

      {lit && <Path d={lit.d} fill={t.accent} fillOpacity={0.3} />}

      {/* lane lines + free throw line — the lane is the paint's own edge and
          nothing more; the shaded blocks and their inner rails are gone */}
      <Path
        d="M277 0 L277 276 M513 0 L513 276"
        fill="none" stroke={t.courtLine} strokeWidth={2}
      />
      <Path d="M277 276 L513 276" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* free throw line extended + edge stubs */}
      <Path d="M68 101 L277 101" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M513 101 L724 101" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M0 203.7 L68 203.7" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M724 203.7 L792 203.7" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* backboard, rim, restricted area — pushed back to a fifth of its old
          gap off the baseline (55 → 11), the whole group shifted by the same 44 */}
      <Path d="M350 11 L442 11" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path
        d="M335 12 L335 32.5 A60.5 60.5 0 0 0 456 32.5 L456 12"
        fill="none" stroke={t.courtLine} strokeWidth={2}
      />
      <Circle cx="396" cy="23" r="12.5" fill={t.courtLine} />
      {/* free throw circle: the solid half below the line only — the dashed
          half that ran up inside the lane is gone */}
      <Path d="M311 276 A85 85 0 0 0 481 276" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* lane extension lines */}
      <Path d="M310 276 L187 521" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M480 276 L603 521" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* three point line */}
      <Path
        d="M68 0 L68 203.7 A352 352 0 0 0 724 203.7 L724 0"
        fill="none" stroke={t.courtLine} strokeWidth={2}
      />
    </Svg>
  );
}

export const CourtSvg = memo(CourtSvgImpl);
