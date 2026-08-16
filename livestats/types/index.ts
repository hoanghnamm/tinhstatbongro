export type PlayerStatus = 'active' | 'bench' | 'out';

export interface PlayerStats {
  points: number;
  fgMade: number;
  fgAttempted: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  ftTrips: number;
  assists: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  turnovers: number;
  steals: number;
  blocks: number;
  foulsDrawn: number;
  /** counts toward disqualification only — technicals are excluded, see FOUL_KINDS */
  fouls: number;
  technicals: number;
  flagrants: number;
  offensiveFouls: number;
  shootingFouls: number;
  /** clock-driven, NOT action-driven — undo carries this forward */
  secondsPlayed: number;
  /**
   * Team points scored while this player was on the floor: the "for" half of a
   * plus-minus. The "against" half needs to know who was on for each opponent
   * basket, which this board does not track, so it ships as ON, not +/-.
   */
  onCourtPoints: number;
}

export interface Player {
  id: string; // `p${number}`
  number: number;
  name: string;
  status: PlayerStatus;
  starter: boolean;
  stats: PlayerStats;
}

export type Zone = 'paint' | 'corner2' | 'wing2' | 'top2' | 'corner3' | 'wing3' | 'top3';

export type ShotType = '2PT' | '3PT';
export type ZoneSide = 'l' | 'r' | 'c';
export type FoulKindKey = 'personal' | 'shooting' | 'offensive' | 'flagrant' | 'technical';
export type TallyType = 'turnover' | 'steal' | 'block' | 'foulDrawn';
export type ShotNote = 'LAYUP' | 'JUMPER' | 'DUNK' | 'HOOK' | 'FLOATER';

/** Normalised 0–1 inside the court box, 3 dp. Stored, so the rounding matters. */
export interface Position {
  x: number;
  y: number;
}

/** What every event carries regardless of kind — stamped once, by `log()`. */
export interface EventMeta {
  id: string;
  period: number;
  gameClock: string;
  timestamp: number;
}

/**
 * Discriminated union — do not collapse into one loose shape.
 *
 * Split out from the meta so an action can hand `log()` a body and have its own
 * shape checked: `Omit` over a union keeps only the keys every member shares,
 * which would silently drop `position`, `zone` and the rest.
 */
export type EventBody =
  | {
      type: 'shot';
      playerId: string;
      position: Position;
      zone: Zone;
      shotType: ShotType;
      shotNote: ShotNote | null;
      result: 'made' | 'miss';
      value: number;
      assistPlayerId: string | null;
    }
  | { type: 'assist'; playerId: string; position: Position | null; shotPlayerId: string }
  | {
      type: 'freeThrow';
      playerId: string;
      position: null;
      zone: null;
      result: 'made' | 'miss';
      value: number;
      andOne: boolean;
    }
  | {
      type: 'rebound';
      playerId: string;
      position: Position | null;
      reboundType: 'offensive' | 'defensive';
    }
  | { type: 'foul'; playerId: string; position: Position | null; foulKind: FoulKindKey }
  | { type: 'foulOut'; playerId: string; position: null }
  | { type: 'substitution'; playerId: string; outPlayerId: string }
  /** the opponent's whole model: `value` is THEIR points, so read `type` first */
  | { type: 'oppPoint'; playerId: null; position: null; value: number }
  | { type: TallyType; playerId: string; position: Position | null };

export type GameEvent = EventMeta & EventBody;

export interface GameState {
  team: { name: string };
  score: number;
  oppScore: number;
  period: number;
  /** seconds */
  remaining: number;
  running: boolean;
  ended: boolean;
  players: Player[];
  events: GameEvent[];
}

/** What a foul attempt did. Every caller of recordFoul must branch on it. */
export type FoulOutcome = 'ok' | 'out' | 'denied';
