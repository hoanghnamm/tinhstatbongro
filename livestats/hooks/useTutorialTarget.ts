import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';

import { useTutorialStore } from '../store/tutorialStore';
import type { TargetId } from '../constants/tutorial';

/**
 * A CONTROL REPORTS ITS OWN BOX SO THE WALKTHROUGH CAN CUT A HOLE AROUND IT.
 *
 * The same shape — and for the same reasons — as `useLitRect` in
 * `store/layoutStore.ts`, which is the scrim's half of exactly this problem.
 * Two hooks rather than one because the two answer different questions and are
 * asked at different times: the scrim wants THE ONE control that is lit, right
 * now, and holds a single slot; the tour wants ANY of eighteen, by name, and
 * holds a map. Widening `RectKey` would put the tour's names in the file whose
 * first line is "only the board writes here".
 *
 * ## COORDINATES ARE ONLY VALID FOR THE FRAME THEY WERE TAKEN IN
 *
 * The board has two layouts, `options.bar` decides which edge the three keys
 * take, and the rail's contents change as players foul out — so nothing here is
 * ever hardcoded and everything is `measureInWindow`. Three things make a box
 * go stale and all three are handled:
 *
 *  - **The control moved.** `onLayout` fires and it measures again.
 *  - **The step changed, or a panel mounted.** The overlay bumps `seq`, which
 *    is in this hook's dependency list, so every registered target re-measures
 *    without any of them knowing why.
 *  - **The device turned.** `useWindowDimensions` re-lays out the board, which
 *    fires `onLayout` on everything; the overlay bumps `seq` as well, because a
 *    control whose box did not change may still have moved on screen.
 *
 * ## IT COSTS A REAL GAME NOTHING
 *
 * The ref is always attached — attaching one is free and a ref that arrives a
 * frame after the tour starts is a cut-out on empty floor — but nothing is
 * measured, written or cleaned up unless `active`. A scorer who never opens the
 * walkthrough pays one subscription per instrumented control and no work.
 *
 * The cleanup clears the slot, and React runs every cleanup in a commit before
 * any effect — so a control unmounting cannot wipe the box of the one taking
 * its place, which is the bug `useLitRect` documents.
 */
export interface TutorialTarget {
  ref: React.RefObject<View | null>;
  /** undefined while the tour is closed, so nothing is called on a real board */
  onLayout?: () => void;
}

export function useTutorialTarget(id?: TargetId): TutorialTarget {
  const ref = useRef<View>(null);
  /**
   * THE TWO SELECTORS ANSWER A CONSTANT WHEN THERE IS NO NAME, and that is not
   * a micro-optimisation.
   *
   * `Press` calls this hook unconditionally — hooks cannot be conditional — so
   * every pressable in the app is a subscriber, on every screen, tour or no
   * tour. `seq` is bumped on every re-measure, and a subscription to it would
   * re-render every button in the app each time the walkthrough turned a
   * corner. Reading through the name means an unnamed control's selector
   * returns the same `false` and the same `0` for ever, and zustand never
   * notifies it.
   */
  const active = useTutorialStore((s) => (id ? s.active : false));
  const seq = useTutorialStore((s) => (id ? s.seq : 0));
  const setRect = useTutorialStore((s) => s.setRect);
  const clearRect = useTutorialStore((s) => s.clearRect);

  const measure = useCallback(() => {
    if (!id) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      // a control mid-layout reports a zero box, and a zero-sized hole is a
      // scrim with a seam in it rather than a spotlight
      if (w > 0 && h > 0) setRect(id, { x, y, w, h });
    });
  }, [id, setRect]);

  useEffect(() => {
    if (!active || !id) return;
    // AFTER THE COMMIT, NOT DURING IT. `measureInWindow` on a node the platform
    // has not laid out yet answers with zeros, and a panel that has just
    // mounted is exactly that case — which is the one the prompt for this hook
    // called out. A task lets the frame settle first.
    const t = setTimeout(measure, 0);
    return () => {
      clearTimeout(t);
      clearRect(id);
    };
  }, [active, id, seq, measure, clearRect]);

  return { ref, onLayout: active && id ? measure : undefined };
}

/**
 * TWO REFS ON ONE NODE.
 *
 * `Press` already hands its inner ref to the scrim for the lit control, and
 * three of the tour's targets are controls that do exactly that — PF, the
 * period cell, a player's row. React takes one ref per node, so the two are
 * merged into a callback rather than one of them being dropped.
 */
export function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): (node: T | null) => void {
  return (node) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === 'function') r(node);
      else (r as React.MutableRefObject<T | null>).current = node;
    }
  };
}

/**
 * The same thing, held still across renders.
 *
 * A fresh callback ref on every render makes React detach and re-attach the
 * node each time — it calls the old one with `null` and the new one with the
 * node — which on a board that repaints once a second for the clock is a lot of
 * churn for a ref that never changes. `Press` is the caller, and it is the one
 * component in the app that every control is built on.
 */
export function useMergedRef<T>(
  a: React.Ref<T> | undefined,
  b: React.Ref<T> | undefined,
): (node: T | null) => void {
  return useMemo(() => mergeRefs(a, b), [a, b]);
}
