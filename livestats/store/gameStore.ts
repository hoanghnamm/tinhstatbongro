import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PERIOD_LEN, REG_PERIODS, seedRoster } from '../constants/game';
import { buildPlayers } from '../lib/roster';
import { DEFAULT_OPTIONS, type Options } from '../constants/options';
import { DEFAULT_TEAM, cleanCompetition, cleanNote, cleanOpponent } from '../lib/team';
import * as A from '../lib/actions';
import type {
  FoulKindKey,
  FoulOutcome,
  GameState,
  MatchInfo,
  Player,
  Position,
  RosterPlayer,
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

/**
 * What a snapshot covers.
 *
 * The clock is deliberately outside the fixed part — see undo(). `period` and
 * `remaining` are the exception and they are OPTIONAL for exactly that reason:
 * only a mutation whose damage IS the clock puts them in, which today is
 * `nextQuarter` and nothing else. A snapshot pushed by a basket must not carry
 * a time, or undoing that basket a minute later would wind the game clock back
 * to when it was scored.
 */
type Snapshot = Pick<
  GameState,
  'score' | 'oppScore' | 'possessions' | 'timeouts' | 'players' | 'events'
> & {
  period?: number;
  remaining?: number;
};

export interface GameStore extends GameState {
  options: Options;

  /**
   * Tip-off. The roster is copied into fresh zeroed `Player`s, the five picked
   * ids start and everyone else sits, and score, clock, period, events and the
   * undo stack all go back to nothing. It does not go through `edit()`:
   * starting a game is not a stat to be undone.
   *
   * It is the ONE writer that crosses from the durable half of the app into a
   * game, and `teamName` is the second thing it carries across. A game records
   * the name it was PLAYED under, the same way it records the jersey a player
   * wore that night — rename the club in March and February's box score still
   * says who it was. The crest and the coaches do not cross: they are true of
   * the club today, not of a game that is already over.
   *
   * `match` comes the other way — the kind, the competition, the opponent and
   * the note are typed on the picker and belong to this game alone, so there is
   * nowhere else for them to live. It is ONE argument because it is one answer,
   * and every field of it may be empty: a practice against nobody, noted as
   * nothing, is an ordinary Tuesday.
   */
  startGame(
    roster: RosterPlayer[],
    starterIds: string[],
    teamName: string,
    match?: Partial<MatchInfo>,
  ): void;

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
  /**
   * False when it refused: a fouled-out player may not be put back in the
   * lineup. See `lib/actions.ts` — the rule is there, not in the pickers.
   */
  substitute(outId: string, inId: string): boolean;
  /** the footer's POSS half, and the only writer of `possessions` */
  addPossession(): void;
  /** the footer's TIMEOUT cell, and the only writer of `timeouts` */
  addTimeout(): void;

  undo(): void;
  setRunning(on: boolean): void;
  /** the ticker's only entry point: advance the game clock by whole seconds */
  tick(seconds: number): void;
  adjustClock(deltaSeconds: number): void;
  /** an exact time off the keypad — see setClock() for why it stops the clock */
  setClock(seconds: number): void;
  resetClock(): void;
  nextQuarter(): void;
  endGame(): void;
  setOption<K extends keyof Options>(key: K, value: Options[K]): void;
}

const freshGame = (
  players: Player[] = seedRoster(),
  teamName: string = DEFAULT_TEAM.name,
  match: Partial<MatchInfo> = {},
  // THE RULES OF THE GAME ARE STAMPED HERE AND READ OFF THE GAME EVER AFTER.
  // They come from `options` at the one call site that has them — `startGame` —
  // and default to four tens for the board a fresh install opens on, which has
  // never been through the picker. See `GameState.periods`.
  rules: { periods: number; periodLen: number } = {
    periods: REG_PERIODS,
    periodLen: PERIOD_LEN,
  },
): GameState => ({
  team: { name: teamName },
  // a board that has never been through the picker is a practice, because
  // nothing has been filed and an unnamed OFFICIAL game is the one state the
  // picker refuses to create
  kind: match.kind ?? 'practice',
  competition: match.kind === 'official' ? cleanCompetition(match.competition ?? '') : '',
  opponent: cleanOpponent(match.opponent ?? ''),
  note: cleanNote(match.note ?? ''),
  score: 0,
  oppScore: 0,
  periods: rules.periods,
  periodLen: rules.periodLen,
  period: 1,
  remaining: rules.periodLen,
  running: false,
  ended: false,
  possessions: 0,
  timeouts: 0,
  players,
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

/**
 * THE ONE THING THAT CAN STOP THE BOARD REACHING THE DISK, and the walkthrough
 * is its only caller.
 *
 * `components/tutorial/` runs the tour on the REAL board against a throwaway
 * game, which means for two minutes this store holds a game that must never be
 * remembered. Suppressing the WRITE rather than cleaning up afterwards is what
 * makes that safe in the case cleanup cannot reach: the OS killing the app
 * mid-tour leaves the scorer's own board on disk exactly as it was, because it
 * was never overwritten. See `store/tutorialStore.ts`, which also stashes the
 * board it replaced and puts it back.
 *
 * A paused write is DROPPED, not queued — the whole point is that the tour's
 * game has nothing to say to the disk, and flushing it later would say it.
 */
let persistPaused = false;

export function pausePersist(on: boolean): void {
  persistPaused = on;
  // anything already waiting when the tour begins belongs to the board that is
  // being stashed, and it is on its way to disk as the same value it already
  // holds; anything waiting when it ends belongs to nothing
  if (on) {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    pendingWrite = null;
  }
}

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
    if (persistPaused) return;
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
      /**
       * Deep-copy, mutate, publish. New object identities are what React reads.
       *
       * `clock` widens the snapshot to the period and the time on it, and it is
       * for the mutations that MOVE the clock rather than merely happen while it
       * runs — one of them, today. Everything else leaves the clock out on
       * purpose; see undo().
       */
      const edit = <T,>(fn: (g: GameState) => T, clock = false): T => {
        const s = get();
        undoStack.push(
          JSON.stringify({
            score: s.score, oppScore: s.oppScore,
            possessions: s.possessions, timeouts: s.timeouts,
            players: s.players, events: s.events,
            ...(clock ? { period: s.period, remaining: s.remaining } : null),
          } satisfies Snapshot),
        );
        if (undoStack.length > UNDO_CAP) undoStack.shift();
        const g: GameState = clone({
          team: s.team, kind: s.kind, competition: s.competition,
          opponent: s.opponent, note: s.note,
          score: s.score, oppScore: s.oppScore,
          // the rules of the night ride along with it: `nextPeriod` reads
          // `periodLen` off the game it is handed, not off a constant
          periods: s.periods, periodLen: s.periodLen,
          period: s.period,
          remaining: s.remaining, running: s.running, ended: s.ended,
          possessions: s.possessions, timeouts: s.timeouts,
          players: s.players, events: s.events,
        });
        const out = fn(g);
        set(g);
        return out;
      };

      return {
        ...freshGame(),
        options: { ...DEFAULT_OPTIONS },

        startGame: (roster, starterIds, teamName, match = {}) => {
          // a new game's undo history is empty, not the last game's
          undoStack.length = 0;
          // THE ONE PLACE THE SETTINGS CROSS INTO A GAME, and they cross the
          // way the club's name does: copied once, at tip-off, and never read
          // back. A game already on the board or already on the shelf does not
          // hear that the scorer has switched to halves.
          const { periods, periodLen } = get().options;
          set(
            freshGame(buildPlayers(roster, starterIds), teamName, match, {
              periods,
              periodLen,
            }),
          );
        },

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

        substitute: (outId, inId) => {
          const done = edit((g) => A.substitute(g, outId, inId));
          // a refused substitution changed nothing, so its snapshot would be a
          // dead undo step — the same trade a denied foul makes above
          if (!done) undoStack.pop();
          return done;
        },

        addPossession: () => edit((g) => A.addPossession(g, 1)),

        addTimeout: () => edit((g) => A.addTimeout(g, 1)),

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
            possessions: prev.possessions,
            timeouts: prev.timeouts,
            players,
            events: prev.events,
            ended: false,
            // the clock comes back ONLY when the action being undone was the one
            // that moved it — a snapshot without a period is a basket's, and a
            // basket does not own the time that has run since. Coming back into
            // a quarter through UNDO never restarts it: the scorer taps the
            // clock when play does.
            ...(prev.period !== undefined
              ? { period: prev.period, remaining: prev.remaining ?? s.remaining, running: false }
              : null),
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

        // A typed time stops the clock, which ±1s does not: nudging a second is
        // a correction made while play is dead anyway, but typing a whole time
        // means the referee has just handed you one, and running the difference
        // off between the tap and the restart is exactly the error being fixed.
        setClock: (seconds) => set({ running: false, remaining: Math.max(0, Math.floor(seconds)) }),

        // No button calls this any more — the quarter panel's FULL RESET tile
        // was cut so the two enders could take half the row each, and SET
        // reaches 10:00 like any other time. Kept because `nextQuarter` is the
        // only other thing that puts a whole period back on the clock, and a
        // reset that is not an advance has nowhere else to live.
        resetClock: () => set({ running: false, remaining: get().periodLen }),

        // THE ONE CLOCK ACTION THAT IS UNDOABLE, and the only caller that asks
        // `edit` for a clock snapshot. A quarter is ended once a quarter, from a
        // tile sat next to END GAME, and SET can put 10:00 back but nothing else
        // can put the QUARTER back — so this one is worth a step on the stack
        // where ±1s and the keypad, both of which are corrections already, are
        // not.
        nextQuarter: () => edit((g) => A.nextPeriod(g), true),

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
        team: s.team, kind: s.kind, competition: s.competition,
        opponent: s.opponent, note: s.note,
        score: s.score, oppScore: s.oppScore,
        periods: s.periods, periodLen: s.periodLen,
        period: s.period,
        remaining: s.remaining, ended: s.ended,
        possessions: s.possessions, timeouts: s.timeouts,
        players: s.players, events: s.events, options: s.options,
      }),
      onRehydrateStorage: () => (s) => {
        if (!s) return;
        // a game restored from disk is stopped, whatever it was doing when the
        // OS killed it — the seconds since then were not played
        s.running = false;
        // a live game persisted before the two kinds existed keeps the reading
        // the shelf gives every game of that vintage: it was official
        s.kind = s.kind === 'practice' ? 'practice' : 'official';
        s.competition = s.competition ?? '';
        // a live game persisted before the clock was settable was played to the
        // board's hardcoded four tens — the same reading `reviveGame` gives a
        // saved one, and for the same reason: its quarter splits are arithmetic
        // over the length, so any other guess re-slices a game already played
        s.periods = s.periods ?? REG_PERIODS;
        s.periodLen = s.periodLen ?? PERIOD_LEN;
        // a live game persisted before the footer counted them took none — the
        // same reading `reviveGame` gives a saved one
        s.timeouts = s.timeouts ?? 0;
        // a build from before the skin switcher was cut persisted a stray
        // option. Nothing reads it, but naming the ones that are left is what
        // keeps it from outliving the update in storage too.
        const {
          periods, periodLen, ft, tap, assist, bar, labels, dotMade, dotMiss, dotFt,
          poss, board,
        } = s.options;
        s.options = {
          // added after builds shipped, like `labels` below: the default rather
          // than an undefined that would put NaN on the clock
          periods: periods ?? DEFAULT_OPTIONS.periods,
          periodLen: periodLen ?? DEFAULT_OPTIONS.periodLen,
          ft: ft ?? DEFAULT_OPTIONS.ft,
          tap: tap ?? DEFAULT_OPTIONS.tap,
          assist: assist ?? DEFAULT_OPTIONS.assist,
          bar: bar ?? DEFAULT_OPTIONS.bar,
          // added after builds shipped: a game persisted without it takes the
          // default rather than rendering a tile with no label at all
          labels: labels ?? DEFAULT_OPTIONS.labels,
          dotMade: dotMade ?? DEFAULT_OPTIONS.dotMade,
          dotMiss: dotMiss ?? DEFAULT_OPTIONS.dotMiss,
          dotFt: dotFt ?? DEFAULT_OPTIONS.dotFt,
          // a board persisted before the footer's fourth cell was a timeout
          // count keeps the quieter half of it: the cell whole, the possession
          // tap not put back under a scorer who never asked for it
          poss: poss ?? DEFAULT_OPTIONS.poss,
          // and the same for the board's own skin, which arrived last of all
          board: board ?? DEFAULT_OPTIONS.board,
        };
      },
    },
  ),
);

