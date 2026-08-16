/**
 * Shot geometry on the 792 × 521 court: basket at (396, 76), three-point arc
 * r = 352, paint x ∈ [277, 513] & y ≤ 276, corner cut-off y ≤ 203.7 with
 * x ≤ 68 or x ≥ 724.
 *
 * These constants ARE the SVG path data in CourtSvg.tsx — the two are one
 * geometry written twice, and neither may be changed alone.
 */
import { THREES } from '../constants/game';
import type { ShotType, Zone, ZoneSide } from '../types';

export function zoneFor(nx: number, ny: number): Zone {
  const x = nx * 792,
    y = ny * 521;
  if (x >= 277 && x <= 513 && y <= 276) return 'paint';
  const three = (y <= 203.7 && (x <= 68 || x >= 724)) || Math.hypot(x - 396, y - 76) > 352;
  // Math.max(0, y - 76) flattens anything above the rim line onto the baseline,
  // so a shot from behind the backboard is a corner, not a wing. That is what
  // lets every sector be a single wedge the SVG can draw as one path.
  const a = (Math.atan2(Math.max(0, y - 76), x - 396) * 180) / Math.PI;
  const sector = a < 22.5 || a > 157.5 ? 'corner' : a < 67.5 || a > 112.5 ? 'wing' : 'top';
  return (sector + (three ? 3 : 2)) as Zone;
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
