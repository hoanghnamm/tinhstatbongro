import { useCallback, useEffect } from 'react';
import { router } from 'expo-router';

import { type Gate, locked } from '../lib/billing';
import { useBillingStore } from '../store/billingStore';

/**
 * THE ONE PLACE A COMPONENT ASKS WHETHER SOMETHING IS PAID FOR.
 *
 * `lib/billing.ts` owns the rule and `store/billingStore.ts` owns the two
 * booleans; this is the join, and it exists so that no screen ever reads
 * `entitled` directly. A component that tested the flag itself would be a
 * second copy of the rule — and the rule is exactly the kind that drifts,
 * because "is this locked" gets asked from four screens that were written
 * months apart.
 */

/** Is this behind the wall right now? */
export function useLocked(gate: Gate): boolean {
  const entitled = useBillingStore((s) => s.entitled);
  const trialUsed = useBillingStore((s) => s.trialUsed);
  return locked(gate, { entitled, trialUsed });
}

/**
 * OPEN THE PAYWALL, SAYING WHICH DOOR IT WAS.
 *
 * The gate rides in the route so the screen can print the line that connects
 * the tap to the wall — see `GATE_PITCH`. It is a param rather than a store
 * field because it is a fact about THIS navigation and nothing else; parked in
 * `uiStore` it would survive the screen and be stale the next time.
 */
export function showPaywall(gate?: Gate): void {
  router.push(gate ? { pathname: '/paywall', params: { gate } } : '/paywall');
}

/**
 * THE PAIR EVERY GATED CONTROL WANTS: whether to stop, and what to do instead.
 *
 * `guard` is the shape that reads best at a call site — hand it what the
 * control was going to do and it either does it or shows the wall:
 *
 *     const newGame = guard('newGame', () => router.push('/start'));
 */
export function useGate(gate: Gate): { locked: boolean; guard(run: () => void): () => void } {
  const isLocked = useLocked(gate);

  const guard = useCallback(
    (run: () => void) => () => {
      if (isLocked) showPaywall(gate);
      else run();
    },
    [isLocked, gate],
  );

  return { locked: isLocked, guard };
}

/**
 * SHOWN ONCE PER COLD START, AND THE FLAG IS AT MODULE SCOPE.
 *
 * The rule is "every launch until they subscribe", which means once per PROCESS
 * — not once per mount. The lobby mounts and unmounts as a scorer moves through
 * the tab group, and a paywall keyed on mounting would reappear every time they
 * came home from the board. A module-level boolean is the honest shape for
 * "this process has already done it": it dies with the app, which is exactly
 * the lifetime wanted, and it is deliberately NOT in a store, because nothing
 * on screen depends on it and putting it in state would repaint the lobby for a
 * fact no pixel reads. `gameStore`'s undo stack lives at module scope for the
 * same reason.
 *
 * It is fired from the LOBBY rather than from `app/_layout.tsx` because the
 * root holds the first frame until the fonts land and has no route mounted to
 * push from — and the lobby is where a cold start arrives anyway.
 *
 * NO GATE IS PASSED. This one is not an answer to a tap, so there is nothing to
 * say "unlock to..." about; the screen falls back to its own headline.
 */
let launched = false;

/**
 * SPEND THE LAUNCH WALL WITHOUT SHOWING IT.
 *
 * One caller: `hooks/useIntro.ts`, on the launch that opens the ONBOARDING.
 * The door's last step is the trial's own offer with SEE PLANS on it, so a
 * paywall stacked over it — or waiting on the lobby the moment the scorer
 * steps out — is the same pitch twice inside ten seconds. It is the flag and
 * not a second condition inside the hook below, because the rule is still
 * "once per process": the door is simply what that process spent it on.
 */
export function markLaunchShown(): void {
  launched = true;
}

/**
 * `hold` IS THE DOOR. While the intro is pending — the persisted answer has
 * not landed, or it says this scorer has not been introduced — the lobby is
 * mounted but is not a screen anybody is looking at, and pushing a wall onto
 * it would put the paywall UNDER the onboarding in the stack.
 */
export function useLaunchPaywall(hold = false): void {
  const entitled = useBillingStore((s) => s.entitled);

  useEffect(() => {
    if (hold || launched || entitled) return;
    launched = true;
    showPaywall();
  }, [entitled, hold]);
}
