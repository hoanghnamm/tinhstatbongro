/**
 * Shot geometry on the 792 × 521 court: basket at (396, 76), three-point arc
 * r = 352, paint x ∈ [277, 513] & y ≤ 276, corner cut-off y ≤ 203.7 with
 * x ≤ 68 or x ≥ 724.
 *
 * Every cut below is a line that is actually PAINTED on the floor in
 * CourtSvg.tsx — the lane, the free-throw line extended at y = 101, the corner
 * stub at y = 203.7, the three-point line, and the two lane extensions. The
 * drawing is the contract: this file answers where a tap landed, the eleven
 * closed paths there light that answer, and the two are one geometry written
 * twice. Neither may be changed alone, and neither may drift off a drawn line.
 */
import { THREES } from '../constants/game';
import type { Position, ShotType, Zone, ZoneSide } from '../types';

/**
 * Where a free throw is taken: the centre of the free-throw line, court
 * (396, 276) on the same 792 × 521 viewBox.
 *
 * It is a court MARK and nothing more. `zoneFor` is deliberately never run on
 * it: a free throw is not a field-goal attempt, so ANY zone it answered would
 * be a wrong attempt in the splits. The answer is also boundary noise — the
 * spot IS the lane's top edge, and 0.53 (276 normalised to 3 dp) lands a tenth
 * of a unit outside `y ≤ 276`, so it reads `top2` where 276 itself reads
 * `paint`. One more reason not to ask.
 */
export const FT_SPOT: Position = { x: 0.5, y: 0.53 };

export function zoneFor(nx: number, ny: number): Zone {
  const x = nx * 792,
    y = ny * 521;
  if (x >= 277 && x <= 513 && y <= 276) return 'paint';
  const three = (y <= 203.7 && (x <= 68 || x >= 724)) || Math.hypot(x - 396, y - 76) > 352;
  // The corner ends where the floor says it ends, and THE TWO CUTS ARE AT
  // DIFFERENT HEIGHTS because that is what is painted: inside the arc it is the
  // free-throw line extended (y = 101, drawn lane edge → three-point line);
  // outside it, the stub the three-point line turns on (y = 203.7, drawn
  // three-point line → sideline). So the boundary steps at x = 68 / 724.
  if (y <= (three ? 203.7 : 101)) return three ? 'corner3' : 'corner2';
  // The two lane extensions, (310,276)→(187,521) and (480,276)→(603,521): one
  // slope, mirrored about the LANE's centre 395 — not about the basket at 396,
  // which is why the two zones either side of the top are not mirror images.
  const spread = ((y - 276) * 123) / 245;
  const top = y >= 276 && x >= 310 - spread && x <= 480 + spread;
  return ((top ? 'top' : 'wing') + (three ? 3 : 2)) as Zone;
}

/** Which mirrored half lit up. The paint and the two top zones are single regions. */
export const zoneSide = (zone: Zone, nx: number): ZoneSide =>
  zone === 'paint' || zone.startsWith('top') ? 'c' : nx < 0.5 ? 'l' : 'r';

/**
 * Derived from the zone, never decided separately. There is deliberately no
 * manual 2/3 override: zoneFor is the only arc call in the app, which is what
 * stops the zone and the shot type disagreeing.
 */
export const shotTypeFor = (nx: number, ny: number): ShotType =>
  zoneFor(nx, ny) in THREES ? '3PT' : '2PT';

/** Clamped and rounded to 3 dp, because event payloads are stored and compared. */
export const normalise = (px: number, size: number): number =>
  +Math.min(1, Math.max(0, size > 0 ? px / size : 0)).toFixed(3);
