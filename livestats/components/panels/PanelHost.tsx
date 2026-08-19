import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';

import { useCourtBox, useDockBox } from '../../hooks/usePanelBox';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useRects, type Rect } from '../../store/layoutStore';
import { useUiStore, type Panel } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { AssistPanel } from './AssistPanel';
import { EndGamePanel } from './EndGamePanel';
import { EndQuarterPanel } from './EndQuarterPanel';
import { FTDockPanel } from './FTDockPanel';
import { FoulDeniedPanel } from './FoulDeniedPanel';
import { FoulKindPanel } from './FoulKindPanel';
import { FouledOutPanel } from './FouledOutPanel';
import { NewGamePanel } from './NewGamePanel';
import { PlayerActionsPanel } from './PlayerActionsPanel';
import { RebKindPanel } from './RebKindPanel';
import { RemoveGamePanel } from './RemoveGamePanel';
import { RemovePlayerPanel } from './RemovePlayerPanel';
import { SettingsPanel } from './SettingsPanel';
import { SetClockPanel } from './SetClockPanel';
import { SetNumberPanel } from './SetNumberPanel';
import { SubOutPanel } from './SubOutPanel';
import { TripShotsPanel } from './TripShotsPanel';
import { TripSizePanel } from './TripSizePanel';
import { WhatPanel } from './WhatPanel';
import { WhoPanel } from './WhoPanel';
import { MODE } from './placement';

const SCRIM = 'rgba(0,0,0,0.45)';

/**
 * The scrim, in FOUR bands around the lit control instead of one sheet over it.
 *
 * A control cannot be "not dimmed" by being painted brighter: the scrim is a
 * 45% black sheet over the whole window, so it multiplies the lit cell down
 * along with everything else, and the cell ends up brighter than its neighbours
 * but plainly dark. Nor can it be lifted over the top — React Native's `zIndex`
 * orders siblings, and every board control is a grandchild of a view that is
 * this overlay's sibling, so no depth given to a cell can climb past it.
 *
 * Cutting the sheet is what is left, and it is also the truthful thing: the
 * button you pressed is the one thing on the board that is NOT behind the panel.
 * The bands tile the window exactly — they must not overlap, because two 45%
 * sheets crossing would draw a darker seam where they meet.
 */
function Scrim({ hole, onPress }: { hole: Rect | null; onPress(): void }) {
  if (!hole) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel="close"
        style={{ position: 'absolute', inset: 0, backgroundColor: SCRIM }}
      />
    );
  }
  // integers, so the four edges meet on whole pixels rather than leaving a
  // hairline of undimmed board along a fractional boundary
  const x = Math.round(hole.x);
  const y = Math.round(hole.y);
  const right = x + Math.round(hole.w);
  const bottom = y + Math.round(hole.h);

  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityLabel="close"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, y), backgroundColor: SCRIM }}
      />
      <Pressable
        onPress={onPress}
        accessible={false}
        style={{ position: 'absolute', left: 0, right: 0, top: bottom, bottom: 0, backgroundColor: SCRIM }}
      />
      <Pressable
        onPress={onPress}
        accessible={false}
        style={{ position: 'absolute', left: 0, width: Math.max(0, x), top: y, height: bottom - y, backgroundColor: SCRIM }}
      />
      <Pressable
        onPress={onPress}
        accessible={false}
        style={{ position: 'absolute', left: right, right: 0, top: y, height: bottom - y, backgroundColor: SCRIM }}
      />
    </>
  );
}

function body(panel: Panel) {
  // exhaustive on purpose: a panel added to the union without a branch here is
  // a compile error rather than a blank overlay
  switch (panel.kind) {
    case 'what': return <WhatPanel />;
    case 'foulKind': return <FoulKindPanel />;
    case 'rebKind': return <RebKindPanel />;
    case 'who': return <WhoPanel />;
    case 'assist': return <AssistPanel />;
    case 'playerActions':
      return <PlayerActionsPanel playerId={panel.playerId} bumped={panel.bumped} />;
    case 'subOut': return <SubOutPanel outId={panel.outId} />;
    case 'ftResult': return <FTDockPanel />;
    case 'tripSize': return <TripSizePanel />;
    case 'tripShots': return <TripShotsPanel />;
    case 'fouledOut': return <FouledOutPanel playerId={panel.playerId} />;
    case 'foulDenied': return <FoulDeniedPanel playerId={panel.playerId} />;
    case 'endQuarter': return <EndQuarterPanel />;
    case 'setClock': return <SetClockPanel />;
    case 'endGame': return <EndGamePanel />;
    case 'newGame': return <NewGamePanel />;
    case 'setNumber': return <SetNumberPanel playerId={panel.playerId} />;
    case 'removePlayer': return <RemovePlayerPanel playerId={panel.playerId} />;
    case 'removeGame': return <RemoveGamePanel gameId={panel.gameId} />;
    case 'settings': return <SettingsPanel />;
  }
}

export function PanelHost() {
  const m = useMetrics();
  const t = useTheme();
  const reduced = useReducedMotion();
  const panel = useUiStore((s) => s.panel);
  const reset = useUiStore((s) => s.reset);
  const court = useCourtBox();
  const dock = useDockBox();
  const lit = useRects().lit ?? null;

  // the hardware back button is this platform's Escape
  useEffect(() => {
    if (!panel) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      reset();
      return true;
    });
    return () => sub.remove();
  }, [panel, reset]);

  if (!panel) return null;
  const mode = MODE[panel.kind];

  const frame = {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: m.r,
    overflow: 'hidden' as const,
  };

  const placed =
    mode === 'dock'
      ? { position: 'absolute' as const, left: dock.left, top: dock.top, width: dock.w, height: dock.h }
      : mode === 'court'
        ? { position: 'absolute' as const, left: court.left, top: court.top, width: court.w, height: court.h }
        : {
            width: Math.min(m.win.w * 0.92, m.win.h * 0.78),
            maxHeight: m.win.h * (m.compact ? 0.94 : 0.92),
          };

  const enter = reduced
    ? undefined
    : mode === 'dock'
      ? SlideInRight.duration(160)
      : FadeIn.duration(160);

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      {/* the dock must not dim what is behind it — that is its whole reason,
          so it takes one clear sheet and never a hole */}
      {mode === 'dock' ? (
        <Pressable
          onPress={reset}
          accessibilityLabel="close"
          style={{ position: 'absolute', inset: 0, backgroundColor: 'transparent' }}
        />
      ) : (
        <Scrim hole={lit} onPress={reset} />
      )}
      <View
        style={
          mode === 'dock' || mode === 'court'
            ? { flex: 1 }
            : { flex: 1, alignItems: 'center', justifyContent: 'center' }
        }
        pointerEvents="box-none"
      >
        <Animated.View
          entering={enter}
          accessibilityViewIsModal
          style={[
            frame,
            placed,
            // the panel body is a column of header / grid / foot bar — RN's
            // default, but stated so a reader never has to assume it
            { flexDirection: 'column', alignItems: 'stretch' },
            mode === 'dock' || mode === 'court' ? { padding: 0 } : null,
          ]}
        >
          {mode === 'dock' || mode === 'court' ? (
            body(panel)
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: m.compact ? m.sp : m.spLg }}
              showsVerticalScrollIndicator={false}
            >
              {body(panel)}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
