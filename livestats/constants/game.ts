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

/**
 * WHAT A GAME IS WHEN NOBODY HAS SAID OTHERWISE — four tens.
 *
 * Neither is read by a rule any more: `GameState` carries its own `periods` and
 * `periodLen`, stamped at tip-off off the settings. These two are the FALLBACK
 * and the default, in three places and no others — `DEFAULT_OPTIONS`, the
 * store's rehydrate, and `reviveGame` — because a game saved before either was
 * a question was played under exactly this.
 */
export const REG_PERIODS = 4;
export const PERIOD_LEN = 600; // 10:00

/**
 * `dq: true` means the foul counts toward the FOULS limit that disqualifies a
 * player. Technical is excluded (NBA-style); FIBA counts it toward the five —
 * flipping that one flag switches ruleset.
 */
export const FOUL_KINDS = {
  personal: { label: 'Defensive', short: 'DF', dq: true },
  shooting: { label: 'Shooting', short: 'SF', dq: true },
  offensive: { label: 'Offensive', short: 'OF', dq: true },
  flagrant: { label: 'Flagrant', short: 'FL', dq: true },
  technical: { label: 'Technical', short: 'TF', dq: false },
} as const satisfies Record<FoulKindKey, { label: string; short: string; dq: boolean }>;

/** The four the sidebar offers, in the order they are tapped most. */
export const FOUL_MENU: FoulKindKey[] = ['offensive', 'personal', 'technical', 'flagrant'];

/** Optional note on a shot: never required, never blocks the entry. */
export const SHOT_NOTES = ['Layup', 'Jumper', 'Dunk', 'Hook', 'Floater'] as const;

export const ZONES: Zone[] = ['paint', 'corner2', 'wing2', 'top2', 'corner3', 'wing3', 'top3'];
export const THREES = { corner3: true, wing3: true, top3: true } as const;

export const ZONE_LABEL: Record<Zone, string> = {
  paint: 'Paint',
  corner2: 'Corner 2',
  wing2: 'Wing 2',
  top2: 'Top 2',
  corner3: 'Corner 3',
  wing3: 'Wing 3',
  top3: 'Top 3',
};

export const TALLY: Record<TallyType, keyof PlayerStats> = {
  turnover: 'turnovers',
  steal: 'steals',
  block: 'blocks',
  foulDrawn: 'foulsDrawn',
};

/** [type, abbreviation, word, the stat key its badge counts] */
export const TALLY_TILES = [
  ['block', 'BL', 'Block', 'blocks'],
  ['steal', 'ST', 'Steal', 'steals'],
  ['turnover', 'TO', 'Turnover', 'turnovers'],
  ['foulDrawn', 'FD', 'Foul drawn', 'foulsDrawn'],
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
/**
 * THE FIRST-RUN TEAM: FIVE SHIRTS, NUMBERED 1 TO 5, AND NOT ONE NAME.
 *
 * It seeds `rosterStore` and is never read again. It was EIGHT players carrying
 * the developer's own team — `a.n`, `bd`, `No. 13` — which was fine while
 * nothing ever showed it to a stranger. `app/intro.tsx` shows it to every
 * stranger on their first launch, as the answer to "who's on the team?", and a
 * roster of somebody else's initials is the worst possible answer.
 *
 * FIVE, BECAUSE FIVE IS `STARTERS` — the smallest roster that can actually
 * start a game, so a scorer who skips the roster step still has a working
 * board. A blank `name` is not an error state: the row draws `Player 1` as a
 * placeholder and the rail falls back to the number, so an untouched seed is a
 * team of five numbered shirts, which is what a team of five numbered shirts
 * looks like.
 *
 * THE IDS STAY `p${number}`, which is not cosmetic: a game persisted before the
 * store split lines up with the roster it was built from by exactly this.
 */
export const SEED_ROSTER: RosterPlayer[] = [
  { id: 'p1', number: 1, name: '', available: true },
  { id: 'p2', number: 2, name: '', available: true },
  { id: 'p3', number: 3, name: '', available: true },
  { id: 'p4', number: 4, name: '', available: true },
  { id: 'p5', number: 5, name: '', available: true },
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
