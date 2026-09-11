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
import { PERIOD_LEN, REG_PERIODS } from '../constants/game';
import { cleanCompetition, competitionKey } from './team';
import type { GameKind, GameState } from '../types';

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
  /**
   * PRACTICE or OFFICIAL. OPTIONAL for the same reason the opponent is: a row
   * written before the two kinds existed has none, and there is no migration
   * for the index. Read it through `summaryKind`, never raw — the default is
   * OFFICIAL, because that is what the season already counted those games as.
   */
  kind?: GameKind;
  /** the competition an official game was filed under, or `''` */
  competition?: string;
  /**
   * WHICH TEAM OF THE CLUB PLAYED IT. OPTIONAL, and it is optional for exactly
   * the reason `kind` is: a row written before the club had teams has none, and
   * there is no migration for the index. Read it through `squadIdOf`, never
   * raw — the default is the FIRST team, because that is the team the club was
   * on the night, and a row that answered "no team" would drop off every
   * screen at once.
   */
  squadId?: string;
}

/** The kind a row was written with, or the one every older row already was. */
export const summaryKind = (s: GameSummary): GameKind =>
  s.kind === 'practice' ? 'practice' : 'official';

/**
 * The competitions the shelf already knows about, best spelling first.
 *
 * This is what the picker suggests, and it reads the INDEX — thirty summaries
 * that are already in memory — rather than opening a single game. The order is
 * the shelf's own, newest first, so the competition being played this month is
 * the first thing offered; and the SPELLING kept is the newest one, because a
 * scorer who fixed their own typo last week meant it.
 */
export function competitionsIn(index: GameSummary[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of index) {
    if (summaryKind(s) !== 'official') continue;
    const name = cleanCompetition(s.competition ?? '');
    if (!name) continue;
    const key = competitionKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
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
    kind: g.kind,
    competition: g.competition,
    squadId: g.squadId,
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

/**
 * Won or lost, on `>=` — and it has NO CALLER LEFT.
 *
 * It was the shelf's rule and the delete confirm's, and both moved to
 * `outcomeOf` below when it turned out that `>=` calls `0 — 0` a WIN, which is
 * what every unscored practice on the shelf is. It is left standing rather than
 * deleted, the way `app/stats.tsx` is: the two-way answer is a real question
 * somebody may ask again — a scoreline that must resolve one way or the other —
 * and reviving it should be a decision rather than an archaeology exercise.
 * `npm run check` still holds it to `>=` so it cannot quietly drift into being
 * a second, disagreeing copy of `outcomeOf`.
 */
export const resultOf = (s: GameSummary): 'W' | 'L' =>
  s.score >= s.oppScore ? 'W' : 'L';

/*
 * THERE IS NO `periodsLabel` ANY MORE. `4 QUARTERS` was the tail of both the
 * shelf row's subtitle and the saved game's, and a game that went the normal
 * distance is every game — a label that reads the same on twenty-nine rows out
 * of thirty is not telling anybody anything. `periods` is still on the summary,
 * so the day something wants to say `+ 1 OT` the number is there.
 */

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
    team: g.team ?? { name: 'My Team' },
    // A GAME FROM BEFORE THE CLUB HAD TEAMS carries no id, and `squadIdOf`
    // reads that empty string as the FIRST team rather than as none — see
    // `lib/squads.ts`. It is left empty here rather than filled in, because
    // guessing an id into a saved record is how two builds end up disagreeing
    // about which team a night belonged to.
    squadId: g.squadId ?? '',
    squadName: g.squadName ?? '',
    // A GAME FROM BEFORE THE TWO KINDS IS OFFICIAL, deliberately: the season
    // counted it when it was saved, and a migration that quietly dropped a
    // month of games out of the season line would be the worse surprise.
    kind: g.kind === 'practice' ? 'practice' : 'official',
    competition: g.competition ?? '',
    opponent: g.opponent ?? '',
    note: g.note ?? '',
    score: g.score ?? 0,
    oppScore: g.oppScore ?? 0,
    // A GAME FROM BEFORE THE CLOCK WAS SETTABLE WAS PLAYED 4 × 10:00, which is
    // what the board was hardcoded to. Every quarter split on this game is
    // arithmetic over the length, so guessing anything else here would re-slice
    // a night that is already over.
    periods: g.periods ?? REG_PERIODS,
    periodLen: g.periodLen ?? PERIOD_LEN,
    period: g.period ?? 1,
    remaining: g.remaining ?? PERIOD_LEN,
    running: false,
    ended: true,
    possessions: g.possessions ?? 0,
    // A GAME FROM BEFORE THE FOOTER COUNTED TIMEOUTS TOOK NONE, which is the
    // only honest reading: nothing counted them, so there is nothing to report
    timeouts: g.timeouts ?? 0,
    players: g.players,
    events: g.events,
  };
}

