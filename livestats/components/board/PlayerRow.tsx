import { Text, View } from 'react-native';

import { FOULS } from '../../constants/game';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { FoulDots } from '../ui/FoulDots';
import { Press } from '../ui/Press';
import { Fixed } from '../ui/Row';
import type { Player } from '../../types';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Jersey, name, points, fouls — on ONE LINE. The CSS was `display:flex`, which
 * is a row there and a column here; without the explicit `flexDirection:'row'`
 * the four children stack, the name's `flex:1` resolves to zero height in the
 * block axis, and the player's name disappears entirely.
 *
 * Everything else about a player lives one tap in, on the player panel. A
 * fouled-out row stays in the rail, dimmed and showing OUT, because it is still
 * the way back on for a substitution.
 */
export function PlayerRow({
  player,
  selected,
  onPress,
}: {
  player: Player;
  selected: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();
  const dq = player.status === 'out';
  const bubble = clamp(24, 0.044 * m.win.h, 44);
  const squeeze = m.compact && !m.portrait;

  const fouls = player.stats.fouls;

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`#${player.number} ${player.name}${dq ? ', fouled out' : ''}`}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: squeeze ? 0 : m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: m.s2,
        paddingHorizontal: m.s1,
        borderRadius: m.rSm,
        borderBottomWidth: 1,
        borderBottomColor: selected ? t.accent : t.rule,
        backgroundColor: selected ? t.accent : 'transparent',
        opacity: dq ? 0.55 : 1,
      }}
      pressedStyle={selected ? undefined : { backgroundColor: t.surface2 }}
    >
      {/* a circle: equal width AND height, and it must not stretch or shrink */}
      <Fixed
        width={bubble}
        height={bubble}
        center
        style={{
          borderRadius: bubble / 2,
          backgroundColor: dq ? t.danger : selected ? t.accentInk : t.ink,
          // starters carry a ring; the box score spells it out in the GS column
          borderWidth: player.starter ? 2 : 0,
          borderColor: t.accent,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fNum(700),
            fontSize: m.fsMd,
            lineHeight: m.fsMd * 1.15,
            textAlign: 'center',
            color: dq ? t.dangerInk : selected ? t.accent : t.surface,
            fontVariant: ['tabular-nums'],
          }}
        >
          {player.number}
        </Text>
      </Fixed>

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
              fontFamily: fNum(400),
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
    </Press>
  );
}
