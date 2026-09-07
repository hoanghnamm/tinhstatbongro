import { Text, View } from 'react-native';

import { GlowText } from './GlowText';
import { useMetrics } from '../../theme/metrics';
import { LS_TITLE, fDisplay, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE LOCKUP, AND THERE IS ONE OF IT.
 *
 * `hooplog` was written inline in the lobby for as long as the lobby was the
 * only screen that drew it. The LAUNCH SCREEN draws the same mark, and a
 * second copy of a wordmark is the copy that ends up leaning at a different
 * angle, or with `log` a half-step off the accent — which is precisely what
 * the eye catches when one screen replaces the other. So both come from here
 * and neither screen owns the mark.
 *
 * ── THE LEAN IS A SKEW ──────────────────────────────────────────────────────
 *
 * Anton has one weight, no italic and nothing to synthesise from on iOS, so
 * `fontStyle: 'italic'` is a rule one platform honours and the other ignores.
 * TWELVE DEGREES IS THE TOP OF THE RANGE and it is where this sits: it was
 * nine for one revision and nine on a face this condensed reads as a mark set
 * very slightly crooked rather than as a mark that LEANS. Past twelve the
 * counters close and Anton goes to mush. It is a raw value like a hex and it
 * is a lockup's, not a layout's — nothing else in the app leans.
 *
 * AND IT IS SPENT ON A `View`, NOT ON THE `Text`. It was on the text node for
 * one revision and the mark came out UPRIGHT — a transform on a `<Text>` is a
 * prop the New Architecture's paragraph node does not reliably carry, so the
 * rule was written, typechecked and silently dropped. The wrapper has to SIZE
 * TO THE TYPE and must NOT be the row: a skew is applied about the box's own
 * centre, so skewing a full-width box slides the mark sideways by an amount
 * that depends on the window.
 */
const WORDMARK_SLANT = '-12deg';

/**
 * `hoop` in ink, `log` in accent, leaning as ONE mark.
 *
 * IT IS LOWERCASE, and it is the ONE piece of display type in the app that is
 * — `Crest`'s monogram is initials, and initials are a mark. Anton set in caps
 * is a poster shouting; the same face in lowercase is a logotype, which is
 * what this is. It also puts the mark on the right side of the line the rest
 * of the app now holds: NOTHING IN THIS APP SHOUTS, and a wordmark in caps
 * over a screen of sentence case was the last thing still doing it.
 *
 * A logotype is the one place in this app a colour is allowed to mean nothing
 * but ITSELF: it names no control, it opens nothing, and it cannot compete
 * with the marks lower down whichever screen it is standing on.
 *
 * IT IS TWO NODES AND NOT A SPAN, because `log` is painted with `glowInk` —
 * a mask, and therefore a `View`, which does not nest inside a `Text`. They
 * are laid out from the TOP rather than on the baseline: the two carry one
 * face at one size so their line boxes already agree, and `alignItems:
 * 'baseline'` in a short box is the rule that pushes content out through the
 * top edge. The skew wraps BOTH, or `log` leans at its own angle.
 *
 * `size` is the caller's, and the two callers differ: the lobby sets it at
 * `fs2xl` in a header, the launch screen a step up because there is nothing
 * else on that screen.
 */
export function Wordmark({ size }: { size?: number }) {
  const m = useMetrics();
  const t = useTheme();
  const fs = size ?? m.fs2xl;

  const face = {
    ...fDisplay(),
    fontSize: fs,
    // 1.3, AND IT MAY NOT GO TIGHTER. Anton is a tall condensed face, and a
    // tight `lineHeight` looks like free space right up until it CLIPS — the
    // box is what the text is drawn into, so anything under about 1.15 shaves
    // the caps off the top. It was 1.04 for one revision and it cut the
    // wordmark in half. It is 1.3 rather than 1.2 because the mark is set in
    // LOWERCASE now: `p` and `g` both descend, and the caps-height box that
    // fitted `HOOPLOG` cuts the tails off `hooplog`.
    lineHeight: fs * 1.3,
    letterSpacing: ls(fs, LS_TITLE),
  };

  return (
    <View
      style={{
        transform: [{ skewX: WORDMARK_SLANT }],
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <Text numberOfLines={1} style={{ ...face, color: t.ink }}>
        hoop
      </Text>
      <GlowText numberOfLines={1} style={{ ...face, color: t.accent }}>
        log
      </GlowText>
    </View>
  );
}
