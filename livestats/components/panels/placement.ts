import type { Panel } from '../../store/uiStore';

/**
 * Where each panel sits — the one source of truth for it.
 *
 * It lives in its own module rather than inside `PanelHost` because the footer
 * needs the same answer: a docked panel runs the full height of the column
 * beside the court, which is over END, so the footer gives back exactly the
 * overlap. Footer importing PanelHost would drag every panel in with it, and a
 * second hand-kept list of "which kinds dock" is how the two drift apart.
 *
 * `dock` is the placement that neither covers nor dims the court, because the
 * point of both panels that use it is seeing the floor while you tap: step 1 of
 * a shot shows the spot you just marked, and the free-throw result shows the
 * aggregated mark on the line ticking up.
 *
 * `court` panels take the court's own footprint, so the action columns and the
 * rail stay readable under the scrim and the tiles get the whole court to be
 * tapped in.
 */
export type Mode = 'dock' | 'court' | 'center' | 'wide';

export const MODE: Record<Panel['kind'], Mode> = {
  what: 'dock',
  ftResult: 'dock',
  foulKind: 'court',
  rebKind: 'court',
  who: 'court',
  assist: 'court',
  playerActions: 'court',
  subOut: 'court',
  // the clock pair wears the foul panel's shell — header, seams, tile grid —
  // so the two things tapped mid-play with a hand already on the court read the
  // same way and land in the same place
  endQuarter: 'court',
  setClock: 'court',
  // a form, not a two-way choice — neither fits the dock's one-column shape
  tripSize: 'center',
  tripShots: 'center',
  fouledOut: 'center',
  foulDenied: 'center',
  endGame: 'center',
  totals: 'wide',
  plays: 'center',
  // the three off-board panels. There is no court to dock against or cover, so
  // they are all centred dialogs — which is what they are anyway: a confirm,
  // a form, and a second confirm.
  newGame: 'center',
  editPlayer: 'center',
  removePlayer: 'center',
};

export const isDocked = (panel: Panel | null): boolean => !!panel && MODE[panel.kind] === 'dock';
