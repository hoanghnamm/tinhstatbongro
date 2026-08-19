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
   * Team points scored while this player was on the floor — the "for" half of
   * the plus-minus. Shown on the board as ON, because that is the half a
   * scorer glances at mid-game.
   */
  onCourtPoints: number;
  /**
   * Opponent points scored while this player was on the floor: the "against"
   * half. The opponent has no roster, but it does not need one — the three OPP
   * buttons are tapped live, so the board knows exactly who was standing there
   * when the points went up, which is all a plus-minus ever needed. That is
   * why `plusMinus()` is a real +/- and not a half of one.
   */
  onCourtOppPoints: number;
}

/**
 * THE CLUB — the half of "my team" that is not a list of people.
 *
 * It lives in `teamStore` beside the roster and outlives every game, exactly
 * as the roster does. Only the NAME crosses into a game, copied by `startGame`
 * the way a jersey and a name are copied into a `Player`: a box score should
 * say who it was played by even after the club is renamed. The crest and the
 * two coaches do not cross — they are facts about the club today, not about a
 * game that is already over.
 */
export interface TeamProfile {
  name: string;
  /**
   * A `file://` URI inside the app's DOCUMENT directory, or null.
   *
   * Never the URI the picker handed back: that one is in the cache, which the
   * OS may empty whenever it likes, and a crest that vanishes on a low-storage
   * morning is worse than no crest. `teamStore.setLogo` copies it out.
   */
  logoUri: string | null;
  coach: string;
  assistant: string;
}

/**
 * A LABEL, and nothing else. It is never read by a rule: the starter picker,
 * the rail and every stat behave exactly the same whether a player has one or
 * not, which is why it is optional and why nothing anywhere branches on it.
 */
export type CourtPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

/**
 * A player as the TEAM knows them, which is the part that outlives a game:
 * a jersey, a name, and the two things that are true of them between games.
 * It is `rosterStore`'s whole shape, and the argument `startGame` takes.
 */
export interface RosterPlayer {
  id: string;
  number: number;
  name: string;
  /** optional — a roster written before positions existed has none */
  position?: CourtPosition;
  /**
   * Injured or absent. An unavailable player is hidden from the starter picker
   * and dimmed in the roster list, and that is the whole of it — they are still
   * on the team, and a game already in progress does not hear about it.
   *
   * NOT optional, because `undefined` would be falsy and every player persisted
   * before this key existed would vanish from the picker. `rosterStore` bumps
   * its persist version and migrates instead.
   */
  available: boolean;
}

/**
 * A roster entry plus everything that belongs to ONE game.
 *
 * It extends the roster entry MINUS the two team-only keys: a position is a
 * label the box score has no use for, and availability is a fact about the
 * next game rather than about this one — a player who is on the floor is on
 * the floor. Narrowing the base here is what keeps `buildPlayers` honest, the
 * same way writing every field out by hand does.
 */
export interface Player extends Omit<RosterPlayer, 'position' | 'available'> {
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
  /**
   * Always at FT_SPOT, so the chart can draw it — but `zone` stays null on
   * purpose. A free throw is not a field-goal attempt, so no zone split may
   * count it; see FT_SPOT for why `zoneFor` is never asked.
   */
  | {
      type: 'freeThrow';
      playerId: string;
      position: Position;
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

/**
 * WHICH KIND OF NIGHT THIS WAS, and it is the one fact about a game that
 * decides whether the season counts it.
 *
 * A PRACTICE game is a real game with real stats — it is saved, it opens, it
 * has a box score and a shot chart — and it is simply not part of the season
 * line. An OFFICIAL one is played in a competition, is filed under that
 * competition's name, and is what the season adds up.
 *
 * There is no third kind. A friendly against a real club is either something
 * the scorer wants in the season or it is not, and that question has two
 * answers.
 */
export type GameKind = 'practice' | 'official';

/**
 * What the picker asks about THE GAME rather than about the team — the four
 * labels `startGame` carries across, none of which is a stat.
 *
 * It is one object rather than four positional arguments because it is one
 * answer: the picker's match card fills all of it in one place, and a fifth
 * label later should not move anybody's call site.
 */
export interface MatchInfo {
  kind: GameKind;
  /** the competition an OFFICIAL game is filed under; `''` on a practice */
  competition: string;
  opponent: string;
  note: string;
}

export interface GameState {
  team: { name: string };
  /**
   * PRACTICE or OFFICIAL, chosen at the door and never again — a game does not
   * change what it was after it was played. `lib/season.ts` is the only rule
   * that reads it, and it reads it for exactly one thing: the season line is
   * the OFFICIAL games and nothing else.
   *
   * A game read back off disk that was written before this existed is OFFICIAL,
   * because that is what the season already counted it as; see `reviveGame`.
   */
  kind: GameKind;
  /**
   * THE COMPETITION, and it is a string beside the kind for the same reason the
   * opponent is a string beside the number: it is the LABEL a shelf of games is
   * grouped by. The picker requires one on an official game — a competition
   * card with no name is a card nobody can read — and suggests the names
   * already on the shelf so a season's worth of games spells it one way.
   *
   * `''` on a practice game, and on an official one saved before competitions
   * existed. Both read as UNFILED where a name has to be printed.
   */
  competition: string;
  /**
   * WHO IT WAS AGAINST, and it is a string beside the integer rather than a
   * roster. The opponent's whole model is still one number and three buttons;
   * this is the label on that number, filled in once at tip-off, so a shelf of
   * thirty games says who each of them was played against.
   *
   * `''` is ordinary and is not an error — a scorer in a hurry starts the game
   * and never types it. Every reader prints OPPONENT in its place.
   */
  opponent: string;
  /** One free line about the night — the round, the venue, the weather. Never read by a rule. */
  note: string;
  score: number;
  oppScore: number;
  period: number;
  /** seconds */
  remaining: number;
  running: boolean;
  ended: boolean;
  /**
   * Our team's possessions, tapped by hand off the footer. A plain counter and
   * nothing else: it leaves no event and no player stat, because a possession
   * belongs to the team and the board has no way to know whose it was. It IS in
   * the undo snapshot, so a mis-tap next to the clock costs one UNDO.
   */
  possessions: number;
  players: Player[];
  events: GameEvent[];
}

/** What a foul attempt did. Every caller of recordFoul must branch on it. */
export type FoulOutcome = 'ok' | 'out' | 'denied';
