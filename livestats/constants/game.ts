import type {
  CourtPosition,
  FoulKindKey,
  Player,
  PlayerStats,
  RosterPlayer,
  TallyType,
  Zone,
} from '../types';

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

/** A fresh, all-zero stat line. Exported because `startGame` builds one per
 *  player from the roster, which is the whole point of the store split. */
export const zeroStats = (): PlayerStats => ({
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
  onCourtOppPoints: 0,
});

/**
 * The first-run team. It is a ROSTER now, not a game: `rosterStore` seeds
 * itself from this and `startGame` turns whichever of them the scorer picks
 * into players. Ids stay `p${number}` so a game persisted before the split
 * still lines up with the roster it was built from.
 */
export const SEED_ROSTER: RosterPlayer[] = [
  { id: 'p1', number: 1, name: 'a.n', available: true },
  { id: 'p12', number: 12, name: 'bd', available: true },
  { id: 'p13', number: 13, name: 'No. 13', available: true },
  { id: 'p15', number: 15, name: 'b.1', available: true },
  { id: 'p16', number: 16, name: 'No. 16', available: true },
  { id: 'p7', number: 7, name: 'No. 7', available: true },
  { id: 'p9', number: 9, name: 'No. 9', available: true },
  { id: 'p21', number: 21, name: 'No. 21', available: true },
];

/**
 * The five the picker offers, plus the blank. `—` is a real choice and the
 * default one: a position is a label, and most scorers never set it.
 */
export const COURT_POSITIONS: CourtPosition[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * The game a fresh install opens on: the seed roster, first five starting.
 *
 * Field by field rather than spread, for the same reason `buildPlayers` is —
 * `position` and `available` belong to the team and must not arrive in a game.
 */
export function seedRoster(): Player[] {
  return SEED_ROSTER.map((r, i) => ({
    id: r.id,
    number: r.number,
    name: r.name,
    status: i > 4 ? 'bench' : 'active',
    starter: i <= 4,
    stats: zeroStats(),
  }));
}
