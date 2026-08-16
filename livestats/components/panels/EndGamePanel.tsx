import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * The second half of END. The footer's first tap only arms the button; this is
 * where the game actually ends — the arm guards the mis-tap next to UNDO, this
 * guards the decision.
 */
export function EndGamePanel() {
  const endGame = useGameStore((s) => s.endGame);
  const open = useUiStore((s) => s.open);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('end the game?');

  return (
    <>
      <PTitle title="End the game?" />
      <Note>The clock stops and the final box score is shown. Undo still works afterwards.</Note>
      <Row mt>
        <Btn label="KEEP PLAYING" onPress={reset} />
        <Btn
          label="END GAME"
          variant="danger"
          onPress={() => {
            endGame();
            open({ kind: 'totals' });
          }}
        />
      </Row>
    </>
  );
}
