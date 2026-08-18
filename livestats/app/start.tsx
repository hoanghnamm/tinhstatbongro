import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  Btn,
  Row as BtnRow,
  PGrid,
  PHead,
  PTitleText,
  Pts,
  Tile,
} from '../components/panels/shell';
import { Press } from '../components/ui/Press';
import { gridFor } from '../lib/grid';
import { STARTERS } from '../lib/roster';
import { useGameStore } from '../store/gameStore';
import { useRosterStore } from '../store/rosterStore';
import { useMetrics } from '../theme/metrics';
import { useTheme } from '../theme/useTheme';

/**
 * Step zero of a game. With up to fifteen on the team and five rows on the
 * rail, the app cannot pick for the scorer, so NEW GAME lands here before the
 * board.
 *
 * It wears the foul panel's shell — header, 1px seams, code-over-caption tiles
 * — and fits its grid with the same `gridFor`, because it is the same kind of
 * decision as every other tile grid in the app: taps out of a short list, made
 * with a shape chosen to fit rather than a hardcoded column count.
 *
 * A selected tile takes ACCENT INK and an accent ring, never a fill: the 1px
 * seam between tiles is what the grid is made of, and a filled tile eats its
 * own seam.
 *
 * Leaving without starting is a back tap. Nothing is discarded until START
 * GAME, so arriving here from a live game costs nothing if it was a mis-tap.
 */
export default function StartScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const roster = useRosterStore((s) => s.players);
  const startGame = useGameStore((s) => s.startGame);

  const [picked, setPicked] = useState<string[]>([]);
  // measured, not calculated — the same rule the court panels follow, and it is
  // the whole card that is measured because `gridFor` takes the header off
  const [box, setBox] = useState({ w: m.win.w, h: m.win.h });
  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
  };

  const toggle = (id: string) =>
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : // at five, a sixth tap is IGNORED rather than swapping someone out
          // silently — the scorer has to say who leaves
          cur.length >= STARTERS
          ? cur
          : [...cur, id],
    );

  const ready = picked.length === STARTERS;
  const grid = gridFor(Math.max(1, roster.length), box.w, box.h, m.tap);

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
      <View
        onLayout={onBox}
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          alignItems: 'stretch',
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: m.r,
          overflow: 'hidden',
        }}
      >
        <PHead>
          <PTitleText>PICK YOUR STARTING FIVE</PTitleText>
          <Pts>
            {picked.length}/{STARTERS}
          </Pts>
          <Press
            onPress={() => router.back()}
            accessibilityLabel="back, start no game"
            style={{
              marginLeft: 'auto',
              alignSelf: 'stretch',
              flexGrow: 0,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: m.s3,
              minWidth: m.tap,
              borderLeftWidth: 1,
              borderLeftColor: t.rule,
            }}
            pressedStyle={{ backgroundColor: t.surface2 }}
          >
            <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
              <Path d="M5 5l14 14M19 5L5 19" stroke={t.ink2} strokeWidth={2.4} fill="none" />
            </Svg>
          </Press>
        </PHead>

        <PGrid columns={grid.columns}>
          {roster.map((p) => {
            const on = picked.includes(p.id);
            return (
              <Tile
                key={p.id}
                code={p.number}
                caption={p.name}
                selected={on}
                tone={on ? 'accent' : 'ink'}
                onPress={() => toggle(p.id)}
                accessibilityLabel={`#${p.number} ${p.name}${on ? ', starting' : ''}`}
              />
            );
          })}
        </PGrid>
      </View>

      <BtnRow mt>
        <Btn
          label="START GAME"
          variant="accent"
          disabled={!ready}
          onPress={() => {
            startGame(roster, picked);
            // replace, not push: back off the board goes home, not to a picker
            // for a game that has already started
            router.replace('/game');
          }}
        />
      </BtnRow>
    </View>
  );
}
