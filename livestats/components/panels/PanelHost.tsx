import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';

import { useCourtBox, useDockBox } from '../../hooks/usePanelBox';
import { useReducedMotion } from '../../hooks/useReducedMotion';
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
import { PlayerActionsPanel } from './PlayerActionsPanel';
import { PlaysPanel } from './PlaysPanel';
import { RebKindPanel } from './RebKindPanel';
import { SetClockPanel } from './SetClockPanel';
import { SubOutPanel } from './SubOutPanel';
import { TotalsPanel } from './TotalsPanel';
import { TripShotsPanel } from './TripShotsPanel';
import { TripSizePanel } from './TripSizePanel';
import { WhatPanel } from './WhatPanel';
import { WhoPanel } from './WhoPanel';
import { MODE } from './placement';

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
    case 'totals': return <TotalsPanel />;
    case 'plays': return <PlaysPanel />;
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
            width: Math.min(m.win.w * (mode === 'wide' ? 0.96 : 0.92), m.win.h * (mode === 'wide' ? 1.68 : 0.78)),
            maxHeight: m.win.h * (m.compact ? 0.94 : 0.92),
          };

  const enter = reduced
    ? undefined
    : mode === 'dock'
      ? SlideInRight.duration(160)
      : FadeIn.duration(160);

  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      {/* the dock must not dim what is behind it — that is its whole reason */}
      <Pressable
        onPress={reset}
        accessibilityLabel="close"
        style={{
          position: 'absolute', inset: 0,
          backgroundColor: mode === 'dock' ? 'transparent' : 'rgba(0,0,0,0.45)',
        }}
      />
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
