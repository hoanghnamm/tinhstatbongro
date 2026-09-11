import { Store } from '../platform/storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * THE EIGHTH STORE, AND IT HOLDS ONE BOOLEAN: has this install been walked
 * through the door yet?
 *
 * It is its own store for exactly the reason `billingStore` is. The fact
 * OUTLIVES EVERY GAME — `startGame` clears `gameStore` — and an install that
 * could forget it had been introduced would introduce itself again on the
 * night of the first real game. It is also its own KIND of thing: not a rule,
 * not a preference, not a record of play. One fact about the install.
 *
 * `hydrated` IS THE HALF THAT IS NOT PERSISTED, and it is the whole reason
 * anything outside this file reads the store rather than a plain flag. Reading
 * `seen` before the disk has answered gets `false` — the DEFAULT — which
 * on a scorer's hundredth launch is the onboarding starting up over a season's
 * worth of games. So the answer is not acted on until the read has actually
 * landed, which is what `hooks/useIntro.ts` waits for and what the launch
 * screen is up for.
 *
 * AN UPGRADING INSTALL IS SHOWN THE DOOR TOO, and that is a decision rather
 * than an oversight. There is no record under this key on a phone that has
 * been keeping stats for months, and no honest signal in this store that says
 * otherwise — every alternative is a heuristic over somebody else's data. What
 * makes it survivable is that NOTHING THE FOUR STEPS SHOW IS BLANK: the club
 * field opens on the club's real name and the roster step is the real roster.
 * It is four taps of review, and it costs nothing that was already there.
 *
 * `resetIntro()` is the debug way back to a fresh install, exactly as
 * `resetBilling()` is, and like it there is no control in the UI: walking the
 * door a second time on one device otherwise means deleting the app.
 */
export interface IntroState {
  /** the door's steps have been finished, or skipped past */
  seen: boolean;
  /** the persisted answer has landed — see the note above */
  hydrated: boolean;

  /** Called once, by the last step. Idempotent by construction. */
  finish(): void;
  /** debug only: back to a fresh install */
  resetIntro(): void;
}

export const useIntroStore = create<IntroState>()(
  persist(
    (set) => ({
      seen: false,
      hydrated: false,

      finish: () => set({ seen: true }),
      resetIntro: () => set({ seen: false }),
    }),
    {
      name: 'hooplog-intro',
      storage: createJSONStorage(() => Store),
      // ONLY THE FACT IS WRITTEN. `hydrated` is about this process and would be
      // a lie the moment it came back off disk as `true` before it was true.
      partialize: (s) => ({ seen: s.seen }),
      version: 1,
      /**
       * THE FLAG EVERY READER ACTUALLY WAITS ON, and it is set through
       * `setState` rather than by writing to the state this callback is handed.
       *
       * That distinction is the whole of it. Persist applies the merged state
       * and THEN calls this, so `s` is the live store object — mutating it in
       * place changes the value and notifies NOBODY, which means the lobby and
       * the launch page both go on rendering `hydrated: false` for ever and the
       * app never opens. `setState` is a real write with a real notification.
       *
       * It runs whether or not the read found anything, because "nothing
       * stored" is an answer too — and on a genuinely fresh install it is the
       * answer that opens the door.
       */
      onRehydrateStorage: () => () => {
        useIntroStore.setState({ hydrated: true });
      },
    },
  ),
);
