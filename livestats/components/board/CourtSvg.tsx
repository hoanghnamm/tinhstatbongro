import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Mask, Path, Rect } from 'react-native-svg';

import { useTheme } from '../../theme/useTheme';
import type { Zone, ZoneSide } from '../../types';

/**
 * The court, transcribed from the web build's inline SVG. Every `d` string is
 * byte-for-byte the original: this geometry IS `zoneFor()`, and the two must be
 * edited together or never.
 *
 * The eleven zone shapes are five sectors drawn twice over, deliberately
 * oversized and cut down by `courtClip` and the `m2` / `m3` masks, which encode
 * the arc and the two corner boxes exactly as `zoneFor` does. They are never
 * hit-tested — the wrapper owns the pointer — and only the one matching
 * `zone`/`side` is lit.
 *
 * Fills arrive as props rather than as CSS classes: `var()` inside an SVG
 * presentation attribute is what forced classes on the web, and that problem
 * does not exist here.
 */
interface Props {
  zone: Zone | null;
  side: ZoneSide | null;
}

const ZN = [
  { zone: 'corner2', side: 'r', d: 'M396 -400 L1600 -400 L1600 574.7 L396 76 Z' },
  { zone: 'corner2', side: 'l', d: 'M396 -400 L-808 -400 L-808 574.7 L396 76 Z' },
  { zone: 'wing2', side: 'r', d: 'M396 76 L2243.8 841.4 L1161.4 1923.8 Z' },
  { zone: 'wing2', side: 'l', d: 'M396 76 L-369.4 1923.8 L-1451.8 841.4 Z' },
  { zone: 'top2', side: 'c', d: 'M396 76 L1161.4 1923.8 L-369.4 1923.8 Z' },
] as const;

const three = (z: (typeof ZN)[number]) => ({ ...z, zone: z.zone.replace('2', '3') as Zone });

function CourtSvgImpl({ zone, side }: Props) {
  const t = useTheme();
  const hot = (z: string, s: string) => (z === zone && s === side ? 0.3 : 0);

  return (
    <Svg viewBox="0 0 792 521" width="100%" height="100%">
      <Rect x="0" y="0" width="792" height="521" fill={t.court} />
      {/* lane blocks */}
      <Rect x="277" y="0" width="30" height="276" fill={t.lane} fillOpacity={0.45} />
      <Rect x="482.5" y="0" width="30.5" height="276" fill={t.lane} fillOpacity={0.45} />

      <Defs>
        <ClipPath id="courtClip">
          <Rect x="0" y="0" width="792" height="521" />
        </ClipPath>
        {/* inside the arc, outside the corners, outside the paint */}
        <Mask id="m2" maskUnits="userSpaceOnUse" x="0" y="0" width="792" height="521">
          <Rect x="0" y="0" width="792" height="521" fill="#000" />
          <Circle cx="396" cy="76" r="352" fill="#fff" />
          <Rect x="0" y="0" width="68" height="203.7" fill="#000" />
          <Rect x="724" y="0" width="68" height="203.7" fill="#000" />
          <Rect x="277" y="0" width="236" height="276" fill="#000" />
        </Mask>
        {/* beyond the arc, plus the two corner boxes */}
        <Mask id="m3" maskUnits="userSpaceOnUse" x="0" y="0" width="792" height="521">
          <Rect x="0" y="0" width="792" height="521" fill="#fff" />
          <Circle cx="396" cy="76" r="352" fill="#000" />
          <Rect x="0" y="0" width="68" height="203.7" fill="#fff" />
          <Rect x="724" y="0" width="68" height="203.7" fill="#fff" />
        </Mask>
      </Defs>

      <G clipPath="url(#courtClip)">
        <Rect
          x="277" y="0" width="236" height="276"
          fill={t.accent} fillOpacity={hot('paint', 'c')}
        />
        <G mask="url(#m2)">
          {ZN.map((z) => (
            <Path
              key={z.zone + z.side} d={z.d}
              fill={t.accent} fillOpacity={hot(z.zone, z.side)}
            />
          ))}
        </G>
        <G mask="url(#m3)">
          {ZN.map(three).map((z) => (
            <Path
              key={z.zone + z.side} d={z.d}
              fill={t.accent} fillOpacity={hot(z.zone, z.side)}
            />
          ))}
        </G>
      </G>

      {/* lane lines + free throw line */}
      <Path
        d="M277 0 L277 276 M307 0 L307 276 M483 0 L483 276 M513 0 L513 276"
        fill="none" stroke={t.courtLine} strokeWidth={2}
      />
      <Path d="M277 276 L513 276" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* free throw line extended + edge stubs */}
      <Path d="M68 101 L277 101" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M513 101 L724 101" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M0 203.7 L68 203.7" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path d="M724 203.7 L792 203.7" fill="none" stroke={t.courtLine} strokeWidth={2} />
      {/* backboard, rim, restricted area */}
      <Path d="M350 55 L442 55" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path
        d="M335 56 L335 76.5 A60.5 60.5 0 0 0 456 76.5 L456 56"
        fill="none" stroke={t.courtLine} strokeWidth={2}
      />
      <Circle cx="396" cy="67" r="12.5" fill={t.courtLine} />
      {/* free throw circle: solid below the line, dashed inside the lane */}
      <Path d="M311 276 A85 85 0 0 0 481 276" fill="none" stroke={t.courtLine} strokeWidth={2} />
      <Path
        d="M311 276 A85 85 0 0 1 481 276"
        fill="none" stroke={t.courtLine} strokeWidth={2} strokeDasharray="21 15"
      />
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
