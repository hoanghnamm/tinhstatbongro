import { create } from 'zustand';

import type { FoulKindKey, Position, ShotNote, ShotType, TallyType, Zone, ZoneSide } from '../types';

/**
 * What the in-flight entry is. `made`/`miss` come from the court, the rebound
 * kinds and `ft`/`foul` from the sidebar, the tallies from a player panel.
 */
export type What = 'made' | 'miss' | 'oreb' | 'dreb' | 'ft' | 'foul' | TallyType;

/**
 * One member per panel. `PanelHost` switches on `kind` exhaustively, so a panel
 * added here without a branch there is a compile error rather than a blank
 * overlay — which is the whole reason this replaced the data-* dispatcher.
 */
export type Panel =
  | { kind: 'what' }
  | { kind: 'foulKind' }
  | { kind: 'rebKind' }
  | { kind: 'who' }
  | { kind: 'assist' }
  | { kind: 'playerActions'; playerId: string; bumped: TallyType | null }
  | { kind: 'subOut'; outId: string }
  | { kind: 'ftResult' }
  | { kind: 'tripSize' }
  | { kind: 'tripShots' }
  /**
   * WHO REPLACES A PLAYER WHO HAS JUST FOULED OUT, and while there is anybody
   * on the bench it is not a question the scorer may walk away from — see
   * `owesSub`. `fresh` says the foul that put them out is still the top of the
   * undo stack, which is the only state in which UNDO THE FOUL is an honest
   * way out of a mis-tap; reached from a dimmed rail row it is false, and the
   * only way on is the replacement itself.
   */
  | { kind: 'fouledOut'; playerId: string; fresh: boolean }
  | { kind: 'foulDenied'; playerId: string }
  | { kind: 'endQuarter' }
  | { kind: 'setClock' }
  | { kind: 'endGame' }
  /* --- off the board: the tabs use the same router --- */
  | { kind: 'newGame' }
  /** the jersey keypad — the picker's one edit, and it edits nothing else */
  | { kind: 'setNumber'; playerId: string }
  | { kind: 'removePlayer'; playerId: string }
  /** a saved game, off the GAMES list — the roster's confirm, one shelf over */
  | { kind: 'removeGame'; gameId: string }
  /**
   * The walkthrough was stopped part way through last time; carry on, or start
   * again. Asked BEFORE the tour opens, so it is a lobby panel like the three
   * above it and not something drawn over a board that has already been
   * replaced.
   */
  | { kind: 'resumeTutorial' };

export interface Trip {
  shooter: string;
  andOne: boolean;
  /** null until the attempt has been tapped either way */
  shots: (boolean | null)[];
}

export interface Toast {
  msg: string;
  bad: boolean;
  /** bumped on every toast so the same message twice still animates */
  seq: number;
}

interface UiState {
  mark: Position | null;
  zone: Zone | null;
  side: ZoneSide | null;
  shotType: ShotType | null;
  what: What | null;
  /** the only per-player selection the model has — there is no second flag */
  shooter: string | null;
  foulKind: FoulKindKey | null;
  trip: Trip | null;
  note: ShotNote | null;
  panel: Panel | null;
  /**
   * HOW MANY TIMES A PANEL HAS BEEN OPENED, and it has two readers.
   *
   * `panel` alone cannot answer "did something just open", because opening the
   * same KIND twice in a row — a player panel that reopens after every tally,
   * a second player's actions right after the first — leaves the kind exactly
   * where it was. The walkthrough has to know a tap landed, so it counts the
   * opens rather than watching the kind, and a counter is the smallest honest
   * thing that says so.
   *
   * `useLitClose` is the second reader, asking the same question backwards: a
   * panel that lights and then closes itself must NOT close whatever opened in
   * the meantime, and "has anything opened since" is this counter standing
   * still. Nothing is rendered from it either way.
   */
  opens: number;
  toast: Toast | null;

  open(panel: Panel): void;
  /** the in-flight entry, without touching the panel */
  clear(): void;
  /** clear() and close whatever is open */
  reset(): void;
  startShot(mark: Position, zone: Zone, side: ZoneSide, shotType: ShotType): void;
  setWhat(what: What | null): void;
  setShooter(id: string | null): void;
  setFoulKind(kind: FoulKindKey | null): void;
  setNote(note: ShotNote | null): void;
  setTrip(trip: Trip | null): void;
  say(msg: string, bad?: boolean): void;
  hideToast(): void;
}

const emptyEntry = {
  mark: null,
  zone: null,
  side: null,
  shotType: null,
  what: null,
  shooter: null,
  foulKind: null,
  trip: null,
  note: null,
} as const;

let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  ...emptyEntry,
  panel: null,
  opens: 0,
  toast: null,

  open: (panel) => set((s) => ({ panel, opens: s.opens + 1 })),
  clear: () => set({ ...emptyEntry }),
  reset: () => set({ ...emptyEntry, panel: null }),

  startShot: (mark, zone, side, shotType) =>
    set({ ...emptyEntry, mark, zone, side, shotType }),

  setWhat: (what) => set({ what }),
  setShooter: (shooter) => set({ shooter }),
  setFoulKind: (foulKind) => set({ foulKind }),
  setNote: (note) => set({ note }),
  setTrip: (trip) => set({ trip }),

  say: (msg, bad = false) => set({ toast: { msg, bad, seq: ++toastSeq } }),
  hideToast: () => set({ toast: null }),
}));
