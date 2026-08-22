import { View } from 'react-native';

import { useTheme } from '../../theme/useTheme';

/**
 * A RULE OF ACCENT THAT MARKS NOTHING — thirty-six points by three, sitting on
 * the club's headline the way a broadcast lower-third sits on a name.
 *
 * It is colour spent on a GROUND rather than on a mark, which is the same
 * argument the bloom makes and the same reason neither counts against the two
 * things accent means on the lobby: it names no control, it opens nothing, and
 * nothing is written inside it. The colour went here rather than onto the last
 * word of the headline for a duller reason — a club with a one-word name would
 * have taken the whole headline orange, and the slug is the version of that
 * idea which does not depend on how many words a scorer typed.
 *
 * IT IS ITS OWN FILE FOR EXACTLY THE REASON `Dot` IS: `npm run check` asserts
 * that a view filling with `t.accent` also sets `t.accentInk` somewhere, and a
 * bar with no text inside it has no ink to lose. Its own file is what lets the
 * guard exempt it by name without exempting the screen that draws it.
 */
export function Slug({ w = 36, h = 3 }: { w?: number; h?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: w,
        height: h,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: h,
        backgroundColor: t.accent,
      }}
    />
  );
}
