import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { currentGame, useGameStore } from '../../store/gameStore';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PGrid, PHead, PTitleText, Pts, Tile } from './shell';

/**
 * The second half of END GAME, which lives on the quarter panel beside END
 * QUARTER — and it wears the REBOUND panel's shell, because it is reached from
 * a panel that already wears it. A centred dialog with a paragraph in it was a
 * different surface appearing in the middle of a chain that had been tiles all
 * the way down; two big tiles over the court is the same tap the scorer just
 * made, one step on.
 *
 * THE PROSE WENT WITH THE DIALOG. It said the clock stops, the game is saved
 * and the stats screen opens — three things the captions now say in four words
 * between them, and the third of them is on screen a second later anyway. The
 * header carries the SCORELINE instead, which is the one fact worth checking
 * before a game is filed under it, exactly as the quarter panel's header
 * carries the live clock.
 *
 * IT IS ALSO THE ONE PLACE A GAME IS SAVED. `saveGame` runs here, once, after
 * `endGame` has stamped `ended` and before the stats screen opens — so the copy
 * on the shelf is the finished game and not a snapshot of it mid-fourth. The
 * board keeps its own state afterwards: NEW GAME is what clears that, and it
 * cannot reach the saved copy.
 *
 * AND IT OPENS THE SAVED GAME, NOT THE LIVE ONE. `saveGame` hands back the id
 * it filed under, so END lands on `history/[id]` — the same page the MATCHES
 * shelf opens, reading the same copy off disk. A second screen showing the same
 * hundred numbers one second after the game was filed is the one that drifts,
 * and there is nothing on `/stats` this page does not print.
 *
 * IT REPLACES THE BOARD RATHER THAN PUSHING OVER IT, which is the whole of the
 * back button's behaviour: the game is over, so there is nothing to go back TO,
 * and the arrow in the header falls through to the tab group — the LOBBY.
 */
export function EndGamePanel() {
  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  const endGame = useGameStore((s) => s.endGame);
  const saveGame = useHistoryStore((s) => s.saveGame);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('end the game?');

  return (
    <>
      <PHead>
        <PTitleText>END GAME?</PTitleText>
        <Pts>{`${score} : ${oppScore}`}</Pts>
        <CancelX />
      </PHead>
      <PGrid columns={2}>
        <Tile key="keep" code="KEEP" caption="PLAYING" big onPress={reset} />
        <Tile
          key="end"
          code="END"
          caption="SAVE + STATS"
          big
          tone="danger"
          onPress={() => {
            endGame();
            // read AFTER endGame, so `ended` is true in the copy that is filed
            const id = saveGame(currentGame());
            // the panel is closed BEFORE the route changes: it belongs to the
            // board, and a modal left open under a pushed screen is what the
            // scorer comes back to when they tap BACK
            reset();
            // REPLACE, and straight to the SAVED game rather than to `/stats`:
            // the game is on the shelf now, so the shelf's own page is where
            // its full line lives — and replacing the board with it means the
            // header's back arrow lands on the LOBBY, which is where a scorer
            // whose game is over is going anyway.
            router.replace(`/history/${id}`);
          }}
        />
      </PGrid>
    </>
  );
}
