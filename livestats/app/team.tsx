import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../components/panels/PanelHost';
import { Btn, Row as BtnRow } from '../components/panels/shell';
import { Jersey } from '../components/ui/Jersey';
import { Press } from '../components/ui/Press';
import { Row } from '../components/ui/Row';
import { ROSTER_CAP } from '../lib/roster';
import { useRosterStore } from '../store/rosterStore';
import { useUiStore } from '../store/uiStore';
import { useMetrics } from '../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { RosterPlayer } from '../types';

/**
 * Two columns start here, not at an orientation. A tablet in portrait is wide
 * and should use it; a phone in landscape is wide in pixels and narrow in
 * thumbs, and 700 is the same line `RotateGate` draws between the two devices.
 */
const TWO_UP = 700;
/** …and past it the count is computed, so a 1180pt iPad gets three, not two. */
const COL_W = 340;

const ICON = 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25z'; // pencil

function Icon({ d, size, color }: { d: string; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill={color} />
    </Svg>
  );
}

function PlayerRow({ player }: { player: RosterPlayer }) {
  const m = useMetrics();
  const t = useTheme();
  const open = useUiStore((s) => s.open);

  // the rail's plate, off the ramp rather than off a measured row — this list
  // gives every row the same height, so there is nothing to measure
  const jh = Math.round(m.tap * 0.72);

  return (
    <Press
      onPress={() => open({ kind: 'editPlayer', playerId: player.id })}
      accessibilityLabel={`edit #${player.number} ${player.name}`}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.s3,
        paddingHorizontal: m.s2,
        paddingVertical: m.s2,
        borderBottomWidth: 1,
        borderBottomColor: t.rule,
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      <Jersey number={player.number} w={Math.round(jh * 1.15)} h={jh} />

      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flexShrink: 1,
          minWidth: 0,
          fontFamily: fUi(600),
          fontSize: m.fsMd,
          color: t.ink,
        }}
      >
        {player.name}
      </Text>

      {/* the affordance, so the row reads as editable rather than merely tappable */}
      <View style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
        <Icon d={ICON} size={m.fsMd} color={t.ink3} />
      </View>

      <Press
        onPress={() => open({ kind: 'removePlayer', playerId: player.id })}
        accessibilityLabel={`remove #${player.number} ${player.name}`}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          width: m.tap,
          minHeight: m.tap,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: m.rSm,
        }}
        pressedStyle={{ backgroundColor: t.rule }}
      >
        <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
          <Path
            d="M5 7h14M10 7V4.8h4V7M7.5 7l.8 12.2h7.4L16.5 7"
            stroke={t.danger}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Press>
    </Press>
  );
}

export default function TeamScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const players = useRosterStore((s) => s.players);
  const open = useUiStore((s) => s.open);

  const full = players.length >= ROSTER_CAP;

  const usable = m.win.w - safe.left - safe.right - 2 * m.s4;
  const columns = usable >= TWO_UP ? Math.max(2, Math.floor(usable / COL_W)) : 1;

  // a short last row would otherwise stretch its one item across the grid
  const pad = columns > 1 ? (columns - (players.length % columns)) % columns : 0;
  const data: (RosterPlayer | null)[] = [...players, ...Array<null>(pad).fill(null)];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s2,
        paddingBottom: safe.bottom + m.s3,
        paddingLeft: safe.left + m.s4,
        paddingRight: safe.right + m.s4,
      }}
    >
      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          onPress={() => router.back()}
          accessibilityLabel="back to home"
          style={{
            width: m.tap,
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.rSm,
          }}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
            <Path
              d="M15 4L7 12l8 8"
              stroke={t.ink}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Press>

        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fNum(700),
            fontSize: m.fsXl,
            letterSpacing: ls(m.fsXl, LS_BTN),
            color: t.ink,
          }}
        >
          MY TEAM
        </Text>

        <Text
          style={{
            marginLeft: 'auto',
            flexGrow: 0,
            flexShrink: 0,
            fontFamily: fNum(500),
            fontSize: m.fsMd,
            color: t.ink2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {players.length}/{ROSTER_CAP}
        </Text>
      </Row>

      <FlatList
        // numColumns cannot change on a live list, so the count keys it
        key={'cols' + columns}
        data={data}
        numColumns={columns}
        keyExtractor={(p, i) => p?.id ?? 'pad' + i}
        renderItem={({ item }) =>
          item ? <PlayerRow player={item} /> : <View style={{ flex: 1 }} />
        }
        style={{ flex: 1, marginTop: m.s2 }}
        contentContainerStyle={players.length ? undefined : { flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontFamily: fNum(500),
                fontSize: m.fsMd,
                letterSpacing: ls(m.fsMd, LS_LABEL),
                color: t.ink3,
              }}
            >
              NO PLAYERS YET
            </Text>
          </View>
        }
      />

      <BtnRow mt>
        <Btn
          label={full ? 'TEAM IS FULL' : 'ADD PLAYER'}
          variant="accent"
          disabled={full}
          onPress={() => open({ kind: 'editPlayer', playerId: null })}
        />
      </BtnRow>

      <PanelHost />
    </View>
  );
}
