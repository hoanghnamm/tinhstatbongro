import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE PHOTOGRAPH ACROSS THE TOP OF A FULL-WIDTH PAGE, fading down into the
 * type under it.
 *
 * It is the LOBBY'S picture — `assets/hero-court.jpg`, the only photograph in
 * the app — and it is drawn here rather than twice because two screens carry
 * it now: the paywall, which is where this construction was written, and the
 * door's last step, which is the trial's own offer one tap away from it. Two
 * copies of a fade is two chances for the same picture to stop at a different
 * height on two screens a scorer sees in the same minute.
 *
 * IT IS FADED BY GRADIENTS AND NEVER BY `opacity`, which is the rule written
 * on `HeaderArt` and it is the same rule: a flat opacity lifts the whole
 * photograph toward the room's ground and reads as a dull rectangle laid over
 * it, where a wash runs the room's own `bg` back OVER the image and leaves the
 * far corner at full contrast. This picture in particular has no dark half to
 * hide in — it is a rust surface edge to edge.
 *
 * TWO WASHES. Down into the headline, so the type starts on clean ground; and
 * off the LEFT edge, which is where a close button or a first line of text
 * lands — a glyph on a photograph needs a ground under it, or it sits on
 * whatever the crop happened to put there.
 *
 * IT IS NOT THE LOBBY'S `HeaderArt`. That one is a corner: 82% of the width,
 * pinned top-right, washed from the left so the marks in the frame stay at
 * full contrast beside a column of cards. This runs FULL WIDTH, because
 * neither screen that draws it has a column beside it.
 */
export function HeroArt({ height }: { height: number }) {
  const t = useTheme();

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    >
      <Image
        source={require('../../assets/hero-court.jpg')}
        resizeMode="cover"
        style={{ width: '100%', height }}
      />
      {/* down into the headline, so the type starts on clean ground */}
      <LinearGradient
        colors={['transparent', withAlpha(t.bg, 0.72), t.bg]}
        locations={[0.3, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* and a light wash off the left edge — see the note above */}
      <LinearGradient
        colors={[withAlpha(t.bg, 0.55), 'transparent']}
        locations={[0, 0.55]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );
}
