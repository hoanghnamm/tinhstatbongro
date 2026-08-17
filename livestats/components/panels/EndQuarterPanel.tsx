import { useAnnounce } from '../../hooks/useAnnounce';
import { mmss, ord } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PHead, PRows, PTitleText, Pts, Tile } from './shell';

/**
 * The clock panel, wearing the foul panel's shell: header, 1px seams, a grid of
 * abbreviation-over-word tiles, placed over the court. It is the same kind of
 * decision as a foul kind — one tap out of a short list, made with the game in
 * front of you — so it gets the same shape rather than a dialog's.
 *
 * The title IS the quarter being played, so the panel names the thing it is
 * about to end and the live time sits beside it.
 *
 * ±1s lands immediately and the panel stays open, because correcting a clock is
 * rarely one tap and reopening between them is the whole cost. SET hands off to
 * the keypad, and the two that end something close.
 *
 * Two rows, written out rather than chunked: the clock keys take a third of the
 * top each and the two enders take half the bottom each, which is what makes
 * the row you must not mis-tap the biggest target on the panel. END GAME is the
 * only red text on it.
 */
export function EndQuarterPanel() {
  const period = useGameStore((s) => s.period);
  const remaining = useGameStore((s) => s.remaining);
  const adjustClock = useGameStore((s) => s.adjustClock);
  const nextQuarter = useGameStore((s) => s.nextQuarter);
  const open = useUiStore((s) => s.open);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);

  useAnnounce(`${ord(period)} quarter`);

  return (
    <>
      <PHead>
        <PTitleText>{`${ord(period).toUpperCase()} QUARTER`}</PTitleText>
        <Pts>{mmss(remaining)}</Pts>
        <CancelX />
      </PHead>
      {/* the top row's code and caption read as one phrase — "−1s second",
          "SET the time". A third of the smallest court is about four characters
          of code and ten of caption, and neither may truncate. */}
      <PRows
        rows={[
          [
            <Tile key="dn" code="−1s" caption="SECOND" onPress={() => adjustClock(-1)} />,
            <Tile key="up" code="+1s" caption="SECOND" onPress={() => adjustClock(1)} />,
            <Tile
              key="set"
              code="SET"
              caption="THE TIME"
              onPress={() => open({ kind: 'setClock' })}
            />,
          ],
          [
            <Tile
              key="qt"
              code="END"
              caption="QUARTER"
              onPress={() => {
                nextQuarter();
                reset();
                say(`${ord(period + 1)} quarter`);
              }}
            />,
            // red, and still only an opener: END GAME keeps its confirm panel
            <Tile
              key="gm"
              code="END"
              caption="GAME"
              tone="danger"
              onPress={() => open({ kind: 'endGame' })}
            />,
          ],
        ]}
      />
    </>
  );
}
