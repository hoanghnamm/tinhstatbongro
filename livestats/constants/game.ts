import type { FoulKindKey, Player, PlayerStats, TallyType, Zone } from '../types';

export const FOULS = 5;
export const PERIOD_LEN = 600; // 10:00

/**
 * `dq: true` means the foul counts toward the FOULS limit that disqualifies a
 * player. Technical is excluded (NBA-style); FIBA counts it toward the five —
 * flipping that one flag switches ruleset.
 */
export const FOUL_KINDS = {
  personal: { label: 'DEFENSIVE', short: 'DF', dq: true },
  shooting: { label: 'SHOOTING', short: 'SF', dq: true },
  offensive: { label: 'OFFENSIVE', short: 'OF', dq: true },
  flagrant: { label: 'FLAGRANT', short: 'FL', dq: true },
  technical: { label: 'TECHNICAL', short: 'TF', dq: false },
} as const satisfies Record<FoulKindKey, { label: string; short: string; dq: boolean }>;

/** The four the sidebar offers, in the order they are tapped most. */
export const FOUL_MENU: FoulKindKey[] = ['offensive', 'personal', 'technical', 'flagrant'];

/** Optional note on a shot: never required, never blocks the entry. */
export const SHOT_NOTES = ['LAYUP', 'JUMPER', 'DUNK', 'HOOK', 'FLOATER'] as const;

export const ZONES: Zone[] = ['paint', 'corner2', 'wing2', 'top2', 'corner3', 'wing3', 'top3'];
export const THREES = { corner3: true, wing3: true, top3: true } as const;

export const ZONE_LABEL: Record<Zone, string> = {
  paint: 'PAINT',
  corner2: 'CORNER 2',
  wing2: 'WING 2',
  top2: 'TOP 2',
  corner3: 'CORNER 3',
  wing3: 'WING 3',
  top3: 'TOP 3',
};

export const TALLY: Record<TallyType, keyof PlayerStats> = {
  turnover: 'turnovers',
  steal: 'steals',
  block: 'blocks',
  foulDrawn: 'foulsDrawn',
};

/** [type, abbreviation, word, the stat key its badge counts] */
export const TALLY_TILES = [
  ['block', 'BL', 'BLOCK', 'blocks'],
  ['steal', 'ST', 'STEAL', 'steals'],
  ['turnover', 'TO', 'TURNOVER', 'turnovers'],
  ['foulDrawn', 'FD', 'FOUL DRAWN', 'foulsDrawn'],
] as const satisfies readonly (readonly [TallyType, string, string, keyof PlayerStats])[];

/** The two rebound kinds, in the order the panel offers them. DR leads: it is
 *  the far more frequent one, so it gets the easier reach. */
export const REB = ['dreb', 'oreb'] as const;
export type RebWhat = (typeof REB)[number];

const zeroStats = (): PlayerStats => ({
  points: 0,
  fgMade: 0,
  fgAttempted: 0,
  twoMade: 0,
  twoAttempted: 0,
  threeMade: 0,
  threeAttempted: 0,
  ftMade: 0,
  ftAttempted: 0,
  ftTrips: 0,
  assists: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  turnovers: 0,
  steals: 0,
  blocks: 0,
  foulsDrawn: 0,
  fouls: 0,
  technicals: 0,
  flagrants: 0,
  offensiveFouls: 0,
  shootingFouls: 0,
  secondsPlayed: 0,
  onCourtPoints: 0,
});

const mk = (number: number, name: string): Player => ({
  id: 'p' + number,
  number,
  name,
  status: 'active',
  starter: false,
  stats: zeroStats(),
});

/** Hardcoded placeholder roster: first five start, the rest sit. */
export function seedRoster(): Player[] {
  const players = [
    mk(1, 'a.n'),
    mk(12, 'bd'),
    mk(13, 'No. 13'),
    mk(15, 'b.1'),
    mk(16, 'No. 16'),
    mk(7, 'No. 7'),
    mk(9, 'No. 9'),
    mk(21, 'No. 21'),
  ];
  players.forEach((p, i) => {
    if (i > 4) p.status = 'bench';
    else p.starter = true;
  });
  return players;
}
