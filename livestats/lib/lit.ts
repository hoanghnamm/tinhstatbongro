import type { Panel, What } from '../store/uiStore';

/**
 * A board control stays LIT for as long as the panel it opened is on screen —
 * a press is a moment, but a panel is a state, and the board has to say which
 * button put it there. It is the same `t.press` fill the finger raises, held.
 *
 * The answer cannot be read off `panel.kind` alone, which is why this is a
 * function and not a second `Record<Panel['kind'], …>` beside `MODE`:
 *
 *  - **Step 2 is shared.** `who` is the same panel for PF, FT, RB, a tally and
 *    a missed shot. What separates them is the in-flight `what`, so the entry
 *    is the second argument here.
 *  - **A tap can open a panel that opens another.** SET CLOCK and END GAME are
 *    reached from the quarter panel, so the quarter cell owns all three: the
 *    control that started the chain is the one that stays lit through it.
 *
 * Anything that opens nothing is absent by design. UNDO, POSS and the clock
 * fire and are done — there is no panel to close, so there is nothing to hold
 * them lit past the finger. Adding them here would mean inventing a state the
 * model does not have. **The SCORE is absent for a stronger reason**: it is not
 * a control any more at all. The box-score panel it opened is gone, the cell is
 * a plain readout, and `'score'` is not a light this board has.
 */
export type Lit = 'quarter' | 'pf' | 'ft' | 'rb';

export function litControl(panel: Panel | null, what: What | null): Lit | null {
  if (!panel) return null;
  switch (panel.kind) {
    // the quarter cell opened the menu these two are reached from
    case 'endQuarter':
    case 'setClock':
    case 'endGame':
      return 'quarter';

    // `foulDenied` is the foul flow refusing to land, so PF still owns it
    case 'foulKind':
    case 'foulDenied':
      return 'pf';

    case 'rebKind':
      return 'rb';

    case 'ftResult':
    case 'tripSize':
    case 'tripShots':
      return 'ft';

    // the shared step: only the entry knows whose flow this is. A shot or a
    // tally reaches it too, and neither came from one of these buttons.
    case 'who':
      return what === 'ft'
        ? 'ft'
        : what === 'foul'
          ? 'pf'
          : what === 'oreb' || what === 'dreb'
            ? 'rb'
            : null;

    default:
      return null;
  }
}

/**
 * The rail's version of the same rule: whose row opened what is on screen.
 *
 * It is deliberately NOT the shooter. `ui.shooter` is the in-flight entry's
 * pick and already paints the row accent; this is the row whose own panel is
 * open, which the rail never marked at all — you tapped a player, the panel
 * covered the court, and the column behind it gave no sign of which one.
 */
export function litPlayerId(panel: Panel | null): string | null {
  if (!panel) return null;
  switch (panel.kind) {
    case 'playerActions':
    case 'fouledOut':
      return panel.playerId;
    case 'subOut':
      return panel.outId;
    default:
      return null;
  }
}
