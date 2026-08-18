import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { useLitRect } from '../../store/layoutStore';
import { useMetrics } from '../../theme/metrics';
import { fNum, fUi } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { FoulDots } from '../ui/FoulDots';
import { Jersey } from '../ui/Jersey';
import { Press } from '../ui/Press';
import { Col } from '../ui/Row';
import type { Player } from '../../types';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Jersey plate on the left, points over fouls on the right. The outer box is
 * `display:flex`, which is a row in CSS and a column here; without the explicit
 * `flexDirection:'row'` the two blocks stack and the row collapses.
 *
 * **The jersey plate is `ui/Jersey`, and its size is MEASURED.** A row is
 * `flex:1` out of the rail, so its height is a leftover the ramp cannot name —
 * and it does not track the window the way a vh term assumes: a 844×390 phone
 * gives 70px rows in landscape and 49px in portrait, so a `vh` size is biggest
 * exactly where the row is shortest. The plate stretches to the row instead and
 * reports back, and `Jersey` sizes the number off that.
 *
 * Everything else about a player lives one tap in, on the player panel. A
 * fouled-out row stays in the rail, dimmed and showing OUT, because it is still
 * the way back on for a substitution.
 */
export function PlayerRow({
  player,
  selected,
  lit = false,
  onPress,
}: {
  player: Player;
  selected: boolean;
  /**
   * This row's own panel is open, so it holds the pressed fill until that panel
   * closes. `selected` outranks it: an accent row is already the loudest thing
   * in the column and stacking a second state on it would say nothing more.
   */
  lit?: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();
  const dq = player.status === 'out';
  const squeeze = m.compact && !m.portrait;
  const hole = useLitRect(lit);

  // what the cell turned out to be, once the row has laid out; the ramp value
  // is only the first frame's guess
  const [cell, setCell] = useState(clamp(24, 0.044 * m.win.h, 44));
  const onCell = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && h !== cell) setCell(h);
  };

  // the row IS the plate everywhere but a landscape tablet, where five cells
  // divide 800pt and a floor-to-ceiling plate would be a 64×150 stripe
  const plateH = Math.min(cell, clamp(56, 0.09 * m.win.h, 84));
  const plateW = clamp(38, plateH * 1.05, 64);
  const fouls = player.stats.fouls;

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`#${player.number} ${player.name}${dq ? ', fouled out' : ''}`}
      innerRef={hole.ref}
      onLayout={hole.onLayout}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: squeeze ? 0 : m.tap,
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        gap: m.s2,
        paddingHorizontal: m.s1,
        paddingVertical: 2,
        borderRadius: m.rSm,
        borderBottomWidth: 1,
        borderBottomColor: selected ? t.accent : t.rule,
        backgroundColor: selected ? t.accent : lit ? t.press : 'transparent',
        opacity: dq ? 0.55 : 1,
      }}
      pressedStyle={selected ? undefined : { backgroundColor: t.press }}
    >
      {/* the wrapper is what stretches and what reports the row's height; the
          plate is sized and centred inside it, so a capped plate stays on the
          row's middle instead of hugging its top edge */}
      <View
        onLayout={onCell}
        style={{
          alignSelf: 'stretch',
          flexGrow: 0,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Jersey
          number={player.number}
          w={plateW}
          h={plateH}
          tone={dq ? 'out' : selected ? 'selected' : 'floor'}
        />
      </View>

      {/* points sit ON the foul bar: two lines, centred in what is left */}
      <Col flex={1} align="center" justify="center" gap={2} style={{ minWidth: 0 }}>
        <View
          style={{
            flexGrow: 0,
            flexShrink: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fNum(700),
              fontSize: m.fsMd,
              color: selected ? t.accentInk : t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {dq ? 'OUT' : player.stats.points}
          </Text>
          {!dq && (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fUi(400),
                fontSize: m.fsSm * 0.75,
                color: t.ink2,
              }}
            >
              pts
            </Text>
          )}
        </View>

        {/* foul dots: filled dots for fouls incurred, empty for available */}
        <FoulDots value={fouls} inverted={selected} style={{ flexShrink: 0 }} />
      </Col>
    </Press>
  );
}
