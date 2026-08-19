/**
 * The season line: every saved game added up, one row per player.
 *
 * Plain functions over plain `GameState`s, on the same side of the line as
 * `box.ts` — the STATS tab loads the games and hands them here, and nothing in
 * this file knows about AsyncStorage or React.
 *
 * Two decisions worth stating out loud, because both are easy to get wrong and
 * neither is visible in the output:
 *
 *   IDENTITY IS THE ROSTER ID. A game holds copies of the players it was
 *   played with, so a player renamed or renumbered since is still the same
 *   person and their line still adds up. The NAME shown is the one the roster
 *   holds now; a player deleted from the team keeps the name their last game
 *   recorded, because there is nowhere else to get one.
 *
 *   PER GAME DIVIDES BY GAMES PLAYED, not by games in the season. A twelfth man
 *   who appeared twice averages over two, which is what an average means — the
 *   other reading punishes a player for the nights the team played without
 *   them.
 *
 * And one that is visible: THE SEASON IS THE OFFICIAL GAMES. A practice is a
 * whole game with a whole box score behind it, and it is on the shelf and it
 * opens — it is simply not a fact about the season, which is what a scorer
 * says when they pick PRACTICE at the door. `officialIn` is the filter and it
 * is applied by the SCREEN rather than inside `season()`, because `season()`
 * is also what one competition's own page is built from and that page has
 * already filtered.
 */
import { zeroStats } from '../constants/game';
import { totals, type Totals } from './stats';
import { cleanCompetition, competitionKey } from './team';
import type { GameState, Player, PlayerStats, RosterPlayer } from '../types';

export type SeasonMode = 'totals' | 'perGame';

export interface SeasonLine extends Player {
  /** how many of the saved games this player actually turned up for */
  games: number;
}

export interface Season {
  lines: SeasonLine[];
  team: Totals;
  /** games in the aggregate, whatever anyone's own count is */
  games: number;
  wins: number;
  losses: number;
}

/**
 * Did this player play in this game?
 *
 * Being on the sheet is not enough — a game is dressed with the whole available
 * roster and most of them sit. Minutes are the honest answer, but they are
 * clock-driven and a scorer who never starts the clock would zero every line,
 * so a start or any recorded stat counts too.
 */
export function appeared(p: Player): boolean {
  const s = p.stats;
  return (
    p.starter ||
    s.secondsPlayed > 0 ||
    s.fgAttempted > 0 ||
    s.ftAttempted > 0 ||
    s.points > 0 ||
    s.assists > 0 ||
    s.offensiveRebounds + s.defensiveRebounds > 0 ||
    s.turnovers + s.steals + s.blocks + s.foulsDrawn > 0 ||
    s.fouls + s.technicals + s.flagrants > 0
  );
}

/** Every counting key on a stat line, added in place. */
function addStats(into: PlayerStats, from: PlayerStats): void {
  for (const key of Object.keys(into) as (keyof PlayerStats)[]) {
    into[key] += from[key] ?? 0;
  }
}

/** One decimal, and only where one is wanted — a whole number stays whole. */
const per = (total: number, games: number): number =>
  games ? Math.round((total / games) * 10) / 10 : 0;

function divideStats(s: PlayerStats, games: number): PlayerStats {
  const out = zeroStats();
  for (const key of Object.keys(out) as (keyof PlayerStats)[]) {
    // minutes are formatted by `mmss` and want whole seconds, not a tenth of one
    out[key] = key === 'secondsPlayed' ? Math.round(s[key] / (games || 1)) : per(s[key], games);
  }
  return out;
}

/**
 * The season, aggregated.
 *
 * `roster` is only consulted for names and numbers as they stand today, and
 * for the ORDER: the team's own order is the one the scorer knows, and players
 * who have left the team follow it, so a deleted player's history is still
 * readable rather than silently dropped.
 */
export function season(games: GameState[], roster: RosterPlayer[], mode: SeasonMode): Season {
  const acc = new Map<string, { player: Player; games: number }>();
  let wins = 0;
  let losses = 0;

  for (const g of games) {
    if (g.score >= g.oppScore) wins++;
    else losses++;

    for (const p of g.players) {
      if (!appeared(p)) continue;
      let row = acc.get(p.id);
      if (!row) {
        row = {
          player: { id: p.id, number: p.number, name: p.name, status: 'bench', starter: false, stats: zeroStats() },
          games: 0,
        };
        acc.set(p.id, row);
      }
      addStats(row.player.stats, p.stats);
      row.games++;
      // `starter` is what the box-score table prints in its GS column, and over
      // a season the honest reading of it is "started at least once"
      if (p.starter) row.player.starter = true;
    }
  }

  const order = new Map(roster.map((p, i) => [p.id, i]));
  const rows = [...acc.values()].sort(
    (a, b) =>
      (order.get(a.player.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.player.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.player.number - b.player.number,
  );

  const lines: SeasonLine[] = rows.map(({ player, games: gp }) => {
    const current = roster.find((r) => r.id === player.id);
    return {
      ...player,
      number: current?.number ?? player.number,
      name: current?.name ?? player.name,
      stats: mode === 'perGame' ? divideStats(player.stats, gp) : player.stats,
      games: gp,
    };
  });

  return { lines, team: totals(lines), games: games.length, wins, losses };
}

/* ------------------------------------------------------------------ *
 * The competitions
 *
 * A season is the official games; a COMPETITION is a slice of them, and it is
 * the slice a scorer actually thinks in — "how are we doing in the league" is
 * a different question from "how are we doing".
 * ------------------------------------------------------------------ */

/** The games the season counts. A practice is a game; it is not a season game. */
export const officialIn = (games: GameState[]): GameState[] =>
  games.filter((g) => g.kind !== 'practice');

export interface CompetitionSeason {
  /** as the most recent game under it spells it — never the key */
  name: string;
  /** case- and space-folded, and the only thing two games are matched on */
  key: string;
  /**
   * The games themselves, still whole. The card above needs the aggregate and
   * nothing else, but the PAGE behind it re-aggregates on its own TOTALS /
   * PER GAME toggle — and re-grouping there to get the games back is how a card
   * and its own page start disagreeing about which games they are made of.
   */
  games: GameState[];
  /** the totals line, which is what a card prints */
  season: Season;
}

/**
 * Every competition on the shelf, each with its own season line.
 *
 * ORDER IS THE ORDER THE GAMES ARE HANDED IN, which the screens hand in newest
 * first, so the competition being played this month heads the list. Games with
 * no competition name — an official game saved before competitions existed —
 * are grouped together under `''`, because dropping them would be the season
 * total disagreeing with the cards under it.
 */
export function competitions(games: GameState[], roster: RosterPlayer[]): CompetitionSeason[] {
  const groups = new Map<string, { name: string; games: GameState[] }>();

  for (const g of officialIn(games)) {
    const key = competitionKey(g.competition ?? '');
    const group = groups.get(key);
    // the FIRST spelling seen wins, and the caller hands the newest game first
    if (group) group.games.push(g);
    else groups.set(key, { name: cleanCompetition(g.competition ?? ''), games: [g] });
  }

  return [...groups.entries()].map(([key, { name, games: gs }]) => ({
    name,
    key,
    games: gs,
    season: season(gs, roster, 'totals'),
  }));
}
