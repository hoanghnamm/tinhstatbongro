import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { useUiStore } from '../store/uiStore';
import { useMetrics } from '../theme/metrics';
import { LS_BTN, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const LIFE_MS = 2600;

/**
 * The court flows close on their final tap, so this is the only evidence an
 * entry landed — and it is where a foul-out is surfaced, since that changes a
 * player's status with nothing else on screen to say so. Everything it reports
 * is still reversible through UNDO.
 */
export function Toast() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const toast = useUiStore((s) => s.toast);
  const hide = useUiStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, LIFE_MS);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.seq}
      entering={reduced ? undefined : FadeInDown.duration(180)}
      exiting={reduced ? undefined : FadeOut.duration(120)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        zIndex: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        bottom: m.ftr + safe.bottom + m.sp * 3,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          maxWidth: Math.min(m.win.w * 0.9, 640),
          paddingVertical: m.s2,
          paddingHorizontal: m.s4,
          borderRadius: 99,
          overflow: 'hidden',
          backgroundColor: toast.bad ? t.danger : t.ink,
          color: toast.bad ? t.dangerInk : t.surface,
          ...fUi(600),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_BTN),
        }}
      >
        {toast.msg}
      </Text>
    </Animated.View>
  );
}
