import { useEffect } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { flushPersist, useGameStore } from '../store/gameStore';

/**
 * The game clock.
 *
 * `setInterval` drifts and gets throttled or suspended, so the interval is only
 * a repaint tick: the elapsed time is always derived from a wall-clock stamp,
 * and whatever the app missed while backgrounded is credited in one go when it
 * comes back. That is also why the store's `tick` takes a number of seconds
 * rather than assuming one.
 */
/** One clock, one lock, one name for it. */
const AWAKE_TAG = 'hooplog-clock';

export function useClock(): void {
  const running = useGameStore((s) => s.running);

  /**
   * A SCORER'S TABLET MUST NOT SLEEP MID-GAME.
   *
   * THIS IS `useKeepAwake()` WRITTEN OUT, AND THE ONLY DIFFERENCE IS THE
   * `catch`. The hook's own cleanup calls `deactivateKeepAwake` and does not
   * handle the rejection, and on WEB that rejection is routine rather than
   * exceptional: `activate` awaits `navigator.wakeLock.request('screen')`, so
   * a tab that is hidden, unfocused or simply unmounted before the request
   * settles never lands in the library's tag map — and `deactivate` throws
   * `ERR_KEEP_AWAKE_TAG_INVALID` when the tag is not there. The result was an
   * uncaught error, and in development a FULL-SCREEN overlay, thrown by
   * navigating between two screens.
   *
   * There is nothing to recover from and nothing to tell the scorer: failing
   * to release a lock that was never taken is the correct end state. Native is
   * unaffected either way — its `activate` is synchronous enough that the map
   * is always populated — so this costs that platform nothing and keeps the
   * wake lock working everywhere it can actually be taken.
   *
   * The tag is a CONSTANT rather than `useId()`, which is what the hook uses:
   * there is exactly one clock in the app, and a stable tag means a remount
   * cannot leave an orphaned lock under an id nobody holds any more.
   */
  useEffect(() => {
    activateKeepAwakeAsync(AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(AWAKE_TAG).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    const startedAt = Date.now();
    let credited = 0;

    const step = () => {
      const whole = Math.floor((Date.now() - startedAt) / 1000);
      const delta = whole - credited;
      if (delta <= 0) return;
      credited = whole;
      useGameStore.getState().tick(delta);
    };

    const id = setInterval(step, 250);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') step();
      else flushPersist(); // never lose a quarter to the debounce
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running]);
}
