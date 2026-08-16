import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PERIOD_LEN, seedRoster } from '../constants/game';
import { DEFAULT_OPTIONS, type Options } from '../constants/options';
import * as A from '../lib/actions';
import type {
  FoulKindKey,
  FoulOutcome,
  GameState,
  Position,
  ShotNote,
  ShotType,
  TallyType,
} from '../types';

/**
 * The undo stack lives at module scope, NOT in the store: a snapshot is pushed
 * before every mutation, and nothing on screen depends on it, so putting it in
 * state would repaint the board 80 times a game for no reason.
 */
const undoStack: string[] = [];
const UNDO_CAP = 80;

/** What a snapshot covers. The clock is deliberately outside it — see undo(). */
type Snapshot = Pick<GameState, 'score' | 'oppScore' | 'players' | 'events'>;

export interface GameStore extends GameState {
  options: Options;

  recordShot(
    playerId: string,
    position: Position,
    shotType: ShotType,
    made: boolean,
    assistId: string | null,
    shotNote: ShotNote | null,
  ): void;
  recordOppPoint(points: number): void;
  recordFreeThrowTrip(playerId: string, results: boolean[], andOne: boolean): void;
  recordRebound(playerId: string, position: Position | null, kind: 'offensive' | 'defensive'): void;
  recordTally(playerId: string, position: Position | null, type: TallyType): void;
  recordFoul(playerId: string, position: Position | null, kindKey: FoulKindKey): FoulOutcome;
  substitute(outId: string, inId: string): void;

  undo(): void;
  setRunning(on: boolean): void;
  /** the ticker's only entry point: advance the game clock by whole seconds */
  tick(seconds: number): void;
  adjustClock(deltaSeconds: number): void;
  resetClock(): void;
  nextQuarter(): void;
  endGame(): void;
  setOption<K extends keyof Options>(key: K, value: Options[K]): void;
}

const freshGame = (): GameState => ({
  team: { name: 'MY TEAM' },
  score: 0,
  oppScore: 0,
  period: 1,
  remaining: PERIOD_LEN,
  running: false,
  ended: false,
  players: seedRoster(),
  events: [],
});

/** The state is plain JSON by construction, which is what makes snapshots cheap. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The clock writes state once a second, and persist saves on every write. A
 * trailing debounce turns a quarter's 600 disk writes into about 300ms of work;
 * `flushPersist()` on background is what makes losing the last two seconds
 * impossible rather than merely unlikely.
 */
let pendingWrite: { key: string; value: string } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function flushWrite(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const w = pendingWrite;
  pendingWrite = null;
  if (w) void AsyncStorage.setItem(w.key, w.value);
}

export const flushPersist = flushWrite;

const debouncedStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => {
    pendingWrite = { key, value };
    if (!writeTimer) writeTimer = setTimeout(flushWrite, 2000);
  },
  removeItem: (key: string) => {
    pendingWrite = null;
    return AsyncStorage.removeItem(key);
  },
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      /** Deep-copy, mutate, publish. New object identities are what React reads. */
      const edit = <T,>(fn: (g: GameState) => T, snapshot = true): T => {
        const s = get();
        if (snapshot) {
          undoStack.push(
            JSON.stringify({
              score: s.score, oppScore: s.oppScore, players: s.players, events: s.events,
            } satisfies Snapshot),
          );
          if (undoStack.length > UNDO_CAP) undoStack.shift();
        }
        const g: GameState = clone({
          team: s.team, score: s.score, oppScore: s.oppScore, period: s.period,
          remaining: s.remaining, running: s.running, ended: s.ended,
          players: s.players, events: s.events,
        });
        const out = fn(g);
        set(g);
        return out;
      };

      return {
        ...freshGame(),
        options: { ...DEFAULT_OPTIONS },

        recordShot: (playerId, position, shotType, made, assistId, shotNote) =>
          edit((g) => A.recordShot(g, playerId, position, shotType, made, assistId, shotNote)),

        recordOppPoint: (points) => edit((g) => A.recordOppPoint(g, points)),

        recordFreeThrowTrip: (playerId, results, andOne) =>
          edit((g) => A.recordFreeThrowTrip(g, playerId, results, andOne)),

        recordRebound: (playerId, position, kind) =>
          edit((g) => A.recordRebound(g, playerId, position, kind)),

        recordTally: (playerId, position, type) => edit((g) => A.recordTally(g, playerId, position, type)),

        recordFoul: (playerId, position, kindKey) => {
          const outcome = edit((g) => A.recordFoul(g, playerId, position, kindKey));
          // a denied foul changed nothing, so its snapshot would be a dead undo step
          if (outcome === 'denied') undoStack.pop();
          return outcome;
        },

        substitute: (outId, inId) => edit((g) => A.substitute(g, outId, inId)),

        undo: () => {
          const raw = undoStack.pop();
          if (!raw) return;
          const prev = JSON.parse(raw) as Snapshot;
          const s = get();
          // minutes come from the game clock, not from the action being undone.
          // Rewinding a basket must not rewind time already played.
          const played = new Map(s.players.map((p) => [p.id, p.stats.secondsPlayed]));
          const players = prev.players.map((p) => ({
            ...p,
            stats: { ...p.stats, secondsPlayed: played.get(p.id) ?? p.stats.secondsPlayed },
          }));
          set({
            score: prev.score,
            oppScore: prev.oppScore,
            players,
            events: prev.events,
            ended: false,
          });
        },

        setRunning: (on) => set({ running: on && get().remaining > 0 && !get().ended }),

        // In place on purpose, and the one action that does not clone. Every
        // other stat changes on a tap; secondsPlayed changes 600 times a
        // quarter, and giving the roster a new identity each second would
        // repaint the rail for a number the rail does not even show.
        tick: (seconds) => {
          const s = get();
          A.tickSeconds(s, seconds);
          set({ remaining: s.remaining, running: s.running && s.remaining > 0 });
        },

        adjustClock: (deltaSeconds) =>
          set({ remaining: Math.max(0, get().remaining + deltaSeconds) }),

        resetClock: () => set({ running: false, remaining: PERIOD_LEN }),

        nextQuarter: () =>
          set({ running: false, period: get().period + 1, remaining: PERIOD_LEN }),

        endGame: () => set({ running: false, ended: true }),

        setOption: (key, value) => set({ options: { ...get().options, [key]: value } }),
      };
    },
    {
      name: 'livestats-game',
      storage: createJSONStorage(() => debouncedStorage),
      // the undo stack is not persisted: it is a session's worth of "oops",
      // and rehydrating 80 deep copies would cost more than it is worth
      partialize: (s) => ({
        team: s.team, score: s.score, oppScore: s.oppScore, period: s.period,
        remaining: s.remaining, ended: s.ended, players: s.players,
        events: s.events, options: s.options,
      }),
      onRehydrateStorage: () => (s) => {
        // a game restored from disk is stopped, whatever it was doing when the
        // OS killed it — the seconds since then were not played
        if (s) s.running = false;
      },
    },
  ),
);

export const undoDepth = (): number => undoStack.length;
