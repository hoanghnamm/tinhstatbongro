import { memo } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { normalise, shotTypeFor, zoneFor, zoneSide } from '../../lib/court';
import { useGameStore } from '../../store/gameStore';
import { useMeasure } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { CourtSvg } from './CourtSvg';
import type { Position } from '../../types';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The court is the primary input: a tap on the floor starts a shot entry, and
 * its normalised (x, y) yields both the shot chart and the zone splits. The
 * wrapper owns the pointer; the SVG's zones are decoration.
 */
function CourtImpl() {
  const m = useMetrics();
  const t = useTheme();
  const reduced = useReducedMotion();
  const { ref, onLayout } = useMeasure('court');

  const ended = useGameStore((s) => s.ended);
  const shots = useGameStore(
    useShallow((s) =>
      s.events.flatMap((e) =>
        e.type === 'shot' ? [{ id: e.id, pos: e.position, made: e.result === 'made' }] : [],
      ),
    ),
  );

  const { mark, zone, side, panel, startShot, open } = useUiStore(
    useShallow((s) => ({
      mark: s.mark, zone: s.zone, side: s.side,
      panel: s.panel, startShot: s.startShot, open: s.open,
    })),
  );

  const { w, h } = m.court;
  const dot = clamp(8, 0.019 * m.win.h, 20);
  const live = clamp(26, 0.04 * m.win.h, 42);

  const onPress = (e: GestureResponderEvent) => {
    // no entry may start while the game is over or a panel is up
    if (ended || panel) return;
    const x = normalise(e.nativeEvent.locationX, w);
    const y = normalise(e.nativeEvent.locationY, h);
    const z = zoneFor(x, y);
    startShot({ x, y }, z, zoneSide(z, x), shotTypeFor(x, y));
    open({ kind: 'what' });
  };

  const at = (p: Position, size: number) => ({
    position: 'absolute' as const,
    left: p.x * w - size / 2,
    top: p.y * h - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
  });

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      style={{ width: w, height: h, borderRadius: m.r, overflow: 'hidden' }}
    >
      <Pressable onPress={onPress} style={{ width: w, height: h }} accessibilityLabel="court">
        <CourtSvg zone={zone} side={side} />
      </Pressable>

      {/* the chart left behind. Only shots leave a mark — fouls and rebounds
          would clutter it with things that have no spot. */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {shots.map((s) => (
          <View
            key={s.id}
            style={[
              at(s.pos, dot),
              {
                borderWidth: 2,
                backgroundColor: s.made ? t.accent : t.markMiss,
                borderColor: s.made ? t.courtLine : t.ink,
              },
            ]}
          />
        ))}

        {/* The live mark is the only proof the app read the right spot, so it
            is a ring at ~20pt with a contrasting halo under it: it has to read
            on the floor, on the lane and on a line alike. */}
        {mark && (
          <Animated.View
            entering={reduced ? undefined : ZoomIn.duration(160)}
            style={[
              at(mark, live),
              {
                borderWidth: 3,
                borderColor: t.accent,
                backgroundColor: t.liveFill,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: t.surface,
                shadowOpacity: 1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <View
              style={{
                width: live * 0.36,
                height: live * 0.36,
                borderRadius: live,
                backgroundColor: t.accent,
              }}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export const Court = memo(CourtImpl);
