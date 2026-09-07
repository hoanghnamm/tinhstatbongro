import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAnnounce } from '../../hooks/useAnnounce';
import {
  isDone,
  needsButton,
  spotFor,
  stepIndex,
  targetFor,
  visibleSteps,
  wantsPanel,
  type Watch,
} from '../../lib/tutorial';
import { useGameStore } from '../../store/gameStore';
import { useRects, type Rect } from '../../store/layoutStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { Caption, SkipButton, SkipConfirm } from './Caption';
import { Finger } from './Finger';
import { Regions } from './Regions';
import { Spotlight } from './Spotlight';

/**
 * THE WALKTHROUGH, OVER THE REAL BOARD.
 *
 * ## Z-ORDER, STATED, BECAUSE IT IS LOAD-BEARING
 *
 * `app/game.tsx` mounts four absolute siblings and they are ordered by hand:
 * the board paints at the bottom, `PanelHost` at **40**, this at **50**, and
 * `Toast` at **60**. Two things follow and both were chosen rather than
 * inherited:
 *
 *  - **Above the panel**, so a step whose control is on a panel can be pointed
 *    at. Below it, the cut-out would be behind the sheet it is cutting.
 *  - **Below the toast**, because step four's whole claim is that a note
 *    confirms the entry, and a walkthrough that covered its own evidence would
 *    be teaching a board the scorer cannot see.
 *
 * The scrim BLOCKS but does not paint when the panel is what is being pointed
 * at: `PanelHost` has already dimmed everything but that sheet, which is the
 * spotlight, drawn by the component whose job it is. See `Spotlight`.
 *
 * ## THE BOXES ARE MEASURED, NEVER ASSUMED
 *
 * Nothing here knows where anything is. Every rect comes from
 * `measureInWindow` — the four regions off `layoutStore`, which the board has
 * always measured for the panels, and every control off
 * `hooks/useTutorialTarget.ts`. That is not fastidiousness: the board has two
 * layouts, `options.bar` decides which edge the three keys take, and the rail's
 * contents change as players foul out. A coordinate is valid for one frame.
 *
 * A rotation and a flipped column are handled by the same line — `remeasure()`
 * on a window change — and a panel that has just mounted by the measure being
 * deferred a task past the commit.
 *
 * ## THE ADVANCE RULE
 *
 * A step ends when the scorer does the thing, which `lib/tutorial.ts` decides
 * from two snapshots of four facts. There is no clock on it and nothing times
 * the scorer out: the card carried a nudge at six seconds and an offer to do
 * the step for them at twelve, and both went with the line they were written
 * under. A tour that talks while nobody has moved is a tour talking over
 * somebody who is reading it.
 */
export function TutorialOverlay() {
  const active = useTutorialStore((s) => s.active);
  // the whole thing is off a board nobody asked to be taught — no timers, no
  // subscriptions, no work
  if (!active) return null;
  return <Tour />;
}

