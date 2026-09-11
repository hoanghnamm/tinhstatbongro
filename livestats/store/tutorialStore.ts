import { Store } from '../platform/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TUTORIAL_STEPS } from '../constants/tutorial';
import { stepIndex, tutorialGame, visibleSteps } from '../lib/tutorial';
import { currentGame, installGame, pausePersist, useGameStore } from './gameStore';
import { useUiStore } from './uiStore';
import type { TargetId } from '../constants/tutorial';
import type { Rect } from './layoutStore';
import type { GameState } from '../types';

/**
 * THE NINTH STORE, AND IT HOLDS TWO KINDS OF THING.
 *
 * ## THE SESSION
 *
 * `active`, the step, and the boxes every spotlit control has reported. None of
 * it is persisted: a walkthrough interrupted by the OS killing the app is a
 * walkthrough that starts again, which is the right answer for a thing that
 * takes two minutes and can be run as often as the scorer likes.
 *
 * ## THE MEMORY
 *
 * `completed`, `lastStep` and `outroShown`, which ARE persisted and which
 * NOTHING IS GATED ON. They exist to offer to resume and to keep the app from
 * pointing at the lobby row twice; no screen, no verb and no gate reads them.
 * That is deliberate and it is the line this store must not cross — the moment
 * something is locked behind having watched a tutorial, the tutorial is a
 * chore.
 *
 * ## THE THROWAWAY GAME
 *
 * The tour runs on the REAL board against a game built by `lib/tutorial.ts`,
 * because a mimed board teaches a board that does not exist. Two things make
 * that safe, and both live here:
 *
 *  - **The scorer cannot enter with a game standing.** `canStart()` is the
 *    lobby's own `inProgress` test, and the row is dark while a game is on. So
 *    there is never a live game for the tour to stand on top of.
 *  - **Persistence is PAUSED for the length of the tour, and the board it
 *    replaced is stashed in memory.** The disk therefore holds the scorer's own
 *    board the whole way through: a crash mid-tour loses the tour and nothing
 *    else, which is the correct thing to lose. `finish()` puts the stash back
 *    and lets the writer go again.
 *
 * Nothing here reaches `historyStore`, and `EndGamePanel`'s save, trial spend
 * and route are all short-circuited while `active` is true — see that file.
 */

/**
 * WHERE THE TOUR GOES WHEN IT IS OVER, DECIDED BY WHOEVER STARTED IT.
 *
 * `lobby` is a stated `replace('/')` and it is the lobby row's answer: that
 * row is reached by `push` off the lobby, by `replace` out of the picker and
 * by a deep link with no stack at all, so the only honest destination is a
 * named one — the same three cases EXIT on the quarter panel has to survive.
 *
 * `back` is THE DOOR'S, and it is the one entry that has something to come
 * back to. `app/intro.tsx` PUSHES the board over itself with the door still
 * mounted underneath, because the tour is the third of four steps and the
 * trial is still owed; popping is what puts the scorer back on the step they
 * left, with the door's own state untouched. Nothing else may take it.
 */
export type TourExit = 'lobby' | 'back';

export interface TutorialState {
  /* ---- the session -------------------------------------------------- */
  active: boolean;
  /** where `finish` leaves the scorer; see `TourExit`. Never persisted. */
  exit: TourExit;
  /** the step by ID, never by index: `visibleSteps` renumbers per settings */
  stepId: string | null;
  /** the skip confirm is up, so the overlay stops advancing */
  confirming: boolean;
  /** every spotlight target that has reported a box, in window coordinates */
  rects: Partial<Record<TargetId, Rect>>;
  /**
   * Bumped to make every registered target measure itself again. A rotation, a
   * flipped action column and a panel that has just mounted all move boxes
   * without moving the thing that reads them, and a cut-out is only valid for
   * the frame it was taken in.
   */
  seq: number;

  /* ---- the memory --------------------------------------------------- */
  completed: boolean;
  lastStep: string | null;
  /** the way back in has been pointed out once; see TUTORIAL_COPY.outro */
  outroShown: boolean;
  /**
   * THE POINTER IS OWED ON THE LOBBY, NOT ON THE BOARD, so it cannot be said
   * where it is decided. `finish()` raises this on the way out and the lobby
   * lowers it as it says the line — which is also why it is NOT persisted: a
   * pointer that survived a kill would arrive at a launch with nothing behind
   * it.
   */
  outroPending: boolean;
  hydrated: boolean;

