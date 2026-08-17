import { Text } from 'react-native';

import { litControl } from '../../lib/lit';
import { useGameStore } from '../../store/gameStore';
import { useLitRect } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Row } from '../ui/Row';

/**
 * Two numbers and no caption — the first cell of the footer's last third, next
 * to the clock and the quarter. `12 : 8` does not need to say what it is, and
 * a label would cost the row height it does not have.
 *
 * It used to head the OPP column, above the +1/+2/+3 buttons that move it. The
 * move down cost that adjacency and bought the court a whole strip of height in
 * portrait; the buttons are still the only thing that writes the second number.
 *
 * It is a **footer cell**, so it wears no border, no radius and no fill of its
 * own: the footer's `Surface` is the panel, the 1px `Divider` is the edge, and
 * a cell that painted its own would double both. It grows off a `flexBasis:0`
 * like every other cell in the row, but by a weight the Footer hands it —
 * `108 : 99` is half again the widest thing the quarter cell can say.
 *
 * Two things this cell got wrong and must not get wrong again:
 *
 *  - It is the surface itself. It used to wrap a `flex:1` child, and `flex:1`
 *    means `flexBasis:0` — inside a parent whose height comes from its content
 *    that resolves to nothing, so the cell collapsed and its text spilled past
 *    the top of the screen. The footer gives it a real height; keep it that way.
 *  - The numbers are centred, not baseline-aligned. Baseline alignment offsets
 *    children by their ascent, which in a short box goes negative and pushes
 *    the digits out through the top edge.
 *
 * Clipped as well, because `108 : 99` must not blow the third open.
 */
export function ScoreCell({ grow }: { grow: number }) {
  const m = useMetrics();
  const t = useTheme();
  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  const open = useUiStore((s) => s.open);
  // and it stays lit for as long as the box score is up, with the scrim cut
  // around it so "lit" means undimmed rather than merely less dim
  const lit = useUiStore((s) => litControl(s.panel, s.what) === 'score');
  const hole = useLitRect(lit);

  // the ramp's footer step is the rendered size now, and all three numbers in
  // the middle block share it — see `fsFtr`, which is capped against this text
  const size = m.fsFtr;
  const line = size * 1.2;

  return (
    <Press
      onPress={() => open({ kind: 'totals' })}
      accessibilityLabel={`open the box score, ${score} to ${oppScore}`}
      innerRef={hole.ref}
      onLayout={hole.onLayout}
      style={{
        // the widest of the three numbers in its third, so it takes the widest
        // share of it — see the Footer, which owns all three weights
        flexGrow: grow,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: m.s1,
        overflow: 'hidden',
        backgroundColor: lit ? t.press : 'transparent',
      }}
      pressedStyle={{ backgroundColor: t.press }}
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
          style={{ fontFamily: fNum(500), fontSize: size * 0.7, lineHeight: line, color: t.ink3 }}
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
