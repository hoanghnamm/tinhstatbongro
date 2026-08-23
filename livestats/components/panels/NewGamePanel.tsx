import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * The one thing the home screen can do that is not survivable: a game in
 * progress is not saved anywhere else, so NEW GAME asks first.
 *
 * Deliberately the same shape and the same button order as `EndGamePanel` —
 * the safe verb on the left, the one that destroys something on the right in
 * `danger` — because the two are the same decision made from different rooms,
 * and a scorer should not have to read which side is which twice.
 */
export function NewGamePanel() {
  const reset = useUiStore((s) => s.reset);

  useAnnounce('start a new game?');

  return (
    <>
      <PTitle title="Start a new game?" />
      <Note>The game in progress will be discarded.</Note>
      <Row mt>
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
