import { router } from 'expo-router';

import { TUTORIAL_COPY } from '../../constants/tutorial';
import { useAnnounce } from '../../hooks/useAnnounce';
import { stepIndex, visibleSteps } from '../../lib/tutorial';
import { useGameStore } from '../../store/gameStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * "YOU GOT AS FAR AS STEP ELEVEN. PICK IT UP, OR START AGAIN?"
 *
 * ## IT IS THE ONLY THING `tutorialLastStep` IS FOR
 *
 * The store persists whether the tour was finished and where it was left, and
 * NOTHING IS GATED ON EITHER — no verb is dark because somebody has not watched
 * a walkthrough, and the lobby's row is there whatever these say. They exist so
 * that a scorer who was interrupted at step eleven is not made to tap through
 * ten steps they have already seen, and that is the whole of it.
 *
 * ## SO IT ONLY APPEARS WHEN THERE IS SOMETHING TO RESUME
 *
 * `finish(true)` clears `lastStep` — a tour walked to the end has nothing to
 * pick up — so this is reached only after a SKIP. The lobby asks the question
 * before it starts anything; a tour that opened and then asked would have
 * already replaced the board.
 *
 * ## THE SHAPE IS THE OTHER TWO CONFIRMS'
 *
 * `PTitle`, a `Note`, two `Btn`s in a `Row` — the same object `RemoveGamePanel`
 * and `NewGamePanel` are, so a scorer does not have to read which side is which
 * twice. The affirmative is on the RIGHT as it is in both of those, and here
 * the affirmative is CARRYING ON: somebody who stopped at step eleven and came
 * back is far likelier to want the eleven back than to want to sit through them.
 * Nothing here is destructive, so neither verb takes `danger`.
 */
export function ResumeTutorialPanel() {
  const options = useGameStore((s) => s.options);
  const lastStep = useTutorialStore((s) => s.lastStep);
  const begin = useTutorialStore((s) => s.begin);
  const reset = useUiStore((s) => s.reset);

  // WHERE THAT STEP SITS IN *THIS* TOUR, not where it sat in the one they
  // walked: a setting changed since may have dropped it, and `stepIndex` is the
  // one place that question is answered.
  const tour = visibleSteps(options);
  const at = stepIndex(tour, lastStep);

  useAnnounce(TUTORIAL_COPY.resumeTitle);

  const go = (from?: string) => () => {
    reset();
    begin(from);
    router.push('/game');
  };

  return (
    <>
      <PTitle
        title={TUTORIAL_COPY.resumeTitle}
        kind={`${at + 1} ${TUTORIAL_COPY.counterSep} ${tour.length}`}
        tone="ink"
      />
      <Note>{TUTORIAL_COPY.resumeLine}</Note>
      <Row mt>
        <Btn label={TUTORIAL_COPY.resumeRestart} onPress={go()} />
        <Btn
          label={TUTORIAL_COPY.resumeKeep}
          variant="accent"
          onPress={go(lastStep ?? undefined)}
        />
      </Row>
    </>
  );
}
