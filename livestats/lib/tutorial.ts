import { TALLY } from '../constants/game';
import {
  TUTORIAL_BOARD,
  TUTORIAL_FOULED_OUT,
  TUTORIAL_SQUAD,
  TUTORIAL_STARTERS,
  PANEL_TARGETS,
  TUTORIAL_STEPS,
  stepApplies,
  type Done,
  type TargetId,
  type TutorialStep,
} from '../constants/tutorial';
import { buildPlayers } from './roster';
import type { Options } from '../constants/options';
import type { GameState, Position } from '../types';

/**
 * THE RULES OF THE WALKTHROUGH, AS PLAIN FUNCTIONS.
 *
 * Same side of the line as `lib/actions.ts`, `lib/box.ts` and `lib/billing.ts`,
 * and for the same reason: the thing that decides whether a scorer has finished
 * a step is the last rule that should only be testable by installing the app
 * and tapping twenty times. Nothing here imports React, a store or a
 * component, so `npm run check` walks the whole script.
 *
 * The overlay owns the animation and the measuring. This owns WHICH step, WHAT
 * it points at, and WHETHER it is finished.
 */

/* ---- which steps are in this scorer's tour --------------------------- */

/**
 * THE TOUR IS CUT TO THE BOARD THIS SCORER ACTUALLY HAS.
 *
 * Three steps exist twice — free throws, a player's row — once per mode, and
 * the assist step only exists at all if the board asks the question. Teaching a
 * mode the scorer has switched off is teaching a board they will never see, so
 * the step that does not apply is dropped rather than disabled, and the counter
 * renumbers itself off the result. See `When`.
 */
export const visibleSteps = (o: Options): TutorialStep[] =>
  TUTORIAL_STEPS.filter((s) => stepApplies(s, o));