export const undoDepth = (): number => undoStack.length;

/**
 * A WHOLE GAME, PUT ON THE BOARD, AND THE WALKTHROUGH IS ITS ONLY CALLER.
 *
 * It is deliberately NOT on the `GameStore` interface. Every action there is a
 * thing a scorer does; this is a thing done TO the board, twice, by the tour —
 * once to install its throwaway game and once to put back the board it
 * replaced. Naming it out here keeps it off the surface every screen reads and
 * makes it findable by exactly the search that should find it.
 *
 * It clears the undo stack for `startGame`'s reason: a board's undo history
 * belongs to the game standing on it, and a stack left over from another one
 * would rewind this board into a state it was never in.
 */
export function installGame(g: GameState): void {
  undoStack.length = 0;
  useGameStore.setState({ ...g });
}

/**
 * The GAME, without the store's machinery around it.
 *
 * `getState()` hands back the actions and the options as well, and both would
 * be written to disk by a `JSON.stringify` that does not know the difference —
 * the options are a preference and not a fact about the game, and a function
 * serialises to nothing at all. Naming the seventeen keys is what keeps a saved
 * game the same shape as the one every reader here already takes.
 */
export const currentGame = (): GameState => {
  const s = useGameStore.getState();
  return {
    team: s.team,
    kind: s.kind,
    competition: s.competition,
    opponent: s.opponent,
    note: s.note,
    score: s.score,
    oppScore: s.oppScore,
    periods: s.periods,
    periodLen: s.periodLen,
    period: s.period,
    remaining: s.remaining,
    running: s.running,
    ended: s.ended,
    possessions: s.possessions,
    timeouts: s.timeouts,
    players: s.players,
    events: s.events,
  };
};
