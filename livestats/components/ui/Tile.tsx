import { Text, View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Badge } from './Badge';
import { Press } from './Press';

/**
 * One cell of a tile grid: one line dominant — an abbreviation, or a word when
 * `word` is set — an optional smaller line under it, and an optional count in
 * the corner.
 *
 * Two rules the grid depends on:
 *
 *  - NO border and NO borderRadius. The 1px divider between tiles *is* the grid
 *    gap — a rule-coloured parent showing through 1px seams — so a tile that
 *    paints its own edge destroys the seam. Selection is drawn as an inset ring
 *    on an overlay instead, which takes no layout space.
 *  - An opaque `backgroundColor`. A transparent tile shows the rule colour
 *    through its whole face and the grid reads as one flat slab.
 */
export function Tile({
  code,
  caption,
  badge,
  selected = false,
  disabled = false,
  big = false,
  word = false,
  tone = 'ink',
  onPress,
  accessibilityLabel,
}: {
  code: string | number;
  caption?: string;
  badge?: number;
  selected?: boolean;
  disabled?: boolean;
  /** two tiles instead of four, so the abbreviation takes the next size up */
  big?: boolean;
  /**
   * `code` is a WORD rather than an abbreviation — DEFENSIVE, not DF. Two
   * letters and nine are not the same typographic object: the word drops two
   * steps down the ramp, takes two lines, and keeps `adjustsFontSizeToFit` as
   * the floor under the one that still will not fit (TURNOVER on a 320pt
   * landscape phone). Set by `tileWords`, never by hand.
   */
  word?: boolean;
  /**
   * INK ONLY. A tile keeps its opaque surface whatever it does — the 1px seam
   * is what the grid is made of — so the one thing that can mark a tile out is
   * the colour of its text: `danger` for END GAME, `accent` for the one key
   * that commits, like SET on the clock pad. That also sidesteps the inverted
   * surface trap: there is no fill here to lose its matching ink.
   */
  tone?: 'ink' | 'danger' | 'accent';
  onPress?(): void;
  accessibilityLabel?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const size = word ? (big ? m.fs2xl : m.fsXl) : big ? m.fs4xl : m.fs3xl;
  const toned = tone === 'danger' ? t.danger : tone === 'accent' ? t.accent : null;

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        position: 'relative',
        minHeight: m.tap,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.s1,
        paddingHorizontal: m.s2,
        backgroundColor: t.surface,
        opacity: disabled ? 0.38 : 1,
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      {badge !== undefined && (
        <Badge
          value={badge}
          tone={badge ? 'on' : 'quiet'}
          style={{ position: 'absolute', top: m.s2, right: m.s2, zIndex: 1 }}
        />
      )}

      <Text
        numberOfLines={word ? 2 : 1}
        adjustsFontSizeToFit={word}
        minimumFontScale={0.6}
        style={{
          fontFamily: fNum(700),
          fontSize: size,
          lineHeight: size * 1.1,
          letterSpacing: word ? ls(size, LS_BTN) : 0,
          textAlign: 'center',
          color: toned ?? t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {code}
      </Text>

      {!!caption && (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            maxWidth: '100%',
            textAlign: 'center',
            fontFamily: fUi(600),
            fontSize: m.fsXs,
            // THE ONE `fsXs` CAPTION THAT KEEPS `LS_LABEL`, and the width is
            // why. A third of the smallest court is ten characters of caption
            // and `SUBSTITUTE` is exactly ten: at `LS_MICRO` the last of them
            // ellipsises away. Everywhere else a caption has room to be set
            // wide; a board tile does not, and this one truncates rather than
            // wraps, so the tracking is what has to give.
            letterSpacing: ls(m.fsXs, LS_LABEL),
            // both lines or neither: a red code over a grey word reads as two
            // different things stacked, not as one red button
            color: toned ?? t.ink2,
          }}
        >
          {caption}
        </Text>
      )}

      {/* the selection ring is an overlay, so it never eats a pixel of the seam */}
      {selected && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0, left: 0,
            borderWidth: 2,
            borderColor: t.accent,
          }}
        />
      )}
    </Press>
  );
}
