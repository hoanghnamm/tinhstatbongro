import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { mmss, ord } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { dockFooterOverlap, useMeasure, useRects } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Surface } from '../ui/Surface';

/** The mis-tap that loses a game gets four seconds of second thoughts. */
const ARM_MS = 4000;

function Divider() {
  const t = useTheme();
  return (
    <View
      style={{
        flexGrow: 0, flexShrink: 0,
        width: 1, height: '60%',
        alignSelf: 'center',
        backgroundColor: t.rule,
      }}
    />
  );
}

/**
 * UNDO / clock / period / END. There is no PLAY button and no CLOCK button:
 * the time IS the clock control, and it carries its own state as colour, so
 * "is the clock running" needs no second glance. Stopped is the base state, so
 * a board nobody has touched reads red — which is true.
 *
 * The flex split is the whole layout: UNDO and END take `flex:1` and share the
 * remainder, while the time and the period size to their own text and never
 * shrink. That is what puts the pair in the true middle of the row instead of
 * at a flex ratio's guess — and without it all four cells bunch at the left.
 */
export function Footer() {
  const m = useMetrics();
  const t = useTheme();
  const { ref, onLayout } = useMeasure('footer');
  const rects = useRects();

  const remaining = useGameStore((s) => s.remaining);
  const period = useGameStore((s) => s.period);
  const running = useGameStore((s) => s.running);
  const ended = useGameStore((s) => s.ended);
  const setRunning = useGameStore((s) => s.setRunning);
  const undo = useGameStore((s) => s.undo);

  const panel = useUiStore((s) => s.panel);
  const open = useUiStore((s) => s.open);

  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  // the dock panel runs the full height of the column beside the court, which
  // is over END. The footer gives back exactly the overlap so the nav's four
  // cells re-centre in what is left instead of hiding under it.
  const trim = panel?.kind === 'what' ? dockFooterOverlap(rects) : 0;

  const onEnd = () => {
    if (armTimer.current) clearTimeout(armTimer.current);
    if (armed) {
      setArmed(false);
      open({ kind: 'endGame' });
      return;
    }
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), ARM_MS);
  };

  const clockGrad = running ? t.clockRun : t.clockStop;

  const edgeCell = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignSelf: 'stretch' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: m.s1,
  };

  const navText = {
    fontFamily: fNum(600),
    fontSize: m.fsNav,
    letterSpacing: ls(m.fsNav, LS_BTN),
  };

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      style={{ height: m.ftr, flexGrow: 0, flexShrink: 0, paddingRight: trim }}
    >
      <Surface
        style={{
          flex: 1,
          minHeight: m.tap,
          borderWidth: 1,
          borderColor: t.rule,
          borderRadius: m.r,
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          overflow: 'hidden',
        }}
      >
        <Press
          onPress={undo}
          accessibilityLabel="undo the last entry"
          style={edgeCell}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          <Text numberOfLines={1} style={{ ...navText, color: t.ink }}>
            UNDO
          </Text>
        </Press>

        <Divider />

        {/* the two clock cells share one gradient and no rule between them, so
            they read as a single cell while staying two buttons */}
        <LinearGradient
          colors={[clockGrad[0], clockGrad[1]]}
          style={{
            flexGrow: 0,
            flexShrink: 0,
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'stretch',
          }}
        >
          <Press
            onPress={() => setRunning(!running)}
            accessibilityLabel="start or stop the clock"
            style={{
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingLeft: m.s2,
            }}
            pressedStyle={{ opacity: 0.9 }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(700),
                fontSize: m.fsNavLg,
                color: t.clockInk,
                textAlign: 'right',
                fontVariant: ['tabular-nums'],
              }}
            >
              {mmss(remaining)}
            </Text>
          </Press>

          <Press
            onPress={() => { if (!ended) open({ kind: 'endQuarter' }); }}
            accessibilityLabel="end this quarter or adjust the clock"
            style={{
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: m.s2,
              paddingRight: m.s2,
            }}
            pressedStyle={{ opacity: 0.9 }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(600),
                fontSize: m.fsNavSm,
                letterSpacing: ls(m.fsNavSm, LS_LABEL),
                color: t.clockInk,
                opacity: 0.75,
                fontVariant: ['tabular-nums'],
              }}
            >
              {ord(period).toUpperCase()} QT
            </Text>
          </Press>
        </LinearGradient>

        <Divider />

        <Press
          onPress={onEnd}
          accessibilityLabel={armed ? 'confirm ending the game' : 'end the game'}
          style={[edgeCell, armed ? { backgroundColor: t.danger } : null]}
          pressedStyle={armed ? { opacity: 0.9 } : { backgroundColor: t.surface2 }}
        >
          <Text
            numberOfLines={1}
            style={{ ...navText, color: armed ? t.dangerInk : t.danger }}
          >
            {armed ? 'CONFIRM END' : 'END'}
          </Text>
        </Press>
      </Surface>
    </View>
  );
}
