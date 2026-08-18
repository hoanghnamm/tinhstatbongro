import Svg, { Path } from 'react-native-svg';

/**
 * A one-path glyph at a size off the ramp. There is no icon set here and there
 * is not going to be one — the app draws about six shapes, most of them once,
 * and those stay inline where they are drawn.
 *
 * This exists for the PENCIL, which is drawn twice: on a player row and on the
 * club card, and those two now live in different files. A path string copied
 * into both is the one that ends up half-updated.
 */
export const PENCIL = 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25z';

export function Icon({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill={color} />
    </Svg>
  );
}
