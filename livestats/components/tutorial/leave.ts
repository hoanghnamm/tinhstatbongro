import { router } from 'expo-router';

import { useTutorialStore } from '../../store/tutorialStore';

/**
 * THE TOUR'S ONE WAY OUT, AND IT IS A PLAIN FUNCTION FOR THE REASON
 * `showPaywall` IS ONE.
 *
 * It is called from a press handler rather than rendered from, and it does two
 * things that have to happen in this order and cannot be split between two
 * files: put the scorer's own board back — which is `finish`, and which also
 * lets the writer go again — and then move.
 *
 * ## WHERE IT LANDS IS THE CALLER'S, DECIDED WHEN THE TOUR BEGAN
 *
 * `TourExit` is stamped by `begin` and read here BEFORE `finish` puts it back
 * to the default. `lobby` is a STATED `replace('/')`, not `back()`, for the
 * reason EXIT on the quarter panel is stated: the board is reached by `replace`
 * out of the picker, by `push` off the lobby and by a deep link with no stack
 * at all. `back` is the door's, which pushed this board over itself and is
 * still owed its last step.
 *
 * ## AND IT HAS TWO CALLERS, NOT ONE
 *
 * The overlay's own SKIP and its last step are the obvious one. The other is
 * EXIT on the quarter panel — the tour OPENS that panel, and every tile on it
 * is inside the cut-out, so a scorer two minutes in is one tap from a board
 * control whose whole job is to leave the board. Leaving it to `replace('/')`
 * alone is what stranded the tour: `active` still true, the throwaway game
 * still installed, and `pausePersist` still holding the scorer's next real game
 * off the disk. It is the same hazard END GAME is guarded against one tile to
 * the right, and this is that guard.
 */
export function leaveTour(completed: boolean): void {
  const { active, exit, finish } = useTutorialStore.getState();
  if (!active) return;
  finish(completed);
  if (exit === 'back' && router.canGoBack()) router.back();
  else router.replace('/');
}
