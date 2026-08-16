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
  | { kind: 'fouledOut'; playerId: string }
  | { kind: 'foulDenied'; playerId: string }
  | { kind: 'endQuarter' }
  | { kind: 'endGame' }
  | { kind: 'totals' }
  | { kind: 'plays' };

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
  toast: null,

  open: (panel) => set({ panel }),
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
