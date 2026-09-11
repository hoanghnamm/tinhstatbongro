import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Press } from '../ui/Press';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { Split } from '../../lib/box';
import type { Observation } from '../../lib/observe';

/**
 * WHAT STANDS OUT — at most two sentences, and each one is a way in.
 *
 * The rules that write these live in `lib/observe.ts`; this only prints them.
 * The one thing it adds is the trail: an observation that names a period moves
 * the quarter filter to that period when it is pressed, so `5 of 9 turnovers
 * came in Q3` is one tap from the Q3 rows that produced it rather than a claim
 * the reader has to take on trust. An observation about the whole game has
 * nowhere to go and is therefore not pressable — a control that looks like a
 * link and does nothing is worse than plain type. Nor does one whose period is
 * ALREADY the slice on screen: the trail has been followed and the chevron
 * would be pointing at where the reader is standing.
 *
 * THE SENTENCES DO NOT CHANGE WITH THE FILTER. They are facts about the whole
 * game and each names its own quarter, so they stay put while the numbers
 * around them move — a card that vanished the moment it was tapped would be
 * the one control on the screen that ate its own answer.
 *
 * NO ICON, NO BULLET, NO TONE. These are facts and not warnings, and a red
 * triangle beside `Three-pointers: 2/12` would be the app deciding that was
 * bad news. It might have been the plan.
 */
export function Standouts({
  items,
  split,
  onSplit,
}: {
  items: Observation[];
  /** the slice on screen — an observation already followed has nowhere to go */
  split: Split;
  onSplit?(split: Split): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <View>
      {items.map((o, i) => {
        const go =
          o.split !== null && o.split !== split && onSplit ? () => onSplit(o.split) : null;

        const body = (
          <>
            <Text
              style={{
                flex: 1,
                minWidth: 0,
                ...fUi(500),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                lineHeight: m.fsSm * 1.4,
                color: t.ink,
              }}
            >
              {o.text}
            </Text>
            {!!go && (
              <Svg
                width={m.fsSm}
                height={m.fsSm}
                viewBox="0 0 24 24"
                style={{ flexGrow: 0, flexShrink: 0 }}
              >
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={t.ink3}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            )}
          </>
        );

        const shape = {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: m.s2,
          minHeight: m.tap,
          paddingVertical: m.s2,
          paddingHorizontal: m.s3,
          borderTopWidth: i === 0 ? 0 : 1,
          borderTopColor: t.rule,
          backgroundColor: t.surface,
        };

        return go ? (
          <Press
            key={o.key}
            onPress={go}
            accessibilityLabel={o.text}
            style={shape}
            pressedStyle={{ backgroundColor: t.surface2 }}
          >
            {body}
          </Press>
        ) : (
          <View key={o.key} style={shape}>
            {body}
          </View>
        );
      })}
    </View>
  );
}
