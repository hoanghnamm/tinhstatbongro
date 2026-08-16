import { Text } from 'react-native';

import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Row } from '../ui/Row';

/**
 * Two numbers and no caption, at the head of the OPP column: the score and the
 * buttons that move it belong together, and a label above them would cost a
 * whole button of height. `12 : 8` does not need to say what it is.
 *
 * Two things this cell got wrong and must not get wrong again:
 *
 *  - It is the surface itself. It used to wrap a `flex:1` child, and `flex:1`
 *    means `flexBasis:0` — inside a parent whose height comes from its content
 *    that resolves to nothing, so the cell collapsed and its text spilled past
 *    the top of the screen.
 *  - The numbers are centred, not baseline-aligned. Baseline alignment offsets
 *    children by their ascent, which in a short box goes negative and pushes
 *    the digits out through the top edge.
 *
 * Clipped as well, because `108 : 99` must not blow the column open.
 */
export function ScoreCell() {
  const m = useMetrics();
  const t = useTheme();
  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  const open = useUiStore((s) => s.open);

  // a short landscape phone has ~290pt of column for five rows plus this cell,
  // so the tap floor is released here rather than clipping the fifth player
  const squeeze = m.compact && !m.portrait;
  const size = squeeze ? m.fsMd : m.fsLg;
  const line = size * 1.2;
  // a definite height, never content-plus-hope
  const height = m.portrait ? m.scoreh : squeeze ? line + m.s2 * 2 : m.tap;

  return (
    <Press
      onPress={() => open({ kind: 'totals' })}
      accessibilityLabel="open the box score"
      style={{
        flexGrow: 0,
        flexShrink: 0,
        height,
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: t.rule,
        borderRadius: m.rSm,
        paddingHorizontal: m.s1,
        backgroundColor: t.surface,
        overflow: 'hidden',
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      <Row gap={m.s1} align="center" justify="center">
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fNum(700),
            fontSize: size,
            lineHeight: line,
            letterSpacing: -0.02 * size,
            color: t.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {score}
        </Text>
        <Text
          style={{ fontFamily: fNum(500), fontSize: m.fsSm, lineHeight: line, color: t.ink2 }}
        >
          :
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fNum(700),
            fontSize: size,
            lineHeight: line,
            color: t.ink2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {oppScore}
        </Text>
      </Row>
    </Press>
  );
}
