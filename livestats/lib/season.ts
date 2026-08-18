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
 */
import { zeroStats } from '../constants/game';
import { totals, type Totals } from './stats';
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
  draws: number;
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
  let draws = 0;

  for (const g of games) {
    if (g.score > g.oppScore) wins++;
    else if (g.score < g.oppScore) losses++;
    else draws++;

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

  return { lines, team: totals(lines), games: games.length, wins, losses, draws };
}
