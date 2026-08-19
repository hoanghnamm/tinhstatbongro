/**
 * Shot geometry on the 792 × 521 court: basket at (396, 76), three-point arc
 * r = 352, paint x ∈ [277, 513] & y ≤ 276, corner cut-off y ≤ 203.7 with
 * x ≤ 68 or x ≥ 724.
 *
 * Every cut below is a line that is actually PAINTED on the floor — the lane,
 * the free-throw line extended at y = 101, the corner stub at y = 203.7, the
 * three-point line, and the two lane extensions. The drawing is the contract,
 * and it is at the foot of this file: this half answers where a tap landed,
 * `ZONE_PATHS` down there shades that answer, and the two are one geometry
 * written twice. Neither may be changed alone, and neither may drift off a
 * drawn line — `CourtSvg.tsx` and the PDF export both read the strings rather
 * than carrying a copy.
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

/* ------------------------------------------------------------------ *
 * The drawing
 *
 * The partition above answers WHERE A TAP LANDED; the strings below are the
 * same geometry as SHAPES, and the two are one thing written twice. They lived
 * in `CourtSvg.tsx` while that component was the only thing that drew a court.
 * It is not any more — the PDF export draws the same floor into a print sheet —
 * and a second copy of the partition is the one thing this file exists to
 * prevent, so both renderers read these.
 *
 * `lib/selfcheck.ts` rasterises `ZONE_PATHS` and asserts all 412,632 cells of
 * the viewBox resolve to the zone `zoneFor` names, and it asserts every line a
 * zone edge sits on is still in `COURT_LINES`. **These strings and `zoneFor`
 * change together or not at all.**
 * ------------------------------------------------------------------ */

/** The viewBox everything on the floor is written in. */
export const COURT_W = 792;
export const COURT_H = 521;

/**
 * The eleven zones as eleven EXACT CLOSED PATHS. The only two vertices not read
 * straight off the drawing are where each lane extension crosses the arc —
 * (540.6904, 396.8874) and (249.6808, 396.1479) — and they are solved, not
 * eyeballed. **The two sides are not mirrors**: the extensions are symmetric
 * about the lane's centre 395, the arc about the basket at 396, so the two
 * crossings differ by three quarters of a unit in y.
 */
export const ZONE_PATHS: { zone: Zone; side: ZoneSide; d: string }[] = [
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

/**
 * The line work, in the order it is painted. Nine of these bound a zone and are
 * asserted; the backboard, the rim's arc and the free-throw circle bound
 * nothing — they are markings, and no one reads a circle as a zone edge.
 */
export const COURT_LINES: string[] = [
  'M277 0 L277 276 M513 0 L513 276', // the lane
  'M277 276 L513 276', // the free-throw line
  'M68 101 L277 101', // the 2PT corner cut, both ends
  'M513 101 L724 101',
  'M0 203.7 L68 203.7', // the 3PT corner cut, both ends
  'M724 203.7 L792 203.7',
  'M350 11 L442 11', // the backboard
  'M335 12 L335 32.5 A60.5 60.5 0 0 0 456 32.5 L456 12', // the restricted area
  'M311 276 A85 85 0 0 0 481 276', // the free-throw circle, its solid half only
  'M310 276 L187 521', // the lane extensions
  'M480 276 L603 521',
  'M68 0 L68 203.7 A352 352 0 0 0 724 203.7 L724 0', // the three point line
];

/** The rim, which is the one mark on the floor that is not a stroke. */
export const RIM = { cx: 396, cy: 23, r: 12.5 };
