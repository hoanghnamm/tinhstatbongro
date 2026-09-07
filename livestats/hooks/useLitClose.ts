import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

import { useUiStore, type Panel } from '../store/uiStore';

/**
 * HOW LONG THE TAPPED CONTROL STAYS LIT BEFORE ITS PANEL GOES.
 *
 * It is a flash, not an animation: long enough to be read as "that one
 * landed", short enough that a scorer tapping a run of stats never waits on
 * it. A panel that vanished on the same frame as the tap would leave nothing
 * behind but a number that moved somewhere off the sheet.
 */
export const LIT_MS = 240;

/**
 * RECORD, LIGHT, CLOSE — the shape every entry on the board now has.
 *
 * The two panels that used to stay up after an entry are the player's tiles
 * and the free-throw dock, and both closed the same argument the other way:
 * the panel that reopens itself is faster for a RUN of entries, and a run is
 * not what either one is usually doing. So the last tap ends the flow here
 * exactly as it ends a court flow — the control lights, the sheet goes, and
 * `say()` is the confirmation that something was written.
 *
 * THE CLOSE IS GUARDED ON `uiStore.opens`, not on the panel's kind. Between
 * the tap and the hold running out a scorer can open something else — the next
 * player's tiles are the SAME kind, and closing those would take the tap that
 * opened them with it. The counter answers "has anything opened since", which
 * is the actual question.
 */
export function useLitClose(kind: Panel['kind']) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (note: string) => {
      if (timer.current) clearTimeout(timer.current);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const seq = useUiStore.getState().opens;
      timer.current = setTimeout(() => {
        timer.current = null;
        const u = useUiStore.getState();
        if (u.opens !== seq || u.panel?.kind !== kind) return;
        u.reset();
        u.say(note);
      }, LIT_MS);
    },
    [kind],
  );
}
