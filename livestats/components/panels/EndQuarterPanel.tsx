import { router } from 'expo-router';

import { useAnnounce } from '../../hooks/useAnnounce';
import { mmss, periodName, periodWord } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useUiStore } from '../../store/uiStore';
import { leaveTour } from '../tutorial/leave';
import { CancelX, PHead, PRows, PTitleText, Pts, Tile } from './shell';

/**
 * The clock panel, wearing the foul panel's shell: header, 1px seams, a grid of
 * abbreviation-over-word tiles, placed over the court. It is the same kind of
 * decision as a foul kind — one tap out of a short list, made with the game in
 * front of you — so it gets the same shape rather than a dialog's.
 *
 * The title IS the period being played, so the panel names the thing it is
 * about to end and the live time sits beside it. It is the GAME'S OWN word,
 * not the literal QUARTER it used to print: a game set to halves is not playing
 * a 1ST QUARTER, and period 5 of one set to quarters is an OVERTIME rather than
 * a 5TH. `periodName` is the one place that is decided.
 *
 * ±1s lands immediately and the panel stays open, because correcting a clock is
 * rarely one tap and reopening between them is the whole cost. SET hands off to
 * the keypad, and the two that end something close.
 *
 * Two rows, written out rather than chunked, and BOTH ARE THIRDS now. The
 * bottom row was two halves — the row you must not mis-tap made the biggest
 * target on the panel — and EXIT is what cost it that. The trade is taken
 * knowingly and it is smaller than it sounds: a third of the SMALLEST court is
 * already the budget the top row's labels are cut to, so the cell is a proven
 * size, and END GAME is still only an OPENER — its confirm is what makes a
 * mis-tap survivable, not its width.
 *
 * The row reads left to right as a severity ramp: leave and come back, end a
 * period (undoable), end the game (confirmed). That order also keeps the two
 * `End` tiles adjacent, which is how they read as a pair, and leaves the
 * destructive one at the row's far edge rather than flanked by its neighbours.
 * END GAME is still the only red text on the panel.
 */
export function EndQuarterPanel() {
  const period = useGameStore((s) => s.period);
  // the regulation count is the GAME's, stamped at tip-off — see GameState
  const periods = useGameStore((s) => s.periods);
  const remaining = useGameStore((s) => s.remaining);
  const adjustClock = useGameStore((s) => s.adjustClock);
  const nextQuarter = useGameStore((s) => s.nextQuarter);
  const open = useUiStore((s) => s.open);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);
  // EXIT is the tour's way off the board as well as a scorer's; see the tile
  const tutorial = useTutorialStore((s) => s.active);

  useAnnounce(periodName(period, periods));

  return (
    <>
      <PHead>
        <PTitleText>{periodName(period, periods)}</PTitleText>
        <Pts>{mmss(remaining)}</Pts>
        <CancelX />
      </PHead>
      {/* the top row's code and caption read as one phrase — "−1s second",
          "SET the time". A third of the smallest court is about four characters
          of code and ten of caption, and neither may truncate. */}
      <PRows
        rows={[
          [
            <Tile key="dn" code="−1s" caption="Second" onPress={() => adjustClock(-1)} />,
            <Tile key="up" code="+1s" caption="Second" onPress={() => adjustClock(1)} />,
            <Tile
              key="set"
              code="Set"
              caption="The time"
              onPress={() => open({ kind: 'setClock' })}
            />,
          ],
          [
            /* EXIT LEAVES THE GAME STANDING, and that is the whole difference
               between this tile and the red one at the end of the row. Nothing
               is ended, nothing is filed and nothing is cleared: the board keeps
               its score, its log and its clock, and the lobby's CONTINUE GAME is
               the way back onto it.

               So it takes NO `tone` AND NO CONFIRM. Red would say it destroys
               something and it destroys nothing; a confirm on an act that is
               undone by walking back through the door is a question with one
               answer. The screen changing IS the confirmation, which is why it
               does not toast either.

               THE CLOCK IS DELIBERATELY NOT STOPPED. A running clock is a fact
               about the game rather than about which screen is showing — it is
               why the ticker lives in `app/_layout.tsx` and not here — so
               leaving the board credits minutes exactly as walking off to the
               TEAM tab mid-quarter always has. Stopping it here would make this
               one door behave unlike every other.

               AND IT IS THE WALKTHROUGH'S WAY OUT TOO, which is the one case
               where it is not just a route. The tour OPENS this panel and the
               cut-out is the whole sheet, so every tile on it is live — END
               GAME is guarded two tiles along for the same reason. A plain
               `replace` here left the tour running over a board that was no
               longer under it: the throwaway game still installed, the scorer's
               own board still stashed, and `pausePersist` still holding their
               NEXT game off the disk. `leaveTour` is the same two lines the
               overlay's own SKIP runs, and it lands where the tour was started
               from. */
            <Tile
              key="exit"
              code="Exit"
              caption="To lobby"
              onPress={() => {
                // THE PANEL IS CLOSED BEFORE THE ROUTE CHANGES, the way END
                // GAME does it, and here it is load-bearing rather than tidy:
                // `endQuarter` is placed over the COURT, and three of the four
                // tabs mount their own `<PanelHost />` — so a panel left open
                // in `uiStore` would try to draw itself on the lobby, over a
                // court that is not there.
                reset();
                if (tutorial) {
                  // the tour is put back before anything moves, and it decides
                  // its own destination — see above
                  leaveTour(false);
                  return;
                }
                // REPLACE, and to a STATED destination rather than `back()`:
                // the board is reached both by `replace` out of the picker and
                // by `push` off the lobby, and a deep link reaches it with no
                // stack at all. `/` is the lobby under all three.
                router.replace('/');
              }}
            />,
            <Tile
              key="qt"
              code="End"
              caption={periodWord(period, periods)}
              onPress={() => {
                nextQuarter();
                reset();
                say(periodName(period + 1, periods));
              }}
            />,
            // red, and still only an opener: END GAME keeps its confirm panel
            <Tile
              key="gm"
              code="End"
              caption="Game"
              tone="danger"
              onPress={() => open({ kind: 'endGame' })}
            />,
          ],
        ]}
      />
    </>
  );
}