/** Where a remembered step id sits in THIS tour, or the start if it is not in it. */
export function stepIndex(steps: readonly TutorialStep[], id: string | null): number {
  if (!id) return 0;
  const i = steps.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

/* ---- what a step points at ------------------------------------------ */

/**
 * THE SPOTLIGHT FOLLOWS THE FLOW, WHICH IS WHY THIS IS NOT `step.target`.
 *
 * Three of the steps are more than one tap — a shot is a spot, then a result,
 * then a shooter — and a ring left on the floor while the scorer is looking at
 * a list of names is a ring pointing at the wrong thing. `via` is the map from
 * whatever panel is open to what the tour should be pointing at, and the bare
 * `target` is the answer with nothing open.
 *
 * A step with no `via` entry for the open panel keeps its own target, and the
 * overlay falls back to the panel's own frame if that target has not reported a
 * box — so a cut-out never lands on empty floor.
 */
export function targetFor(step: TutorialStep, panelKind: string | null): TargetId | null {
  if (panelKind && step.via) {
    const hit = step.via.find((v) => v.panel === panelKind);
    if (hit) return hit.target;
  }
  return step.target;
}

/**
 * WHERE INSIDE THE TARGET THE FINGER LANDS, AND WHY IT IS NOT THE CENTRE.
 *
 * Every other target on the board is a control, and the middle of a control is
 * the only honest place to point at one. The FLOOR is not a control: it is
 * seven zones, and the step that says *a made three* while a hand hovers over
 * the paint is teaching the opposite of its own title. A tap at the centre of
 * the court is a two.
 *
 * So a step about the floor carries its own `spot`, read as a share of the
 * target's box — which is exactly what a court position is; `Court` places
 * every dot the same way. `npm run check` asserts each one really is the shot
 * the title names.
 *
 * Null everywhere else, which the finger reads as "the middle of it".
 */
export function spotFor(step: TutorialStep, target: TargetId | null): Position | null {
  if (target !== 'court') return null;
  return step.spot ?? null;
}

/* ---- whether a step is finished ------------------------------------- */

/**
 * THE HALF OF THE WORLD THE TOUR WATCHES.
 *
 * Not the `GameState` — the tour has no business reading a box score — but the
 * five facts that can tell it a tap landed: what is open, what has been logged,
 * the two hand-counted numbers off the footer, and whether the clock is going.
 * `events` is reduced to a type and, for a shot, whether it went in; nothing
 * else about an event matters to a walkthrough.
 *
 * Two of these are taken: one when the step begins and one now. Comparing them
 * is the whole completion rule, and comparing against the START rather than
 * against the previous frame is what makes a step survive a re-render, a
 * rotation, or the scorer taking a phone call in the middle of it.
 */
export interface Watch {
  panel: string | null;
  /**
   * `uiStore.opens`. The KIND alone cannot say that a tap landed — a player
   * panel reopens as itself after every tally — so what is compared is how many
   * times something has been opened since the step began.
   */
  opens: number;
  events: readonly { type: string; made: boolean | null }[];
  /** the two counters on the footer's fourth cell, neither of which logs */
  possessions: number;
  timeouts: number;
  running: boolean;
}

/** The events logged since the step opened — the only ones that can finish it. */
const since = (start: Watch, now: Watch) => now.events.slice(start.events.length);

export function isDone(done: Done, start: Watch, now: Watch): boolean {
  switch (done.on) {
    case 'panel':
      return now.opens > start.opens && now.panel === done.kind;

    case 'event':
      return since(start, now).some((e) => e.type === done.type);

    // THE FOUR TALLIES ARE ONE ANSWER, and the table in `constants/game.ts` is
    // what says which four — naming them here would be a fifth tally away from
    // a step that quietly stops finishing.
    case 'tally':
      return since(start, now).some((e) => e.type in TALLY);

    // whatever this board opens for a row, which is `options.tap`'s business
    // and not this step's
    case 'anyPanel':
      return now.opens > start.opens && now.panel !== null;

    // a shot the scorer asked for, not merely any shot: the tour teaches a
    // miss and then a make, and finishing the second on the first would skip
    // the step that explains the arc
    case 'shot':
      return since(start, now).some((e) => e.type === 'shot' && e.made === done.made);

    case 'poss':
      return now.possessions > start.possessions;

    case 'timeout':
      return now.timeouts > start.timeouts;

    // either direction. The board opens stopped, so the honest tap is a start —
    // but a scorer who started it before reaching this step should not be stuck
    case 'clock':
      return now.running !== start.running;

    /**
     * SOMETHING WENT BACKWARDS, and only one control on the board does that.
     *
     * It is not enough to watch the LOG. `undo()` restores whatever the last
     * snapshot covered, and the last thing pushed before this step is usually
     * the POSSESSION a few steps earlier — which changes a counter and leaves
     * the log exactly as long as it was. (A timeout now moves both, and the
     * step must not start depending on that: the possession half never will.)
     * Watching all three is what makes the step finish whatever the scorer
     * happened to do last.
     *
     * Reading the undo stack's own depth is the thing this cannot do: it is a
     * module-scope array in `gameStore`, deliberately not state, and it
     * notifies nobody.
     */
    case 'undo':
      return (
        now.events.length < start.events.length ||
        now.possessions < start.possessions ||
        now.timeouts < start.timeouts
      );

    // nothing to tap: the caption carries the button
    case 'next':
      return false;
  }
}

/** Whether the step's caption has to grow a Next — the same question, named. */
export const needsButton = (step: TutorialStep): boolean => step.done.on === 'next';

/**
 * WHETHER A STEP STILL WANTS WHATEVER IS OPEN.
 *
 * Asked on the way OUT of every step, and the tour closes the sheet when the
 * answer is no. See `PANEL_TARGETS` for what makes it necessary: a step whose
 * flow ends on a sheet leaves one standing, and the step after it points at a
 * control on the board underneath that sheet.
 *
 * A step wants it if it POINTS at something on a sheet, or if its `via` names
 * the sheet that happens to be open.
 */
export function wantsPanel(step: TutorialStep, panelKind: string | null): boolean {
  if (step.target && PANEL_TARGETS.includes(step.target)) return true;
  return !!panelKind && !!step.via?.some((v) => v.panel === panelKind);
}

/* ---- the throwaway game --------------------------------------------- */

/**
 * THE GAME THE TOUR IS PLAYED ON, BUILT THE WAY EVERY OTHER GAME IS.
 *
 * `buildPlayers` is the one crossing from a roster into a game and this uses
 * it, so the tour's five are fresh `Player`s with their own zeroed stats,
 * exactly like a real tip-off. What it adds afterwards is the one thing a
 * tip-off cannot produce: somebody already disqualified, so the step about a
 * fouled-out row has a row to point at.
 *
 * IT OPENS AT ZERO, all three counters and the log alike. The board carried a
 * running scoreboard once, on the argument that a readout of something reads
 * better than three zeros; the tour is a place where CAUSE AND EFFECT beats
 * plausibility, and a scorer cannot see their own tap move a number that
 * started at eighteen. So the score, the opponent's score, both footer counters
 * and the play log are all the scorer's own from the first tap on — which is
 * also what leaves undo nothing of the app's making to take back.
 *
 * The RULES are the scorer's own settings, stamped the way `startGame` stamps
 * them, so the period cell says what their board would say.
 */
export function tutorialGame(o: Options, teamName: string): GameState {
  const players = buildPlayers([...TUTORIAL_SQUAD], [...TUTORIAL_STARTERS]).map((p) =>
    p.id === TUTORIAL_FOULED_OUT ? { ...p, status: 'out' as const } : p,
  );

  return {
    team: { name: teamName },
    // the tour's throwaway game belongs to no team, and must not: it is never
    // saved, so nothing ever files it. `squadIdOf` would read this as the
    // first team if anything asked, and nothing does.
    squadId: '',
    squadName: '',
    // it is never filed, but a game has to be one of the two kinds and a
    // practice is the honest reading of a board nobody is keeping
    kind: 'practice',
    competition: '',
    opponent: '',
    note: '',
    score: TUTORIAL_BOARD.score,
    oppScore: TUTORIAL_BOARD.oppScore,
    periods: o.periods,
    periodLen: o.periodLen,
    // clamped, because a scorer playing two halves has no second quarter
    period: Math.min(TUTORIAL_BOARD.period, o.periods),
    // part way in, and STOPPED — which is what the clock step is about
    remaining: Math.round(o.periodLen * 0.6),
    running: false,
    ended: false,
    possessions: TUTORIAL_BOARD.possessions,
    timeouts: TUTORIAL_BOARD.timeouts,
    players,
    events: [],
  };
}
