import { memo, useMemo } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { FT_SPOT, normalise, shotTypeFor, zoneFor, zoneSide } from '../../lib/court';
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
  // The projection has to happen outside the selector: it mints fresh objects,
  // so `useShallow` would compare them by identity, miss every time and hand
  // useSyncExternalStore a new snapshot on every call. `events` itself is a
  // stable reference between mutations, so memoising off it is enough.
  const events = useGameStore((s) => s.events);
  const shots = useMemo(
    () =>
      events.flatMap((e) =>
        e.type === 'shot' ? [{ id: e.id, pos: e.position, made: e.result === 'made' }] : [],
      ),
    [events],
  );

  // Every free throw lands on the SAME coordinate, so there is never more than
  // ONE of them on the chart: N stacked dots draw as one dot anyway. It is
  // derived from `events`, so undo takes the last attempt off it — and takes
  // the mark away entirely — with no special case.
  const ftAttempts = useMemo(
    () => events.reduce((n, e) => n + (e.type === 'freeThrow' ? 1 : 0), 0),
    [events],
  );

  const { mark, zone, side, what, panel, startShot, open } = useUiStore(
    useShallow((s) => ({
      mark: s.mark, zone: s.zone, side: s.side, what: s.what,
      panel: s.panel, startShot: s.startShot, open: s.open,
    })),
  );

  // It shows from the moment FT is pressed, so the spot the entry is anchored
  // to is on screen before MADE/MISS is tapped — and it stays after, because
  // by then there is an attempt behind it.
  const showFt = ftAttempts > 0 || what === 'ft';

  const { w, h } = m.court;
  const dot = clamp(8, 0.019 * m.win.h, 20);
  const live = clamp(18, 0.027 * m.win.h, 28);

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

      {/* The chart left behind: shots where they were taken, and one dot on the
          line for the free throws. Fouls, rebounds and tallies leave no mark —
          they would clutter it with things that have no spot. */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {shots.map((s) => (
          <View
            key={s.id}
            style={[
              at(s.pos, dot),
              {
                borderWidth: 0,
                backgroundColor: s.made ? t.accent : t.markMiss,
              },
            ]}
          />
        ))}

        {/* The free-throw spot: one red dot on the line, the same size as a
            shot's and built the same way, so the chart stays one grammar. It
            carries no count — the split lives in the box score, and a number on
            the floor is not what a scorer reads mid-game. */}
        {showFt && (
          <View
            style={[
              at(FT_SPOT, dot),
              { borderWidth: 0, backgroundColor: t.danger },
            ]}
          />
        )}

        {/* The live mark is the only proof the app read the right spot, so it
            is a ring with a contrasting halo under it: it has to read on the
            floor, on the lane and on a line alike. It is basketball orange and
            NOT `accent`, because accent two dots away means MADE — the spot and
            the result must never be the same colour. Small: it marks a point,
            and a ring wide enough to cover the spot it names is a worse mark. */}
        {mark && (
          <Animated.View
            entering={reduced ? undefined : ZoomIn.duration(160)}
            style={[
              at(mark, live),
              {
                borderWidth: 2,
                borderColor: t.mark,
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
                backgroundColor: t.mark,
              }}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export const Court = memo(CourtImpl);
