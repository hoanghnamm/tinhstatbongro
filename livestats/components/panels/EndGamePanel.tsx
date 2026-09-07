import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { TUTORIAL_COPY } from '../../constants/tutorial';
import { currentGame, useGameStore } from '../../store/gameStore';
import { useBillingStore } from '../../store/billingStore';
import { useHistoryStore } from '../../store/historyStore';
import { useTutorialStore } from '../../store/tutorialStore';
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
  /**
   * THE FREE GAME IS SPENT HERE, and this is the only call site.
   *
   * The trial is one game that reached the SHELF rather than one that tipped
   * off, so the deduction sits beside the thing that files it. A scorer who
   * starts a game and walks away has not used anything — there is no box
   * score, no shelf row and nothing to export — and charging them for the
   * mis-tap would be charging them for the thing they came to try.
   */
  const useTrial = useBillingStore((s) => s.useTrial);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);
  /**
   * THE WALKTHROUGH REACHES THIS PANEL, AND NOTHING IT DOES MAY LEAVE THE
   * SESSION.
   *
   * END GAME sits on the quarter panel, and the tour opens the quarter panel —
   * so a scorer two minutes into a walkthrough can be one tap from filing a
   * game that does not exist, spending the one free game they came to try, and
   * being dropped on a saved-game page with the tour still running underneath.
   *
   * The guard is here rather than in the tour because this is the file that
   * knows what END GAME costs, and it skips ALL FOUR things this tile does —
   * the stamp, the save, the trial and the route. Stamping `ended` is the one
   * that looks harmless and is not: every control on the board tests it, so a
   * tour that ended its own game would go on running over a board where
   * nothing answers a tap.
   */
  const tutorial = useTutorialStore((s) => s.active);

  useAnnounce('end the game?');

  return (
    <>
      <PHead>
        <PTitleText>End game?</PTitleText>
        <Pts>{`${score} : ${oppScore}`}</Pts>
        <CancelX />
      </PHead>
      <PGrid columns={2}>
        <Tile key="keep" code="Keep" caption="Playing" big onPress={reset} />
        <Tile
          key="end"
          code="End"
          caption="Save + stats"
          big
          tone="danger"
          onPress={() => {
            // BEFORE `endGame()`, NOT AFTER IT. Stamping `ended` would leave
            // the walkthrough on a board where every control is a no-op — the
            // three keys, the opponent's buttons, POSS and the period cell all
            // test it — which is a scorer trapped mid-tour with nothing that
            // answers a tap.
            if (tutorial) {
              reset();
              say(TUTORIAL_COPY.notNow);
              return;
            }
            endGame();
            // read AFTER endGame, so `ended` is true in the copy that is filed
            const id = saveGame(currentGame());
            // AFTER the save, for the same reason `id` is read after
            // `endGame`: the trial is spent on a game that is actually on the
            // shelf, so nothing is deducted until one is.
            useTrial();
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