function Tour() {
  const m = useMetrics();
  const win = useWindowDimensions();

  const options = useGameStore((s) => s.options);
  const steps = useMemo(() => visibleSteps(options), [options]);

  const stepId = useTutorialStore((s) => s.stepId);
  const confirming = useTutorialStore((s) => s.confirming);
  const tRects = useTutorialStore((s) => s.rects);
  const goto = useTutorialStore((s) => s.goto);
  const finishTour = useTutorialStore((s) => s.finish);
  const setConfirming = useTutorialStore((s) => s.setConfirming);
  const remeasure = useTutorialStore((s) => s.remeasure);
  const bRects = useRects();

  const idx = Math.min(stepIndex(steps, stepId), steps.length - 1);
  const step = steps[idx];

  /* -- the five facts, now ------------------------------------------- */

  const events = useGameStore((s) => s.events);
  const possessions = useGameStore((s) => s.possessions);
  const timeouts = useGameStore((s) => s.timeouts);
  const running = useGameStore((s) => s.running);
  const panel = useUiStore((s) => s.panel);
  const opens = useUiStore((s) => s.opens);
  const panelKind = panel?.kind ?? null;

  const watch = useMemo<Watch>(
    () => ({
      panel: panelKind,
      opens,
      // the projection mints a fresh array, so it is memoised off `events` —
      // which is a stable reference between mutations. `Court` does the same
      // thing for the same reason.
      events: events.map((e) => ({
        type: e.type,
        made: e.type === 'shot' ? e.result === 'made' : null,
      })),
      possessions,
      timeouts,
      running,
    }),
    [panelKind, opens, events, possessions, timeouts, running],
  );

  /* -- and the five facts as they were when this step opened ---------- */

  const nowRef = useRef(watch);
  nowRef.current = watch;
  const startRef = useRef<Watch>(watch);

  // DECLARED BEFORE THE COMPLETION EFFECT ON PURPOSE. React runs a component's
  // effects in the order they are written, so the new step's baseline is in
  // place before anything asks whether the new step is already finished.
  useEffect(() => {
    startRef.current = nowRef.current;
  }, [stepId]);

  /* -- moving ---------------------------------------------------------- */

  const leave = useCallback(
    (completed: boolean) => {
      finishTour(completed);
      // STATED, NOT `back()`. The board is reached by `replace` out of the
      // picker, by `push` off the lobby and by a deep link with no stack at
      // all — the same three cases EXIT on the quarter panel has to survive.
      router.replace('/');
    },
    [finishTour],
  );

  const advance = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = steps[idx + 1];
    if (!next) {
      leave(true);
      return;
    }
    /**
     * THE TOUR CLOSES WHAT THE NEXT STEP DOES NOT WANT.
     *
     * Two steps deliberately leave a sheet up — the free-throw dock stays open
     * for a whole trip, and a player's tiles reopen after every tally — and the
     * step after each of those points at RB and at POSS, both of which are
     * UNDERNEATH it. The cut-out lets a tap through to whatever is topmost at
     * that point, and what is topmost there is the sheet; the scorer's first
     * tap would only dismiss it.
     *
     * `useUiStore.getState()` rather than a subscribed action, because this
     * runs inside a callback and the store is being read for a decision rather
     * than rendered from.
     */
    if (!wantsPanel(next, useUiStore.getState().panel?.kind ?? null)) {
      useUiStore.getState().reset();
    }
    goto(next.id);
  }, [steps, idx, goto, leave]);

  const back = useCallback(() => {
    const prev = steps[idx - 1];
    if (prev) goto(prev.id);
  }, [steps, idx, goto]);

  useEffect(() => {
    if (confirming) return;
    if (isDone(step.done, startRef.current, watch)) advance();
  }, [watch, step, confirming, advance]);

  /* -- a turned device moves every box without moving the board -------- */

  useEffect(() => {
    remeasure();
  }, [win.width, win.height, options.bar, panelKind, remeasure]);

  /* -- back is this platform's escape ---------------------------------- */

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirming) setConfirming(false);
      else if (idx > 0) back();
      else setConfirming(true);
      return true;
    });
    return () => sub.remove();
  }, [confirming, idx, back, setConfirming]);

  /* -- where the ring goes --------------------------------------------- */

  const wanted = targetFor(step, panelKind);
  const rect: Rect | null =
    wanted === null ? null
      // the four regions are the board's own boxes; everything else is the
      // tour's. A named control inside a panel that has not laid out yet falls
      // back to the panel, which is never wrong — the thing to tap is on it.
    : wanted === 'court' || wanted === 'sidecol' || wanted === 'rail' || wanted === 'footer' ?
      (bRects[wanted] ?? null)
    : (tRects[wanted] ?? tRects.panel ?? null);

  const onPanel = wanted === 'panel' || (!!panelKind && !!tRects.panel && rect === tRects.panel);
  // a panel takes the card radius; a board cell takes the small one
  const radius = onPanel ? m.r : m.rSm;

  useAnnounce(step.title);

  return (
    /**
     * `box-none`, AND IT IS THE WHOLE REASON THE HOLE IS LIVE.
     *
     * This view covers the window. At the default `auto` it is itself a touch
     * target wherever no child of it is one — which is precisely the cut-out —
     * and a tap landing there is dispatched to a view the board is not under,
     * so it reaches nothing at all. `Spotlight`'s four transparent bands are
     * built to do the blocking deliberately and would have nothing left to do;
     * every step the scorer has to PERFORM would be unfinishable, starting with
     * the floor.
     *
     * `box-none` says the container is not a target and its children still are,
     * which is what every layer in this file already assumes: SKIP, the card
     * and the bands take their taps, and everything else falls through to the
     * real board underneath.
     */
    <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
      {/* FIRST IN THE TREE IS FIRST IN FOCUS ORDER, which is what a scorer who
          landed here by accident is owed. */}
      <SkipButton onPress={() => setConfirming(true)} />

      <Spotlight hole={rect} radius={radius} paint={!onPanel} />

      {/* the opening step names the four regions on the board itself, which is
          the one thing no cut-out can do */}
      {step.id === 'board' && <Regions />}

      {/* the SPOT is the step's own, so the hand lands in the zone the caption
          is talking about; everywhere but the floor it is the middle of the
          control and this is null */}
      {!needsButton(step) && <Finger at={rect} spot={spotFor(step, wanted)} />}

      <Caption
        at={rect}
        title={step.title}
        step={idx + 1}
        total={steps.length}
        onBack={idx > 0 ? back : undefined}
        onNext={needsButton(step) ? advance : undefined}
      />

      {confirming && (
        <SkipConfirm onSkip={() => leave(false)} onStay={() => setConfirming(false)} />
      )}
    </View>
  );
}
