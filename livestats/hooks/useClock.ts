import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';

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
export function useClock(): void {
  const running = useGameStore((s) => s.running);

  // a scorer's tablet must not sleep mid-game
  useKeepAwake();

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
