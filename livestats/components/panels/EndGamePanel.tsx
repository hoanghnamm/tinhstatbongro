import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { currentGame, useGameStore } from '../../store/gameStore';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * The second half of END GAME, which lives on the quarter panel beside END
 * QUARTER. Two tiles that both end something sit next to each other, so this
 * confirm is what makes the wrong one survivable — it replaced the footer's
 * arm-then-fire dance when POSS took that cell.
 *
 * IT IS ALSO THE ONE PLACE A GAME IS SAVED. `saveGame` runs here, once, after
 * `endGame` has stamped `ended` and before the stats screen opens — so the copy
 * on the shelf is the finished game and not a snapshot of it mid-fourth. The
 * board keeps its own state afterwards: NEW GAME is what clears that, and it
 * cannot reach the saved copy.
 */
export function EndGamePanel() {
  const endGame = useGameStore((s) => s.endGame);
  const saveGame = useHistoryStore((s) => s.saveGame);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('end the game?');

  return (
    <>
      <PTitle title="End the game?" />
      <Note>
        The clock stops, the game is saved to GAMES, and the full stats screen opens — the team
        line, the box score, the shot chart and the zones, whole game or quarter by quarter. Undo
        still works afterwards.
      </Note>
      <Row mt>
        <Btn label="KEEP PLAYING" onPress={reset} />
        <Btn
          label="END GAME"
          variant="danger"
          onPress={() => {
            endGame();
            // read AFTER endGame, so `ended` is true in the copy that is filed
            saveGame(currentGame());
            // the panel is closed BEFORE the route changes: it belongs to the
            // board, and a modal left open under a pushed screen is what the
            // scorer comes back to when they tap BACK
            reset();
            router.push('/stats');
          }}
        />
      </Row>
    </>
  );
}
