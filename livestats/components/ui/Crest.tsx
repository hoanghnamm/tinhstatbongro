import { Image, Text, View } from 'react-native';

import { initials } from '../../lib/team';
import { LS_BTN, fNum, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * The club's mark: the uploaded crest, or the monogram when there is none.
 *
 * ONE COMPONENT FOR BOTH, because they are one thing — the round mark that says
 * whose board this is — and every screen that shows it must fall back the same
 * way. A club with no crest is the common case on a fresh install and stays the
 * common case for scorers who never upload one, so the monogram is not an error
 * state and is not drawn like one.
 *
 * The size is always the caller's, the way `Jersey`'s is: the lobby takes it off
 * the type ramp and MY TEAM takes it off the card. The image is `cover` inside a
 * circle, so a rectangular photo is cropped rather than squashed — the picker
 * already offered a square crop, and this is what happens when it was declined.
 *
 * There is no ring. The mockup gives the crest an accent one, and that is one of
 * the places the accent stopped meaning anything; see the lobby's own note.
 */
export function Crest({
  name,
  uri,
  size,
}: {
  name: string;
  uri: string | null;
  size: number;
}) {
  const t = useTheme();

  const box = {
    width: size,
    height: size,
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: size / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  if (uri) {
    return (
      <View style={[box, { backgroundColor: t.surface2 }]}>
        <Image
          source={{ uri }}
          resizeMode="cover"
          accessibilityLabel={`${name} crest`}
          style={{ width: size, height: size }}
        />
      </View>
    );
  }

  const fs = size * 0.4;
  // THE MONOGRAM'S INK IS `bg`, NOT `surface`, and that is what makes this pair
  // survive both palettes. The fill is `ink`, so the ink has to be whatever is
  // furthest from it — on the light skin that is the near-white canvas, and on
  // the lobby's dark one `ink` is near-WHITE and `surface` is a translucent
  // white, which would have drawn the initials invisibly on their own circle.
  // `bg` is the one token that is the opposite of `ink` in both.
  return (
    <View style={[box, { backgroundColor: t.ink }]}>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: fs,
          lineHeight: fs * 1.2,
          letterSpacing: ls(fs, LS_BTN),
          color: t.bg,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
