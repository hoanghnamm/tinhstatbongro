import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COURT_H, COURT_LINES, COURT_W, RIM, ZONE_PATHS } from '../../lib/court';
import { useTheme } from '../../theme/useTheme';
import type { Zone, ZoneSide } from '../../types';

/**
 * The court, drawn from `lib/court.ts`'s own strings.
 *
 * **The line work is the drawing, and the drawing is the contract** — every
 * zone fill ends exactly on a line that is already painted on the floor, and
 * every line that bounds a region is a zone edge:
 *
 *   the lane          x = 277 / 513, y = 276      the paint
 *   y = 101           lane edge → 3PT straight    corner2 | wing2
 *   y = 203.7         3PT straight → sideline     corner3 | wing3
 *   the 3PT line      x = 68 / 724 + the arc      2PT | 3PT
 *   the extensions    (310,276)→(187,521)         wing | top
 *                     (480,276)→(603,521)
 *
 * **The two corner cuts are at different heights on purpose** — that is what
 * is drawn. Inside the arc the corner ends at the free-throw line extended
 * (101); outside it, at the stub the three-point line turns on (203.7). So the
 * boundary steps at x = 68 / 724, and `lib/court.ts` says exactly that.
 *
 * THIS FILE NO LONGER CARRIES THE PARTITION. It did while it was the only
 * thing in the app that drew a court; the stats screen draws the same floor
 * twice over, and two component-local copies of eleven closed paths is the
 * one thing `lib/court.ts` exists to prevent. So every renderer reads
 * `ZONE_PATHS` and `COURT_LINES`, and `lib/selfcheck.ts` rasterises those.
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
   * work. It reads the SAME eleven paths the lit fill does, and both mirrored
   * halves of a zone take its colour, because a zone is one bucket in
   * `zoneSplits` however many regions draw it.
   */
  heat?: Partial<Record<Zone, string>> | null;
}

function CourtSvgImpl({ zone, side, heat = null }: Props) {
  const t = useTheme();
  const lit = ZONE_PATHS.find((z) => z.zone === zone && z.side === side);

  return (
    <Svg viewBox={`0 0 ${COURT_W} ${COURT_H}`} width="100%" height="100%">
      <Rect x="0" y="0" width={COURT_W} height={COURT_H} fill={t.court} />

      {heat &&
        ZONE_PATHS.map((z) =>
          heat[z.zone] ? <Path key={z.zone + z.side} d={z.d} fill={heat[z.zone]} /> : null,
        )}

      {lit && <Path d={lit.d} fill={t.accent} fillOpacity={0.3} />}

      {COURT_LINES.map((d) => (
        <Path key={d} d={d} fill="none" stroke={t.courtLine} strokeWidth={2} />
      ))}
      <Circle cx={RIM.cx} cy={RIM.cy} r={RIM.r} fill={t.courtLine} />
    </Svg>
  );
}

export const CourtSvg = memo(CourtSvgImpl);
