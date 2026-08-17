import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * The second half of END GAME, which lives on the quarter panel beside END
 * QUARTER. Two tiles that both end something sit next to each other, so this
 * confirm is what makes the wrong one survivable — it replaced the footer's
 * arm-then-fire dance when POSS took that cell.
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
