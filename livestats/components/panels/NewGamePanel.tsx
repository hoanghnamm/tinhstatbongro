import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { periodLabel } from '../../lib/format';
import { opponentLabel } from '../../lib/team';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, PSubject, PTitle, Row } from './shell';

/**
 * The one thing the home screen can do that is not survivable: a game in
 * progress is not saved anywhere else, so NEW GAME asks first.
 *
 * Deliberately the same shape and the same button order as `EndGamePanel` —
 * the safe verb on the left, the one that destroys something on the right in
 * `danger` — because the two are the same decision made from different rooms,
 * and a scorer should not have to read which side is which twice.
 *
 * THE PARAGRAPH IS GONE AND THE GAME IS DRAWN INSTEAD. It said *the game in
 * progress will be discarded*, which is the app describing a thing it could
 * simply show: `PSubject` prints the standing game the way the shelf prints a
 * finished one — who it is against, what period it is in, and the score with
 * OURS in accent. A scorer who is about to lose forty minutes of scoring reads
 * the score, not a sentence about it.
 */
export function NewGamePanel() {
  const reset = useUiStore((s) => s.reset);

  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  const opponent = useGameStore((s) => s.opponent);
  const kind = useGameStore((s) => s.kind);
  const period = useGameStore((s) => s.period);
  const periods = useGameStore((s) => s.periods);

  useAnnounce('start a new game?');

  return (
    <>
      <PTitle title="Start a new game?" />
      <PSubject
        line={kind === 'practice' ? 'Practice' : `vs ${opponentLabel(opponent)}`}
        tail={periodLabel(period, periods)}
        us={score}
        them={oppScore}
      />
      <Row>
        <Btn label="Keep playing" onPress={reset} />
        <Btn
          label="New game"
          variant="danger"
          onPress={() => {
            reset();
            // nothing is discarded here — `startGame` is what clears the game,
            // and it is one more confirmed tap away, at the end of the picker
            router.push('/start');
          }}
        />
      </Row>
    </>
  );
}