/* ------------------------------------------------------------------ *
 * Dates
 * A saved game is identified by WHEN it was, so the two labels live here
 * beside the summary rather than being re-derived on each screen that prints
 * one. Both are deliberately locale-free — day first, zero-padded, so a row is
 * the same width on every device it is read on.
 *
 * BOTH ARE DIGITS NOW, and the spelled month went with the kick-off TIME. The
 * shelf row's title is the competition, so the date dropped to its subtitle
 * where it is scanned rather than read; and the hour a game happened to be
 * saved at is not a fact anybody looks a game up by.
 * ------------------------------------------------------------------ */

const dd = (n: number): string => String(n).padStart(2, '0');

/** `19/08/2026` — the saved game's own line. */
export const numDateLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** `19/08` — the shelf, where thirty rows are one season and the year is noise. */
export const dayMonthLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
};

/**
 * WON, LOST, OR NEITHER — and the third answer is why this is not `resultOf`.
 *
 * `resultOf` is a two-way split and it has to stay one: its caller is the
 * delete confirm, which prints "the win at 64-16" or "the loss at 16-64" and
 * has no third sentence to fall back on. The SHELF has a third case and must
 * not lie about it — basketball has no draws, so a game whose two numbers are
 * equal is a game that did not finish being scored, and the commonest one by
 * far is `0 — 0`. Calling that a win because `>=` says so is the one wrong
 * thing this row can print, and it printed it on every practice.
 *
 * A practice is not asked at all: the shelf never labels one, because a
 * practice is not a result. See `MatchFilter`.
 */
export const outcomeOf = (s: GameSummary): 'W' | 'L' | null =>
  s.score === s.oppScore ? null : s.score > s.oppScore ? 'W' : 'L';

/**
 * THE SHELF, FILTERED — and that is the whole of what the strip at the top of
 * MATCHES does.
 *
 * IT WAS A DAY-GROUPER AND IT IS NOT ANY MORE. The shelf briefly carried date
 * HEADINGS with the day's matches under them and its practices folded into a
 * run of chips beside a label. It answered "which day was that" well and cost
 * the thing the screen is actually for: a row was then a block inside a group
 * inside a section, three levels of structure over a list whose whole content
 * is a score, a name and a date. The list is FLAT again — one row per saved
 * match, every row the same shape, the date printed on the row that owns it —
 * and this is the one derivation left: it drops what the strip is not asking
 * for and changes nothing else.
 *
 * `groupByDay`, `dayHeading` and `dayKey` went with it, and the spelled month
 * they existed to justify went too. The two date labels below are the digits
 * they always were.
 */
/** Which slice of the shelf the strip at the top of MATCHES is asking for. */
export type MatchFilter = 'all' | 'official' | 'practice';

export function filterIn(index: GameSummary[], filter: MatchFilter): GameSummary[] {
  if (filter === 'all') return index;
  const want: GameKind = filter === 'practice' ? 'practice' : 'official';
  return index.filter((s) => summaryKind(s) === want);
}