  /* ---- the verbs ---------------------------------------------------- */
  /**
   * Stash the board, install the tour's game, pause the writer, go live.
   *
   * `from` is the step to open on, and its only caller is the resume confirm —
   * a tour started fresh always opens on the first step, whatever is
   * remembered. `stepIndex` decides what a remembered id means in THIS tour, so
   * a step dropped by a setting change since lands at the start rather than
   * nowhere.
   *
   * `exit` is where the way out lands, and it is the CALLER'S to state because
   * the caller is the only one that knows what is underneath the board. It
   * defaults to the lobby, so a new way in has to say out loud that it has a
   * stack worth popping.
   */
  begin(from?: string, exit?: TourExit): void;
  /** Put the board back, let the writer go, and remember where they got to. */
  finish(completed: boolean): void;
  goto(stepId: string): void;
  setConfirming(on: boolean): void;
  setRect(id: TargetId, rect: Rect): void;
  clearRect(id: TargetId): void;
  remeasure(): void;
  markOutroShown(): void;
  /** debug only, like `resetIntro` and `resetBilling` — no control in the UI */
  resetTutorial(): void;
}

/**
 * THE BOARD THE TOUR REPLACED, AS JSON, AT MODULE SCOPE.
 *
 * Module scope for `gameStore`'s own reason for keeping the undo stack there:
 * nothing on screen depends on it, and putting a whole `GameState` in state
 * would repaint everything that reads this store every time the tour moved.
 * A string rather than an object, so nothing can hand out a reference to it
 * and mutate the board that is waiting to come back.
 */
let stash: string | null = null;

const same = (a: Rect | undefined, b: Rect) =>
  !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      active: false,
      exit: 'lobby',
      stepId: null,
      confirming: false,
      rects: {},
      seq: 0,

      completed: false,
      lastStep: null,
      outroShown: false,
      outroPending: false,
      hydrated: false,

      begin: (from, exit = 'lobby') => {
        if (get().active) return;
        // THE STASH IS TAKEN BEFORE ANYTHING IS PAUSED OR REPLACED, and it is
        // the board exactly as `currentGame` hands it to the shelf — the same
        // sixteen keys, so what comes back is what was there.
        stash = JSON.stringify(currentGame());
        pausePersist(true);

        const g = useGameStore.getState();
        installGame(tutorialGame(g.options, g.team.name));
        // a panel left open from wherever they were would draw itself over the
        // first step
        useUiStore.getState().reset();

        const tour = visibleSteps(g.options);
        const at = tour[stepIndex(tour, from ?? null)] ?? TUTORIAL_STEPS[0];
        set({ active: true, exit, stepId: at.id, confirming: false, rects: {} });
      },

      finish: (completed) => {
        if (!get().active) return;
        const at = get().stepId;

        // the board goes back FIRST, so nothing renders a frame of the tour's
        // game with the overlay already gone
        if (stash) installGame(JSON.parse(stash) as GameState);
        stash = null;
        pausePersist(false);
        useUiStore.getState().reset();

        set({
          active: false,
          // BACK TO THE DEFAULT WITH THE SESSION, so a tour started from the
          // lobby after one started from the door cannot inherit its way out.
          exit: 'lobby',
          stepId: null,
          confirming: false,
          rects: {},
          completed: get().completed || completed,
          // ONCE, EVER. The row is permanent and the tour can be run as often
          // as the scorer likes, so pointing at it after every run is the app
          // repeating itself at somebody who has just been taught something.
          outroPending: !get().outroShown,
          // where they got to, so the next run can offer to pick it up. It is
          // cleared on a finished run: there is nothing to resume.
          lastStep: completed ? null : at,
        });
      },

      goto: (stepId) => set({ stepId, rects: {}, seq: get().seq + 1 }),
      setConfirming: (on) => set({ confirming: on }),

      setRect: (id, rect) => {
        if (same(get().rects[id], rect)) return; // a no-op write would loop the layout
        set({ rects: { ...get().rects, [id]: rect } });
      },
      clearRect: (id) => {
        if (!(id in get().rects)) return;
        const { [id]: _gone, ...rest } = get().rects;
        set({ rects: rest });
      },
      remeasure: () => set({ seq: get().seq + 1 }),

      markOutroShown: () => set({ outroShown: true, outroPending: false }),
      resetTutorial: () =>
        set({ completed: false, lastStep: null, outroShown: false, outroPending: false }),
    }),
    {
      name: 'hooplog-tutorial',
      storage: createJSONStorage(() => Store),
      // ONLY THE MEMORY IS WRITTEN. A tour half-walked when the OS killed the
      // app is not a tour to restore — `active` coming back true would put the
      // overlay on a board with no tutorial game under it.
      partialize: (s) => ({
        completed: s.completed,
        lastStep: s.lastStep,
        outroShown: s.outroShown,
      }),
      version: 1,
      // the same `setState` rather than mutation `introStore` documents: persist
      // applies the merged state and THEN calls this, so writing to `s` in place
      // would change the value and notify nobody
      onRehydrateStorage: () => () => {
        useTutorialStore.setState({ hydrated: true });
      },
    },
  ),
);
