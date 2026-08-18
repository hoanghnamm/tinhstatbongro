/**
 * The saved-games rules, as plain functions over plain data — the same side of
 * the line `actions.ts` and `roster.ts` are on, so `npm run check` exercises
 * the cap and the summary without AsyncStorage, React or a device.
 *
 * THE STORAGE SHAPE IS THE DESIGN HERE, and it is two keys, not one:
 *
 *   - the INDEX holds summaries only — a date, a score, a period count — and it
 *     is the only thing HOME and the GAMES list ever read.
 *   - each full game, which is a few hundred events, lives alone under
 *     `gameKey(id)` and is loaded when somebody actually opens it.
 *
 * One blob would put thirty games' events behind every render of the home
 * screen and would walk into Android's AsyncStorage row limit on the way. If
 * this ever has to scale further the answer is `expo-sqlite`, not a bigger
 * blob.
 */
import { PERIOD_LEN } from '../constants/game';
import type { GameState } from '../types';

/** Thirty nights. Past that the oldest is dropped, and its key with it. */
export const HISTORY_CAP = 30;

/** What the index holds, and all it holds. */
export interface GameSummary {
  id: string;
  endedAt: number;
  score: number;
  oppScore: number;
  /** how many periods were played, overtimes included */
  periods: number;
  /**
   * Who it was against, or `''`. OPTIONAL, and it is the one key here that is:
   * a row written before games had an opponent has none, and there is no
   * migration for the index the way `reviveGame` is one for a game. Every
   * reader falls back, so a summary from an older build simply says less.
   */
  opponent?: string;
}

/** One game's own storage key. The index is the only other one. */
export const gameKey = (id: string): string => `hooplog-game:${id}`;

/** Sortable, and unique against a second save inside the same millisecond. */
let seq = 0;
export const newGameId = (at: number = Date.now()): string =>
  'g' + at.toString(36) + (seq++).toString(36);

/**
 * The index row for a finished game.
 *
 * `periods` comes off the clock's period and the log's highest, whichever is
 * further on: a fourth quarter with nothing logged in it was still played, and
 * an overtime the scorer walked away from mid-way still happened.
 */
export function summarise(g: GameState, id: string, endedAt: number): GameSummary {
  return {
    id,
    endedAt,
    score: g.score,
    oppScore: g.oppScore,
    periods: g.events.reduce((n, e) => Math.max(n, e.period), g.period),
    opponent: g.opponent,
  };
}

/**
 * The new index, newest first, and whatever fell off the end.
 *
 * The dropped summaries are RETURNED rather than merely forgotten, because the
 * caller owes each of them a `removeItem` — an index that forgets a game while
 * its key survives is a leak that only ever grows.
 */
export function pushSummary(
  index: GameSummary[],
  s: GameSummary,
  cap: number = HISTORY_CAP,
): { index: GameSummary[]; dropped: GameSummary[] } {
  const next = [s, ...index.filter((g) => g.id !== s.id)];
  return { index: next.slice(0, cap), dropped: next.slice(cap) };
}

/** Won, lost, or neither — a draw is possible and is not a loss. */
export const resultOf = (s: GameSummary): 'W' | 'L' | 'D' =>
  s.score > s.oppScore ? 'W' : s.score < s.oppScore ? 'L' : 'D';

/** `4 QUARTERS`, `1 QUARTER`, and overtime said out loud once it exists. */
export const periodsLabel = (periods: number): string =>
  periods <= 4
    ? `${periods} QUARTER${periods === 1 ? '' : 'S'}`
    : `4 QUARTERS + ${periods - 4} OT`;

/**
 * A saved game, only ever read back. Loose on purpose: it comes off disk, it
 * may have been written by an older build, and every reader of it — the box
 * score, the play log, the season aggregate — already tolerates a missing key.
 */
export function reviveGame(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<GameState>;
  if (!Array.isArray(g.players) || !Array.isArray(g.events)) return null;
  return {
    team: g.team ?? { name: 'MY TEAM' },
    opponent: g.opponent ?? '',
    note: g.note ?? '',
    score: g.score ?? 0,
    oppScore: g.oppScore ?? 0,
    period: g.period ?? 1,
    remaining: g.remaining ?? PERIOD_LEN,
    running: false,
    ended: true,
    possessions: g.possessions ?? 0,
    players: g.players,
    events: g.events,
  };
}

/* ------------------------------------------------------------------ *
 * Dates
 * A saved game is identified by WHEN it was, so the two labels live here
 * beside the summary rather than being re-derived on each screen that
 * prints one. Both are deliberately locale-free: the app writes its own
 * month names for the same reason it writes its own numerals — so a row
 * is the same width on every device it is read on.
 * ------------------------------------------------------------------ */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const dateLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
};

export const yearLabel = (ms: number): string => String(new Date(ms).getFullYear());

export const timeLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
