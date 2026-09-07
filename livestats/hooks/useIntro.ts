import { useEffect } from 'react';
import { router } from 'expo-router';

import { useIntroStore } from '../store/introStore';
import { markLaunchShown } from './useGate';

/**
 * THE ONE PLACE THE APP ASKS WHETHER THIS SCORER HAS BEEN THROUGH THE DOOR.
 *
 * The same shape `useGate` has, and for the same reason: `store/introStore.ts`
 * remembers the fact, this is the join, and no screen reads `seen` itself.
 *
 * IT IS CALLED FROM THE LOBBY, NOT FROM THE ROOT LAYOUT. `app/_layout.tsx`
 * holds the first frame until the fonts land and has no route mounted to push
 * from — the same argument that put `useLaunchPaywall` here — and a cold start
 * arrives at the lobby anyway. What the scorer actually SEES while this makes
 * up its mind is `components/ui/Launch.tsx`, which the root mounts OVER the
 * navigator: the lobby is behind it, mounted and never looked at.
 *
 * `replace`, NEVER `push`. The door is not a place to come back from, and a
 * back gesture out of step one landing on a lobby the scorer has not been
 * introduced to yet is the state this whole thing exists to avoid.
 *
 * IT WAITS FOR `hydrated`, AND THAT IS THE WHOLE HOOK. `seen` reads `false`
 * before AsyncStorage answers, and `false` is the answer that opens the door —
 * so acting early would restart the onboarding on somebody's hundredth launch,
 * over a season's worth of games. Everything else here is bookkeeping.
 *
 * `pending` is what the lobby needs back: TRUE while the answer is unknown or
 * known to be "not yet", which is exactly the window in which the lobby must
 * not do anything a first-run scorer would have to dismiss.
 */
export function useIntro(): { pending: boolean } {
  const hydrated = useIntroStore((s) => s.hydrated);
  const seen = useIntroStore((s) => s.seen);

  useEffect(() => {
    if (!hydrated || seen) return;
    // THE WALL IS SPENT FOR THIS PROCESS, and the door is what spends it. The
    // last step of the onboarding is the trial's own offer with SEE PLANS on
    // it; a paywall pushed over the top of that, or waiting on the lobby the
    // moment the scorer steps out of the door, is the same pitch twice inside
    // ten seconds.
    markLaunchShown();
    router.replace('/intro');
  }, [hydrated, seen]);

  return { pending: !hydrated || !seen };
}
