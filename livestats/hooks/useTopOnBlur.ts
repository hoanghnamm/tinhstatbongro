import { useCallback, type RefObject } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * A ROOM IS ENTERED AT THE TOP OF IT.
 *
 * The four tabs stay MOUNTED behind one another — that is what makes switching
 * between them instant — and a mounted list keeps its scroll offset. So a
 * scorer who read to the bottom of MATCHES, stepped over to TEAM and came back
 * landed halfway down a shelf with no header in sight, which reads as a screen
 * that has lost its place rather than as one they left there: the tab is a
 * ROOM, and pressing its name is walking in through the door, not resuming.
 *
 * IT HAPPENS ON THE WAY OUT, not on the way in. `useFocusEffect`'s cleanup runs
 * on BLUR, while the room is already behind the one being opened, so the list
 * is standing at the top before it is looked at again — resetting on focus
 * would do the same arithmetic a frame after the room is on screen, and the
 * jump would be visible. `animated: false` for the same reason: nobody is
 * watching this scroll, and a 300ms glide is 300ms the tab could be tapped
 * again in.
 *
 * The ref may be empty (a branch that draws no list, a room never opened) and
 * both calls are guarded: a screen wires this up once, unconditionally, and the
 * hook does nothing until there is something to move.
 */

/** What this hook needs of a scroller: either half, whichever the caller is. */
export type Scrollable = Partial<{
  scrollTo(o: { y: number; animated: boolean }): void;
  scrollToOffset(o: { offset: number; animated: boolean }): void;
}>;

/**
 * Sends `ref` back to offset 0 when the screen loses focus.
 *
 * `after` is the caller's own bookkeeping — the TEAM tab tracks where its list
 * is standing so the keyboard lift can scroll BY an overlap, and that copy has
 * to be told, because a programmatic scroll is not guaranteed to come back
 * through `onScroll` on either platform.
 */
export function useTopOnBlur<T extends Scrollable>(ref: RefObject<T | null>, after?: () => void): void {
  useFocusEffect(
    useCallback(() => () => {
      const el = ref.current;
      el?.scrollTo?.({ y: 0, animated: false });
      el?.scrollToOffset?.({ offset: 0, animated: false });
      after?.();
    }, [ref, after]),
  );
}
