/**
 * `npm run check` — the smallest thing that fails if the basketball rules break.
 *
 * It runs the real modules, not copies: the domain logic lives in plain
 * functions over a GameState precisely so it can be exercised without React,
 * Zustand or a device. Boundaries first, because that is where zoneFor and the
 * foul limit actually go wrong.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { FOULS, FOUL_KINDS, FOUL_MENU, PERIOD_LEN, REG_PERIODS, SEED_ROSTER, TALLY_TILES, zeroStats } from '../constants/game';
import { DEFAULT_OPTIONS } from '../constants/options';
import * as A from '../lib/actions';
import { COURT_LINES, FT_SPOT, ZONE_PATHS, shotTypeFor, zoneFor, zoneSide } from './court';
import {
  clockEntry,
  clockReady,
  mmss,
  ord,
  periodLabel,
  periodName,
  periodWord,
  pushClockDigit,
  secondsFromClock,
} from './format';
import { figEm } from '../theme/figures';
import type { FigWeight } from '../theme/figures';
import { LS_TIGHT } from '../theme/tokens';
import { gridFor } from './grid';
import { advancedFor, linesFor, periodsOf, report, scoreline, shotsIn } from './box';
import { playerReportData, playerReportHtml, playerReportFileName } from './playerPdf';
import { gameReportHtml, reportFileName, reportTitle } from './pdf';
import { flowOf, periodScores, stampOf } from './flow';
import { OBS_MAX, observations, runsOf, standouts } from './observe';
import { tileWords } from './labels';
import { revenueCatAccess, BENEFITS, DEFAULT_PLAN, GATE_PITCH, GATES, PLANS, locked, vnd } from './billing';
import {
  BACKUP_FORMAT,
  BACKUP_REFUSAL,
  backupFileName,
  backupOf,
  countsOf,
  readBackup,
  travels,
} from './backup';
import {
  FAULT_NOTE,
  classify,
  clearFault,
  onStorageFault,
  reportFault,
  resetFault,
  storageFault,
} from './fault';
import {
  INTRO_COPY,
  INTRO_STEPS,
  TRIAL_GIVES,
} from '../constants/intro';
import {
  PANEL_TARGETS,
  TARGETS,
  TUTORIAL_BOARD,
  TUTORIAL_COPY,
  TUTORIAL_FOULED_OUT,
  TUTORIAL_SQUAD,
  TUTORIAL_STARTERS,
  TUTORIAL_STEPS,
  stepApplies,
} from '../constants/tutorial';
import {
  isDone,
  spotFor,
  stepIndex,
  targetFor,
  tutorialGame,
  visibleSteps,
  wantsPanel,
  type Watch,
} from './tutorial';
import { MODE } from '../components/panels/placement';
import {
  BOARD_CHOICES,
  LABEL_CHOICES,
  LENGTH_CHOICES,
  PERIOD_CHOICES,
  POSS_CHOICES,
  shapeLabel,
} from '../constants/options';
import { DARK, DOT_HUES, DOT_LABEL, PALETTE, dotColor } from '../theme/tokens';
import { litControl, litPlayerId } from './lit';
import {
  HISTORY_CAP,
  competitionsIn,
  gameKey,
  pushSummary,
  resultOf,
  outcomeOf,
  dayMonthLabel,
  filterIn,
  reviveGame,
  summarise,
  summaryKind,
  type GameSummary,
} from './history';
import {
  ROSTER_CAP,
  STARTERS,
  availableIn,
  buildPlayers,
  cleanName,
  migrateRoster,
  numberHolder,
  validNumber,
} from './roster';
import { competitions, officialIn, season } from './season';
import {
  FIRST_SQUAD,
  SQUAD_CAP,
  SQUAD_NAME_MAX,
  SQUAD_SIZE,
  canRemoveSquad,
  cleanSquadName,
  membersOf,
  migrateSquads,
  nextSquadName,
  squadIdOf,
  squadIn,
  squadsIn,
  tagsFor,
  toggleDraft,
  undraftedIn,
} from './squads';
import {
  COMPETITION_MAX,
  DEFAULT_TEAM,
  TEAM_NAME_MAX,
  NOTE_MAX,
  OPPONENT_MAX,
  cleanCoach,
  cleanCompetition,
  cleanNote,
  cleanOpponent,
  cleanTeamName,
  competitionKey,
  competitionLabel,
  opponentLabel,
  initials,
  logoName,
  migrateTeam,
} from './team';
import { efficiency, efg, efgValue, plusMinus, ptsOffSteals, totals, zoneSplits } from './stats';
import {
  AFTER_TIMEOUT,
  MIN_ATTEMPTS,
  MIN_RATIO,
  PLAYER_STATS,
  TEAM_GROUPS,
  TEAM_STATS,
  compare,
  type Line,
  deltaLabel,
  figure,
  netLabel,
  periodRows,
  playerComparison,
  playerImpact,
  poolNote,
  ratioLabel,
  teamComparison,
  teamLine,
  timeoutRun,
} from './analysis';
import type {
  GameEvent,
  GameState,
  Player,
  PlayerStats,
  Position,
  RosterPlayer,
  Squad,
} from '../types';

/**
 * THE SQUAD EVERY TEST IS PLAYED WITH: eight shirts, five on, three sitting.
 *
 * It is NOT `seedRoster()` and that is deliberate. The first-run seed is five
 * numbered shirts — the smallest roster that can start a game, chosen so the
 * onboarding's roster step shows a stranger a clean team rather than somebody
 * else's initials — and five players means no bench, which is half the rules
 * in this file. What a substitution does is a fact about the RULEBOOK; what a
 * fresh install happens to seed is a fact about the door. Pinning one to the
 * other is how a copy change breaks a test about fouling out.
 */
const squad = (): Player[] =>
  [1, 12, 13, 15, 16, 7, 9, 21].map((number, i) => ({
    id: `p${number}`,
    number,
    name: `No. ${number}`,
    status: i > 4 ? ('bench' as const) : ('active' as const),
    starter: i <= 4,
    stats: zeroStats(),
  }));

const game = (): GameState => ({
  team: { name: 'T' },
  squadId: '',
  squadName: '',
  kind: 'official',
  competition: '',
  opponent: '',
  note: '',
  score: 0,
  oppScore: 0,
  // four tens, which is what every game in this file is played to — the two are
  // on the GAME now, not on a constant, so a night saved under one clock cannot
  // be re-sliced by a setting changed afterwards
  periods: REG_PERIODS,
  periodLen: PERIOD_LEN,
  period: 1,
  remaining: PERIOD_LEN,
  running: false,
  ended: false,
  possessions: 0,
  timeouts: 0,
  players: squad(),
  events: [],
});

/** Court coordinates are normalised, so tests speak in the 792×521 space. */
const at = (x: number, y: number): Position => ({ x: x / 792, y: y / 521 });
const zone = (x: number, y: number) => zoneFor(x / 792, y / 521);

/* ---- geometry ----------------------------------------------------
 * Every boundary asserted here is a line PAINTED on the floor in
 * CourtSvg.tsx. If one of these moves, a line moved with it.
 * ------------------------------------------------------------------ */

assert.equal(zone(396, 100), 'paint', 'under the basket is the paint');
assert.equal(zone(277, 276), 'paint', 'the paint includes its own corner');
assert.equal(zone(276, 276), 'wing2', 'one pixel outside the lane is not the paint');
assert.equal(zone(513, 100), 'paint', 'the right lane edge is inside');
assert.equal(zone(514, 100), 'corner2', 'one pixel past it is not');

// the corner boxes: x ≤ 68 or x ≥ 724, above y = 203.7. (68, 203.7) is exactly
// where the box meets the arc, so the box is what makes the corner a three
// inside that radius — which is the whole reason it is written separately.
assert.equal(zone(68, 0), 'corner3', 'the corner box is a three inside the arc radius');
assert.equal(zone(69, 0), 'corner2', 'one unit out of the box and distance decides');
assert.equal(zone(724, 0), 'corner3', 'the right corner box, same rule');

// THE TWO CORNER CUTS ARE AT DIFFERENT HEIGHTS, because two different lines
// are drawn: the free-throw line extended at y = 101 inside the arc, the stub
// the three-point line turns on at y = 203.7 outside it. The boundary steps at
// x = 68 / 724, and a point can be below one cut and above the other.
assert.equal(zone(600, 100), 'corner2', 'above the free-throw line extended');
assert.equal(zone(600, 102), 'wing2', 'and below it the corner has ended');
assert.equal(zone(40, 200), 'corner3', 'the three-point corner runs to its own stub');
assert.equal(zone(40, 210), 'wing3', 'past the stub it has ended');
assert.equal(zone(60, 150), 'corner3', 'inside the box, below the 2PT cut, still a corner');

// the arc itself: r = 352 out of (396, 76)
assert.equal(zone(396, 76 + 351), 'top2', 'one unit inside the arc is a two');
assert.equal(zone(396, 76 + 353), 'top3', 'one unit outside it is a three');

// the two lane extensions are what open the top, and they start at the
// free-throw line: (310,276)→(187,521) and (480,276)→(603,521)
assert.equal(zone(500, 280), 'wing2', 'right of the extension, past the lane');
assert.equal(zone(470, 280), 'top2', 'between them, the top');
assert.equal(zone(320, 280), 'top2', 'and on the other side of the lane centre');
assert.equal(zone(300, 280), 'wing2', 'the extension starts at 310, so the lane edge leaves a sliver');
assert.equal(zone(590, 519), 'top3', 'the extensions fan out, so the top widens');
assert.equal(zone(610, 519), 'wing3', 'just past where the line leaves the floor');

// behind the backboard is above every cut, so it is a corner either way
assert.equal(zone(30, 0), 'corner3', 'behind the backboard, beyond the arc');
assert.equal(zone(200, 0), 'corner2', 'behind the backboard, inside the arc');

assert.equal(zoneSide('paint', 0.1), 'c', 'the paint is one region');
assert.equal(zoneSide('top3', 0.1), 'c', 'so is the top');
assert.equal(zoneSide('wing3', 0.1), 'l');
assert.equal(zoneSide('wing3', 0.9), 'r');

// the shot type is derived from the zone and can never disagree with it
assert.equal(shotTypeFor(68 / 792, 0), '3PT');
assert.equal(shotTypeFor(396 / 792, 100 / 521), '2PT');

/* ---- the box score ------------------------------------------------ */
{
  const g = game();
  const [p1, p2] = g.players;

  A.recordShot(g, p1.id, at(40, 100), '3PT', true, p2.id, null); // corner three, assisted
  A.recordShot(g, p1.id, at(396, 100), '2PT', false, null, null); // missed layup
  A.recordFreeThrowTrip(g, p1.id, [true, false], false);

  assert.equal(g.score, 4, 'a three and a free throw');
  assert.equal(p1.stats.points, 4);
  assert.equal(p1.stats.fgAttempted, 2);
  assert.equal(p1.stats.threeMade, 1);
  assert.equal(p2.stats.assists, 1);
  assert.equal(p1.stats.onCourtPoints, 4, 'every point credits all five on the floor');
  assert.equal(g.players[4].stats.onCourtPoints, 4);
  assert.equal(g.players[5].stats.onCourtPoints, 0, 'the bench gets nothing');

  const T = totals(g.players);
  assert.equal(T.pts, 4, 'the totals row equals the sum of the player rows');
  assert.equal(T.fga, 2);
  assert.equal(efg(T), '75.0%', 'eFG counts a three as one and a half');

  const Z = zoneSplits(g.events);
  assert.deepEqual(Z.corner3, { m: 1, a: 1 });
  assert.deepEqual(Z.paint, { m: 0, a: 1 });

  A.recordOppPoint(g, 3);
  assert.equal(g.oppScore, 3, 'the opponent is a number and nothing else');
  assert.equal(g.score, 4, 'and it does not touch ours');
}

/* ---- free throws leave a mark, and only a mark --------------------- */
{
  const g = game();
  const p = g.players[0];

  A.recordFreeThrowTrip(g, p.id, [true, true, false], false);
  const fts = g.events.filter((e) => e.type === 'freeThrow');
  assert.equal(fts.length, 3, 'one event per attempt, so the chart can count them');

  for (const e of fts) {
    assert.deepEqual(e.position, FT_SPOT, 'every free throw is taken from the same spot');
    // zoneFor is deliberately never called on it: a free throw is not a field
    // goal, so ANY zone it answered would be a wrong attempt in the splits.
    assert.equal(e.zone, null, 'and carries NO zone');
  }
  // and the answer is boundary noise anyway — the spot is the lane's own top
  // edge, and 0.53 (276 at 3 dp) lands a tenth of a unit the wrong side of it
  assert.equal(zoneFor(FT_SPOT.x, FT_SPOT.y), 'top2');
  assert.equal(zoneFor(FT_SPOT.x, 276 / 521), 'paint', 'one rounding step away');

  assert.equal(p.stats.ftAttempted, 3);
  assert.equal(p.stats.ftMade, 2);
  assert.equal(p.stats.ftTrips, 1);
  assert.equal(p.stats.fgAttempted, 0, 'free throws are not field goals');
  assert.equal(p.stats.twoAttempted, 0);
  assert.equal(p.stats.threeAttempted, 0);

  const Z = zoneSplits(g.events);
  assert.deepEqual(Z.paint, { m: 0, a: 0 }, 'and never inflate the paint');

  // What the chart draws off this: ONE dot however many attempts there are —
  // they all share a coordinate — and none at all at zero.
  const attempts = (evs: GameEvent[]) => evs.filter((e) => e.type === 'freeThrow').length;
  assert.equal(attempts([]), 0, 'no attempts, no mark');
  assert.equal(attempts(g.events), 3, 'three attempts, still one mark');

  // Undo is snapshot-based, so the mark follows with no special case: it is
  // derived from `events`, and `events` is what gets restored.
  const before = JSON.parse(JSON.stringify(g.events)) as GameEvent[];
  A.recordFreeThrowTrip(g, p.id, [true], false);
  assert.equal(attempts(g.events), 4);
  g.events = before; // what gameStore's undo() does wholesale
  assert.equal(attempts(g.events), 3, 'undo takes the attempt back off the mark');
}

/* ---- fouls -------------------------------------------------------- */
{
  const g = game();
  const p = g.players[0];

  for (let i = 1; i < FOULS; i++) {
    assert.equal(A.recordFoul(g, p.id, null, 'personal'), 'ok', `foul ${i} is ordinary`);
  }
  assert.equal(A.recordFoul(g, p.id, null, 'technical'), 'ok', 'a technical is always ok');
  assert.equal(p.stats.fouls, FOULS - 1, 'and does NOT advance the disqualification count');
  assert.equal(p.stats.technicals, 1);
  assert.equal(p.status, 'active');

  assert.equal(A.recordFoul(g, p.id, null, 'personal'), 'out', 'the fifth counting foul');
  assert.equal(p.status, 'out');
  assert.ok(g.events.some((e) => e.type === 'foulOut'), 'and it is logged');

  assert.equal(A.recordFoul(g, p.id, null, 'personal'), 'denied', 'nothing lands past the limit');
  assert.equal(p.stats.fouls, FOULS, 'and nothing is counted');

  assert.equal(A.onCourt(g).length, 4, 'out is off the floor');
  assert.equal(A.onBench(g).some((q) => q.id === p.id), false, 'and not on the bench either');

  // THE BOARD OWES A SUBSTITUTION the moment somebody is out and there is
  // anybody to replace them: that is what makes the panel un-dismissible, so
  // the predicate behind it is checked here rather than in a component.
  assert.equal(A.owesSub(g), true, 'four on the floor and a bench to fill it from');

  assert.equal(A.substitute(g, p.id, g.players[5].id), true, 'the replacement comes on');
  assert.equal(p.status, 'out', 'substituting a fouled-out player does not bench them');
  assert.equal(g.players[5].status, 'active', 'but the replacement comes on');
  assert.equal(A.owesSub(g), false, 'and the debt is paid: five on the floor again');

  // A PLAYER WHO IS OUT MAY NOT BE PUT BACK IN THE LINEUP, and that is a rule
  // rather than a disabled tile: the refusal is total and it logs nothing.
  const subs = g.events.filter((e) => e.type === 'substitution').length;
  assert.equal(A.substitute(g, g.players[1].id, p.id), false, 'the disqualified cannot come on');
  assert.equal(p.status, 'out', 'they are still out');
  assert.equal(g.players[1].status, 'active', 'and nobody came off for them');
  assert.equal(
    g.events.filter((e) => e.type === 'substitution').length,
    subs,
    'a refused substitution logs nothing',
  );

  // the bench runs out, and then the team really is playing short: four on the
  // floor, nobody who can come on, and a debt the board cannot pay is no debt
  for (const q of A.onBench(g)) q.status = 'out';
  A.onCourt(g)[0].status = 'out';
  assert.equal(A.onCourt(g).length, STARTERS - 1, 'four on the floor');
  assert.equal(A.owesSub(g), false, 'nobody left to bring on: no substitution is owed');
}

/* ---- the clock ---------------------------------------------------- */
{
  const g = game();
  A.tickSeconds(g, 30);
  assert.equal(g.remaining, PERIOD_LEN - 30);
  assert.equal(g.players[0].stats.secondsPlayed, 30, 'the floor accrues minutes');
  assert.equal(g.players[5].stats.secondsPlayed, 0, 'the bench does not');

  g.remaining = 5;
  A.tickSeconds(g, 60);
  assert.equal(g.remaining, 0, 'the clock stops at zero');
  assert.equal(g.players[0].stats.secondsPlayed, 35, 'and credits nothing past the buzzer');
}

/* ---- the buzzer, and the one snapshot that carries a clock -----------
 * END QUARTER goes through `edit()` like a basket, so a mis-tap on the tile
 * beside END GAME costs one UNDO rather than a whole period. It is the ONLY
 * clock mutation that does: see gameStore's Snapshot, whose `period` and
 * `remaining` are optional for exactly this reason.
 * ------------------------------------------------------------------ */
{
  const g = game();
  A.recordShot(g, 'p1', { x: 0.5, y: 0.4 }, '2PT', true, null, null);
  g.running = true;
  A.tickSeconds(g, 120);
  const played = g.players[0].stats.secondsPlayed;

  // what edit(fn, true) writes to the stack, and nothing else
  const snap = { period: g.period, remaining: g.remaining };

  A.nextPeriod(g);
  assert.equal(g.period, 2, 'the buzzer is one period on');
  assert.equal(g.remaining, PERIOD_LEN, 'with a full clock');
  assert.equal(g.running, false, 'and it is stopped — a quarter does not start itself');
  assert.equal(g.events.length, 1, 'it logs NOTHING: the shot is still the only event');
  assert.equal(g.score, 2, 'and it is not a scoring action');
  assert.equal(g.players[0].stats.secondsPlayed, played, 'nor a clock tick');

  // what undo() puts back off that snapshot
  Object.assign(g, snap, { running: false });
  assert.equal(g.period, 1, 'undo comes back into the quarter that was ended');
  assert.equal(g.remaining, PERIOD_LEN - 120, 'on the time it was ended at, not on a fresh one');
  assert.equal(g.score, 2, 'and the basket scored in it is still there');
  assert.equal(
    g.players[0].stats.secondsPlayed,
    played,
    'minutes are never rewound — the same rule undo() keeps for every other action',
  );
}

/* ---- the rules of the game are the GAME's -------------------------
 * `periods` and `periodLen` are settable, and the whole reason they live on
 * `GameState` rather than being read off `options` is that a quarter split is
 * ARITHMETIC over the length: a game saved under 4 × 10:00 must still slice
 * into ten-minute quarters after the scorer switches to halves. So the three
 * things that read a length — the buzzer, the split walk and the labels — are
 * asserted against a game that was NOT played to the default.
 * ------------------------------------------------------------------ */
{
  /* -- the labels -------------------------------------------------- */
  assert.equal(periodLabel(3, 4), 'Q3', 'a quarter is a quarter');
  assert.equal(periodLabel(1, 2), 'H1', 'and a half says so rather than lying about it');
  assert.equal(periodLabel(5, 4), 'OT', 'the first overtime is unnumbered');
  assert.equal(periodLabel(6, 4), 'OT2', 'the second is not');
  assert.equal(periodLabel(3, 2), 'OT', 'and OT starts one period earlier in halves');

  // …and the same answer in words, which is what the two clock panels print
  assert.equal(periodName(1, 4), '1st quarter');
  assert.equal(periodName(1, 2), '1st half', 'a halves game is not playing a quarter');
  assert.equal(periodName(5, 4), 'Overtime', 'and period 5 is not a 5th quarter');
  assert.equal(periodName(7, 4), 'Overtime 3');
  assert.equal(periodWord(2, 4), 'Quarter');
  assert.equal(periodWord(2, 2), 'Half');
  assert.equal(periodWord(3, 2), 'Overtime');
  // the END tile's caption has ten characters to spend and must not truncate
  for (const reg of [2, 4]) {
    for (const p of [1, reg, reg + 1, reg + 2]) {
      assert.ok(periodWord(p, reg).length <= 10, `${periodWord(p, reg)} fits the tile caption`);
    }
  }

  /* -- the buzzer puts back the GAME's clock, not the constant ------ */
  {
    const g = game();
    g.periods = 2;
    g.periodLen = 720;
    g.remaining = 0;
    A.nextPeriod(g);
    assert.equal(g.remaining, 720, 'an overtime is played to the clock the halves were');
    assert.notEqual(g.remaining, PERIOD_LEN, 'and specifically not to the old constant');
  }

  /* -- the split walk measures in the game's own periods ------------ */
  {
    const g = game();
    g.periodLen = 480; // eight-minute quarters
    g.remaining = 480;
    const paint: Position = { x: 0.5, y: 0.3 };

    g.running = true;
    A.recordShot(g, 'p1', paint, '2PT', true, null, null);
    A.tickSeconds(g, 480); // all of the first
    assert.equal(g.remaining, 0, 'the eight minutes ran out');

    A.nextPeriod(g);
    assert.equal(g.remaining, 480);
    A.tickSeconds(g, 30);
    A.recordShot(g, 'p12', paint, '2PT', true, null, null);

    const q1 = linesFor(g, 1);
    const q2 = linesFor(g, 2);
    const secs = (ps: typeof q1, id: string) => ps.find((p) => p.id === id)!.stats.secondsPlayed;
    assert.equal(secs(q1, 'p1'), 480, 'a starter played all eight minutes of the first');
    assert.notEqual(secs(q1, 'p1'), PERIOD_LEN, 'not the ten the constant would have credited');
    assert.equal(secs(q2, 'p1'), 30, 'and thirty seconds of the second');
    assert.equal(
      secs(q1, 'p1') + secs(q2, 'p1'),
      A.byId(g, 'p1')!.stats.secondsPlayed,
      'the periods still add up to the counter, at any length',
    );
    // the basket in each period landed in that period and nowhere else
    const pts = (ps: typeof q1, id: string) => ps.find((p) => p.id === id)!.stats.points;
    assert.equal(pts(q1, 'p1'), 2);
    assert.equal(pts(q2, 'p1'), 0, 'the walk did not spill one period into the next');
    assert.equal(pts(q2, 'p12'), 2);
  }

  /* -- a game from before either was a question --------------------- */
  {
    const old = reviveGame({
      team: { name: 'T' },
      score: 10,
      oppScore: 8,
      period: 4,
      players: squad(),
      events: [],
    })!;
    assert.equal(old.periods, REG_PERIODS, 'an older saved game was played in quarters');
    assert.equal(old.periodLen, PERIOD_LEN, 'of ten minutes, which is what the board was');
  }
}

/* ---- the chart's three dots ---------------------------------------
 * Four of the eight hues are palette tokens rather than hexes, which is the
 * only reason NEUTRAL can be white on the board's cool floor and warm grey on
 * the dark player page. The defaults must reproduce exactly what the chart
 * drew before any of it was settable.
 * ------------------------------------------------------------------ */
{
  assert.equal(dotColor('orange', PALETTE), PALETTE.accent, 'orange IS the accent');
  assert.equal(dotColor('red', PALETTE), PALETTE.danger);
  // TEAL IS RAW AND IS NO LONGER `live`. `live` is the hero photograph's
  // infield blue since the skin was sampled off the track, so resolving the
  // TEAL swatch through it would have drawn a blue beside BLUE in the same row
  // of eight. A swatch is a promise about the dot it draws.
  assert.notEqual(dotColor('teal', PALETTE), PALETTE.live, 'teal is not the live blue');
  assert.equal(dotColor('teal', PALETTE), dotColor('teal', DARK), 'and it is one hue on both');
  assert.equal(dotColor('neutral', PALETTE), PALETTE.markMiss, 'white on the light court');
  assert.equal(dotColor('neutral', DARK), DARK.markMiss, 'and warm grey on the dark one');
  assert.notEqual(
    dotColor('neutral', PALETTE),
    dotColor('neutral', DARK),
    'which is the whole point of resolving through the palette',
  );

  assert.equal(
    dotColor(DEFAULT_OPTIONS.dotMade, PALETTE),
    PALETTE.accent,
    'a made shot defaults to what it has always been',
  );
  assert.equal(dotColor(DEFAULT_OPTIONS.dotMiss, PALETTE), PALETTE.markMiss);
  assert.equal(dotColor(DEFAULT_OPTIONS.dotFt, PALETTE), PALETTE.danger);

  // every hue must answer, or a swatch draws nothing at all
  for (const hue of DOT_HUES) {
    assert.ok(/^#|^rgba/.test(dotColor(hue, PALETTE)), `${hue} resolves to a colour`);
    assert.ok(/^#|^rgba/.test(dotColor(hue, DARK)), `${hue} resolves on the dark palette too`);
  }
  assert.equal(DOT_HUES.length, new Set(DOT_HUES).size, 'and no hue is offered twice');
  // NOR TWICE UNDER TWO NAMES. Four of the eight resolve through the palette,
  // so a palette move can quietly land two swatches on one colour — which is
  // what putting the photograph's blue into `live` did to TEAL and BLUE.
  for (const p of [PALETTE, DARK]) {
    const drawn = DOT_HUES.map((h) => dotColor(h, p));
    assert.equal(drawn.length, new Set(drawn).size, 'no two swatches draw one colour');
  }
  for (const hue of DOT_HUES) assert.ok(DOT_LABEL[hue], `${hue} has a name to print`);
}

/* ---- possessions --------------------------------------------------- */
{
  const g = game();
  A.addPossession(g);
  A.addPossession(g);
  assert.equal(g.possessions, 2, 'the footer cell is a plain counter');
  assert.equal(g.events.length, 0, 'and it leaves NO event — a possession has no player');

  // THE OTHER HALF OF THE SAME CELL, and ALMOST the same kind of number: a
  // team counter with no player behind it — but it leaves a MARK, because the
  // one question worth asking about a timeout is what happened after it, and
  // that needs a time. See `timeoutRun`; the counter is still what the footer
  // reads.
  A.addTimeout(g);
  assert.equal(g.timeouts, 1, 'the timeout half is a plain counter too');
  assert.equal(g.events.length, 1, 'and, unlike a possession, it stamps the clock');
  assert.equal(g.events[0].type, 'timeout');
  assert.equal(g.events[0].playerId, null, 'a timeout belongs to nobody on the sheet');
  assert.equal(g.events[0].gameClock, mmss(g.remaining), 'stamped where the clock stood');
  A.addTimeout(g, -5);
  assert.equal(g.timeouts, 0, 'and it never goes negative');
  assert.equal(g.events.length, 1, 'a tap the clamp ate marks nothing');
  assert.equal(g.players[0].stats.points, 0, 'and touches no player stat');
  assert.equal(totals(linesFor(g, 1)).pts, 0, 'and no box score anywhere hears about it');

  // it is in the undo snapshot, which is what makes a mis-tap next to UNDO cost
  // exactly one tap — see gameStore's Snapshot type, which must list it
  const before = g.possessions;
  A.addPossession(g);
  assert.equal(g.possessions, before + 1);
  g.possessions = before; // what undo() restores wholesale
  assert.equal(g.possessions, 2);

  A.addPossession(g, -5);
  assert.equal(g.possessions, 0, 'and it never goes negative');
}

/* ---- the clock keypad ---------------------------------------------- */
{
  // four slots, mm:ss, filled LEFT TO RIGHT — the order the time is read in
  const type = (keys: string) => [...keys].reduce(pushClockDigit, '');

  assert.equal(clockEntry(''), '--:--', 'an empty entry is still four slots wide');
  assert.equal(clockEntry('0'), '0-:--', 'and the first digit lands on the left');
  assert.equal(clockEntry('072'), '07:2-');
  assert.equal(clockEntry('0724'), '07:24');

  assert.equal(clockReady('072'), false, 'three slots is an unfinished time');
  assert.equal(clockReady('0724'), true);
  assert.equal(secondsFromClock('0724'), 7 * 60 + 24, '0724 is 7:24');
  assert.equal(secondsFromClock('1000'), 600, 'and 1000 is the full period');
  assert.equal(mmss(secondsFromClock('0724')), clockEntry('0724'), 'both read the same');

  // slot 2 is the TENS of seconds and takes 0–5 only. Refusing the keystroke is
  // what keeps the readout honest at every point: clamping 74 to 59 afterwards
  // would put a time on screen that SET does not apply.
  assert.equal(type('077'), '07', 'a tens-of-seconds over 5 is refused, not clamped');
  assert.equal(type('0759'), '0759'.slice(0, 2) + '59', 'five is the last one it takes');
  assert.equal(secondsFromClock(type('0759')), 7 * 60 + 59);
  assert.equal(type('07249'), '0724', 'four digits, no more');
  assert.equal(type('9999'), '99', 'and the rule holds however wrong the entry is');
}

/* ---- points off steals -------------------------------------------- */
{
  const g = game();
  const [p1, p2] = g.players;
  A.recordTally(g, p1.id, null, 'steal');
  A.recordShot(g, p2.id, at(396, 100), '2PT', true, null, null);
  assert.equal(ptsOffSteals(g.events), 2, 'a score right after a steal counts');

  A.recordTally(g, p1.id, null, 'steal');
  A.recordOppPoint(g, 2);
  A.recordShot(g, p2.id, at(396, 100), '2PT', true, null, null);
  assert.equal(ptsOffSteals(g.events), 2, 'an opponent basket closes the window first');
}

/* ---- the who-grid ------------------------------------------------- */
{
  // every column count gives the same cell AREA, so the winner is the one whose
  // smallest side is largest — that is the shape, not the size, being chosen
  const wide = gridFor(5, 600, 300, 48);
  assert.equal(wide.columns * wide.rows >= 5, true, 'every tile gets a cell');
  assert.deepEqual(gridFor(6, 600, 300, 48), { columns: 3, rows: 2, min: 126 });
  assert.equal(gridFor(12, 600, 300, 48).columns * gridFor(12, 600, 300, 48).rows >= 12, true);
  assert.equal(gridFor(1, 600, 300, 48).columns, 1, 'one tile is one cell');
}

/* ---- the roster is not the game -----------------------------------
 * The whole reason `rosterStore` was split out of `gameStore`: a team outlives
 * a game, so editing one must not reach the other. `buildPlayers` is the only
 * crossing, so these are the assertions that hold the line.
 * ------------------------------------------------------------------ */
{
  assert.ok(SEED_ROSTER.length >= STARTERS, 'the first-run team can start a game');
  assert.ok(SEED_ROSTER.length <= ROSTER_CAP, 'and fits the cap');
  assert.equal(
    new Set(SEED_ROSTER.map((p) => p.number)).size,
    SEED_ROSTER.length,
    'no two seeded players wear the same number',
  );

  // THE SEED IS NAMELESS, and the door is why: `app/intro.tsx` shows this
  // roster to every stranger on their first launch, so a shirt arrives with a
  // number and nothing else. A blank name is not an error — the row draws
  // `Player N` as a placeholder.
  assert.ok(
    SEED_ROSTER.every((p) => p.name === ''),
    'the first-run team arrives already named',
  );

  // eight rather than the seed's five, because five cannot fill a bench and
  // this block is about what `buildPlayers` does with one — see `squad`
  const roster: RosterPlayer[] = squad().map((p) => ({
    id: p.id,
    number: p.number,
    name: p.name,
    available: true,
  }));
  const named = roster.map((p) => ({ ...p }));
  const starters = roster.slice(2, 7).map((p) => p.id); // deliberately NOT the first five
  const players = buildPlayers(roster, starters);

  assert.equal(players.length, roster.length, 'the whole team dresses');
  assert.equal(players.filter((p) => p.status === 'active').length, STARTERS, 'five start');
  assert.equal(
    players.filter((p) => p.starter).length,
    STARTERS,
    'and the flag agrees with the status',
  );
  assert.equal(
    players.filter((p) => p.status === 'bench').length,
    roster.length - STARTERS,
    'everyone else sits — nobody starts fouled out',
  );
  assert.ok(players.every((p) => p.stats.points === 0 && p.stats.secondsPlayed === 0), 'zeroed');
  assert.equal(
    new Set(players.map((p) => p.stats)).size,
    players.length,
    'and every stat line is its OWN object — one shared would put two players on one counter',
  );

  // the point of the split, stated as an assertion: the game holds copies
  const g = game();
  g.players = players;
  A.recordShot(g, players[2].id, at(396, 100), '2PT', true, null, null);

  roster[2].name = 'renamed mid-game';
  roster[2].number = 99;
  roster.splice(0, 1); // and removed from the team entirely

  assert.equal(g.players[2].name, named[2].name, 'a roster edit does not rename a player');
  assert.equal(g.players[2].number, named[2].number, 'nor renumber one');
  assert.equal(g.players.length, named.length, 'nor take one off the floor');
  assert.equal(g.players[2].stats.points, 2, 'and the box score is untouched');
}

/* ---- the roster form ----------------------------------------------- */
{
  const roster: RosterPlayer[] = [
    { id: 'a', number: 12, name: 'bd', available: true },
    { id: 'b', number: 7, name: 'a.n', available: true },
  ];

  // the duplicate check NAMES the holder, because the error has to be actionable
  assert.equal(numberHolder(roster, 12, null)?.name, 'bd');
  assert.equal(numberHolder(roster, 13, null), null, 'a free number has no holder');
  assert.equal(
    numberHolder(roster, 12, 'a'),
    null,
    'and editing #12 does not collide with itself',
  );

  assert.equal(validNumber(0), true, 'nought is a legal jersey');
  assert.equal(validNumber(99), true);
  assert.equal(validNumber(100), false);
  assert.equal(validNumber(-1), false);
  assert.equal(validNumber(1.5), false);

  assert.equal(cleanName('  bd  '), 'bd', 'names are trimmed');
  assert.equal(cleanName('x'.repeat(40)).length, 20, 'and capped — the rail truncates anyway');
}

/* ---- availability, and the migration that keeps it honest -----------
 * `available` is read as a FILTER, `undefined` is falsy, and a roster
 * persisted before the key existed rehydrates without it. Without the
 * migration that is an empty starter picker at tip-off, which is the one
 * failure this app cannot recover from in front of a scorer.
 * ------------------------------------------------------------------ */
{
  const stored = [
    { id: 'a', number: 12, name: 'bd' },
    { id: 'b', number: 7, name: 'a.n' },
    { id: 'c', number: 9, name: 'x', position: 'PG' },
    { id: 'd', number: 3, name: 'y', position: 'POINT GUARD' },
    { id: 'e', number: 4, name: 'z', available: false },
  ];
  const migrated = migrateRoster(stored);

  assert.equal(migrated.length, 5, 'nobody is lost in the migration');
  assert.ok(
    migrated.slice(0, 4).every((p) => p.available),
    'a roster that has never heard of availability has everyone available',
  );
  assert.equal(migrated[4].available, false, 'and an explicit false survives it');
  assert.equal(migrated[2].position, 'PG', 'a known position is kept');
  assert.equal(migrated[3].position, undefined, 'an unknown one is dropped, not rendered');
  assert.equal(migrated[0].position, undefined, 'and a missing one stays missing');

  assert.equal(availableIn(migrated).length, 4, 'the picker offers four of the five');
  assert.equal(
    migrateRoster(undefined).length,
    0,
    'nothing persisted is an empty roster, not a crash',
  );

  // POSITION IS A LABEL. The one crossing into a game copies field by field,
  // so neither of the two team-only keys can arrive in a stat line.
  const built = buildPlayers(migrated, ['a', 'b', 'c', 'e', 'd']);
  assert.equal(built.length, 5, 'buildPlayers copies whatever it is handed');
  for (const p of built) {
    assert.equal('position' in p, false, 'a position never reaches a game');
    assert.equal('available' in p, false, 'and neither does availability');
  }
}

/* ---- the club ------------------------------------------------------
 * The half of "my team" that is not a list of people. Nothing here opens a
 * file: the crest's copying and deleting lives in `teamStore`, because
 * `expo-file-system` cannot be imported into this script.
 * ------------------------------------------------------------------ */
{
  assert.equal(cleanTeamName('  Hanoi   Buffaloes  '), 'Hanoi Buffaloes', 'trimmed and collapsed');
  assert.equal(cleanTeamName('x'.repeat(60)).length, TEAM_NAME_MAX, 'and capped');
  assert.equal(cleanCoach('  a  b '), 'a b');

  // the crest when there is no crest, and it is NEVER empty
  assert.equal(initials('My Team'), 'MT');
  assert.equal(initials('Hanoi'), 'H');
  assert.equal(initials('a b c d'), 'AB', 'two letters at most — the third is unreadable');
  assert.equal(initials('   '), '?', 'a blank name still gets a mark');

  // A LOGO URI IS NOT TRUSTED. iOS moves the document directory between
  // installs, so anything that is not a file:// URI is dropped here and the
  // store checks the file still exists on rehydrate.
  const kept = migrateTeam({
    name: 'Hanoi',
    logoUri: 'file:///var/app/team/crest-1.jpg',
    coach: 'Vu',
    assistant: 'Linh',
  });
  assert.equal(kept.logoUri, 'file:///var/app/team/crest-1.jpg', 'a real file URI survives');
  assert.equal(kept.coach, 'Vu');

  assert.equal(
    migrateTeam({ name: 'Hanoi', logoUri: 'https://example.com/x.png' }).logoUri,
    null,
    'and anything that is not a file is not a crest',
  );
  assert.equal(migrateTeam({}).name, DEFAULT_TEAM.name, 'a nameless club falls back');
  assert.equal(migrateTeam({ name: '   ' }).name, DEFAULT_TEAM.name, 'and so does a blank one');
  assert.equal(migrateTeam(undefined).logoUri, null, 'nothing persisted is the default club');
  const webCrest = 'data:image/png;base64,aGVsbG8=';
  assert.equal(migrateTeam({ logoUri: webCrest }, true).logoUri, webCrest, 'web crest survives rehydrate');
  assert.equal(migrateTeam({ logoUri: webCrest }).logoUri, null, 'native migration still requires a file');
  assert.equal(migrateTeam({ logoUri: 'blob:https://hooplog.test/crest' }, true).logoUri, null, 'temporary browser URI is never persisted');
  assert.equal(migrateTeam({ logoUri: 'data:text/html;base64,aGVsbG8=' }, true).logoUri, null, 'web crest must be an image');
  assert.equal(migrateTeam({ logoUri: 'file:///tmp/crest.png' }, true).logoUri, null, 'browser cannot rehydrate a native file');
  assert.equal(migrateTeam({ logoUri: `data:image/png;base64,${'a'.repeat(800_001)}` }, true).logoUri, null, 'large browser crests are rejected');
  assert.equal(migrateTeam({ name: 'x' }).coach, '', 'the coaches are optional and start empty');

  // the file name is STAMPED, because React Native caches an <Image> by URI and
  // a second crest at the same path keeps showing the first
  assert.equal(logoName('file:///tmp/pic.PNG', 0), 'crest-0.png', 'the extension is kept, lowercased');
  assert.equal(logoName('file:///tmp/pic.jpeg', 0), 'crest-0.jpeg');
  assert.equal(logoName('file:///tmp/pic', 0), 'crest-0.jpg', 'and guessed when there is none');
  assert.notEqual(logoName('a.png', 1), logoName('a.png', 2), 'two crests never share a name');
}

/* ---- the other side ------------------------------------------------
 * A GAME's two labels, cleaned by the club's own function because they are
 * the same kind of thing. Neither is required, and a blank one reads as the
 * word the board has always used rather than as an empty gap.
 * ------------------------------------------------------------------ */
{
  assert.equal(cleanOpponent('  Hanoi   Rockets '), 'Hanoi Rockets', 'trimmed and collapsed');
  assert.equal(cleanOpponent('x'.repeat(99)).length, OPPONENT_MAX, 'and capped');
  assert.equal(cleanNote('x'.repeat(99)).length, NOTE_MAX, 'the note gets a line, not a name');

  assert.equal(
    opponentLabel('Hanoi Rockets'),
    'Hanoi Rockets',
    'a name a scorer typed is printed the way they typed it, never shouted back',
  );
  assert.equal(opponentLabel(''), 'Opponent', 'a game started in a hurry still says something');
  assert.equal(opponentLabel('   '), 'Opponent');
  assert.equal(opponentLabel(undefined), 'Opponent', 'a summary from before opponents existed');

  // THE COMPETITION is the third of the three, and the only one two games are
  // ever MATCHED on — so it is the only one with a folded key beside it
  assert.equal(cleanCompetition('  VBA   2026 '), 'VBA 2026', 'trimmed and collapsed');
  assert.equal(cleanCompetition('x'.repeat(99)).length, COMPETITION_MAX, 'and capped');
  assert.equal(
    competitionKey('  VBA   2026 '),
    competitionKey('vba 2026'),
    'case and spacing are all that is folded — a scorer will not reproduce their own capitals',
  );
  assert.notEqual(
    competitionKey('VBA'),
    competitionKey('VBA 2026'),
    'and nothing else is: two seasons of one league are two competitions',
  );
  assert.equal(competitionLabel('vba 2026'), 'vba 2026', 'the spelling is the scorer’s');
  assert.equal(competitionLabel(''), 'Unfiled', 'an official game saved before competitions');
  assert.equal(competitionLabel(undefined), 'Unfiled');
}

/* ---- the shelf ----------------------------------------------------- */
{
  const g = game();
  g.opponent = 'Hanoi Rockets';
  g.score = 55;
  g.oppScore = 48;
  g.period = 3;
  g.competition = 'VBA 2026';
  const s = summarise(g, 'g1', 1700000000000);
  assert.equal(s.score, 55);
  assert.equal(s.periods, 3, 'a quarter with nothing logged in it was still played');
  assert.equal(s.opponent, 'Hanoi Rockets', 'the shelf row says who it was against');
  assert.equal(s.kind, 'official', 'and which kind of night it was');
  assert.equal(s.competition, 'VBA 2026', 'and what it is filed under');
  assert.equal(resultOf(s), 'W');
  assert.equal(resultOf({ ...s, score: 40 }), 'L');

  // THE SHELF'S OWN RULE IS THREE-WAY, and that is why it is not `resultOf`.
  // `resultOf` is `>=` and has to stay so — its caller is the delete confirm,
  // which has only a win and a loss to print. The shelf has `0 — 0`, which is
  // a game nobody finished scoring, and calling that a WIN is the one wrong
  // thing a row can say. It said it on every practice.
  assert.equal(outcomeOf(s), 'W');
  assert.equal(outcomeOf({ ...s, score: 40 }), 'L');
  assert.equal(outcomeOf({ ...s, score: 0, oppScore: 0 }), null, '0 - 0 is not a win');
  assert.equal(outcomeOf({ ...s, score: 48 }), null, 'and neither is a tie');
  assert.equal(resultOf({ ...s, score: 48 }), 'W', 'while the two-way rule is unmoved');

  // the cap drops the OLDEST, and hands it back so its key can go too
  let index: GameSummary[] = [];
  for (let i = 0; i < HISTORY_CAP + 3; i++) {
    const out = pushSummary(index, { ...s, id: 'g' + i, endedAt: i });
    index = out.index;
    if (i < HISTORY_CAP) assert.equal(out.dropped.length, 0, 'nothing falls off under the cap');
    else assert.equal(out.dropped.length, 1, 'and exactly one does over it');
  }
  assert.equal(index.length, HISTORY_CAP, 'the shelf holds thirty');
  assert.equal(index[0].id, 'g' + (HISTORY_CAP + 2), 'newest first');
  assert.equal(
    index.some((x) => x.id === 'g0'),
    false,
    'and the oldest is the one that went',
  );

  // a game read back off disk is a game, whatever the build that wrote it knew
  const revived = reviveGame(JSON.parse(JSON.stringify(g)) as unknown);
  assert.equal(revived?.score, 55);
  assert.equal(revived?.ended, true, 'a saved game is over by definition');
  assert.equal(revived?.running, false, 'and its clock is not running');
  assert.equal(reviveGame(null), null, 'a row that is not a game is not one');
  assert.equal(reviveGame({ players: [] }), null, 'and half a game is not one either');

  // A GAME OF AN OLDER VINTAGE IS OFFICIAL, both on the shelf and off it. The
  // season counted it when it was saved, and a migration that quietly dropped a
  // month of games out of the season line would be the worse surprise.
  const old = reviveGame({ players: [], events: [], score: 4 } as unknown);
  assert.equal(old?.kind, 'official', 'a game from before the two kinds is official');
  assert.equal(old?.competition, '', 'and it is filed under nothing');
  assert.equal(
    summaryKind({ id: 'x', endedAt: 0, score: 0, oppScore: 0, periods: 4 }),
    'official',
    'a summary of the same vintage reads the same way',
  );
  assert.equal(summaryKind({ ...s, kind: 'practice' }), 'practice');

  // what the picker offers: the names the shelf already holds, newest first,
  // one per competition however many games are under it
  const row = (id: string, kind: 'practice' | 'official', competition: string): GameSummary => ({
    id, endedAt: 0, score: 0, oppScore: 0, periods: 4, kind, competition,
  });
  assert.deepEqual(
    competitionsIn([
      row('a', 'official', 'Cup 2026'),
      row('b', 'practice', 'not a competition'),
      row('c', 'official', 'VBA 2026'),
      row('d', 'official', 'vba  2026'),
      row('e', 'official', ''),
    ]),
    ['Cup 2026', 'VBA 2026'],
    'newest spelling wins, a practice files nothing, and a blank is not a name',
  );
}

/* ---- the season ----------------------------------------------------
 * PER GAME divides by the games a player APPEARED IN, never by the games
 * the team played. Anything else punishes a twelfth man for the nights the
 * team played without them.
 * ------------------------------------------------------------------ */
{
  const roster: RosterPlayer[] = [
    { id: 'p1', number: 1, name: 'a.n', available: true },
    { id: 'p12', number: 12, name: 'bd', available: true },
  ];

  const played = (pts: number, secs: number) => ({
    ...zeroStats(),
    points: pts,
    fgMade: pts / 2,
    fgAttempted: pts,
    secondsPlayed: secs,
  });

  const one: GameState = {
    ...game(),
    score: 20,
    oppScore: 10,
    players: [
      { id: 'p1', number: 1, name: 'a.n', status: 'active', starter: true, stats: played(20, 600) },
      { id: 'p12', number: 12, name: 'bd', status: 'bench', starter: false, stats: zeroStats() },
    ],
  };
  const two: GameState = {
    ...game(),
    score: 10,
    oppScore: 30,
    players: [
      { id: 'p1', number: 1, name: 'a.n', status: 'active', starter: true, stats: played(10, 600) },
      { id: 'p12', number: 12, name: 'bd', status: 'active', starter: true, stats: played(4, 300) },
    ],
  };

  const T = season([one, two], roster, 'totals');
  assert.equal(T.games, 2);
  assert.equal(T.wins, 1);
  assert.equal(T.losses, 1);
  assert.equal(T.lines.length, 2, 'a player who never appeared is not a season line');
  assert.equal(T.lines[0].games, 2, 'the one who played both');
  assert.equal(T.lines[1].games, 1, 'and the one who sat out the first');
  assert.equal(T.lines[0].stats.points, 30);
  assert.equal(T.lines[1].stats.points, 4);

  const P = season([one, two], roster, 'perGame');
  assert.equal(P.lines[0].stats.points, 15, '30 over the two games they played');
  assert.equal(P.lines[1].stats.points, 4, 'and 4 over the ONE game they played, not over two');
  assert.equal(P.lines[1].stats.secondsPlayed, 300, 'minutes stay whole seconds');

  // identity is the roster id, so a rename between games does not split a line
  const renamed = season([one, two], [{ ...roster[0], name: 'A. NGUYEN' }, roster[1]], 'totals');
  assert.equal(renamed.lines[0].name, 'A. NGUYEN', 'the name shown is the roster name today');
  assert.equal(renamed.lines[0].stats.points, 30, 'and the line is still one line');

  /* ---- the season is the OFFICIAL games ----------------------------
   * A practice keeps its whole box score and stays off the season line —
   * which is exactly what the scorer said when they tapped PRACTICE at the
   * door. It is the only thing `kind` is ever read for.
   * ------------------------------------------------------------------ */
  const practice: GameState = { ...two, kind: 'practice', competition: '' };
  assert.equal(officialIn([one, two, practice]).length, 2, 'a practice is not a season game');
  assert.equal(
    season(officialIn([one, practice]), roster, 'totals').lines[0].stats.points,
    20,
    'and its points are not in the season either',
  );
  assert.equal(
    officialIn([{ ...one, kind: undefined as unknown as GameState['kind'] }]).length,
    1,
    'a game with no kind at all is official, the same reading `reviveGame` gives',
  );

  /* ---- and it is cut into competitions ------------------------------
   * Grouped on the FOLDED key, so a name typed twice is one competition;
   * shown under the spelling of the game handed in first, which the screens
   * hand in newest first.
   * ------------------------------------------------------------------ */
  const filed = (g: GameState, competition: string): GameState => ({ ...g, competition });
  const C = competitions(
    [filed(two, 'VBA  2026'), filed(one, 'vba 2026'), filed(one, 'Cup'), practice],
    roster,
  );
  assert.equal(C.length, 2, 'two competitions, and the practice is in neither');
  assert.equal(C[0].name, 'VBA 2026', 'the newest spelling heads the group');
  assert.equal(C[0].key, 'vba 2026');
  assert.equal(C[0].games.length, 2, 'both games under it, whichever way it was typed');
  assert.equal(C[0].season.games, 2);
  assert.equal(C[0].season.wins, 1, 'a competition keeps its own record');
  assert.equal(C[0].season.losses, 1);
  assert.equal(C[1].name, 'Cup');
  assert.equal(C[1].season.lines[0].stats.points, 20, 'and its own stat lines');
  assert.equal(
    competitions([filed(one, '')], roster)[0].key,
    '',
    'an official game filed under nothing is its own group, not a dropped one',
  );
}

/* ---- one game against a baseline -----------------------------------
 * `lib/analysis.ts` is a plain module on the same side of the line as
 * `box.ts`, `season.ts` and `billing.ts`, so the whole comparison — the
 * baseline, the polarity, the two guards on "what changed" and the strings
 * that get printed — is walked here with no React and no device.
 *
 * The one thing most of the assertions in this block are really protecting is
 * the FIRST rule in that file: THE BASELINE DOES NOT INCLUDE THE SUBJECT. It
 * is the kind of off-by-one that produces plausible numbers for ever.
 * ------------------------------------------------------------------ */
{
  /** A game one player played the whole of, and the opponent's score beside it. */
  const night = (over: Partial<PlayerStats> & { opp?: number }): GameState => {
    const { opp = 0, ...rest } = over;
    const stats: PlayerStats = { ...zeroStats(), ...rest };
    return {
      ...game(),
      score: stats.points,
      oppScore: opp,
      players: [
        { id: 'p1', number: 1, name: 'a.n', status: 'active', starter: true, stats },
      ],
    };
  };

  /** The shorthand the old six-row table used, so the arithmetic reads. */
  const simple = (
    pts: number,
    reb: number,
    ast: number,
    stl: number,
    to: number,
    fgm: number,
    fga: number,
    opp = 0,
  ): GameState =>
    night({
      points: pts,
      defensiveRebounds: reb,
      assists: ast,
      steals: stl,
      turnovers: to,
      fgMade: fgm,
      fgAttempted: fga,
      twoMade: fgm,
      twoAttempted: fga,
      opp,
    });

  /* ---- THE TEN AREAS, AND THE POLARITY EACH ROW CARRIES ------------ */
  assert.deepEqual(
    TEAM_GROUPS.map((g) => g.key),
    ['scoring', 'shooting', 'volume', 'movement', 'security', 'rebounding', 'defence', 'discipline'],
    'the areas, in the order they are read',
  );
  assert.equal(
    TEAM_STATS.length,
    TEAM_GROUPS.reduce((n, g) => n + g.stats.length, 0),
    'the flat list is the groups and nothing else',
  );
  assert.equal(
    new Set(TEAM_STATS.map((d) => d.key)).size,
    TEAM_STATS.length,
    'no key is claimed twice — `highlightsFor` looks its definition up by it',
  );

  // A RISE IS BAD NEWS ON EXACTLY THE ROWS WHERE IT IS: what we gave away,
  // what we fouled, and what they scored.
  assert.deepEqual(
    TEAM_STATS.filter((d) => d.polarity === 'down').map((d) => d.key),
    ['to', 'opp', 'pf'],
  );
  // AND ON THE FOUR VOLUME ROWS IT IS NEITHER. Six more threes is a fact about
  // what the team chose to do, and this file does not grade a choice.
  assert.deepEqual(
    TEAM_STATS.filter((d) => d.polarity === 'none').map((d) => d.key),
    ['fga', 'twoa', 'tpa', 'fta'],
  );
  assert.deepEqual(
    TEAM_STATS.filter((d) => d.kind !== 'count').map((d) => d.kind),
    ['percent', 'percent', 'percent', 'percent', 'percent', 'ratio'],
    'five percentages and one ratio, and every one of them pooled',
  );
  for (const d of TEAM_STATS) {
    assert.equal(!!d.den, d.kind !== 'count', `${d.key}: a rate is the only thing with a denominator`);
  }

  // the team line comes off the PLAYERS, not off `g.score`: a point logged
  // against nobody would otherwise put the PTS row above the rows under it
  assert.equal(teamLine(simple(20, 8, 4, 2, 3, 8, 20)).pts, 20);
  assert.equal(
    teamLine({ ...simple(20, 8, 4, 2, 3, 8, 20), score: 99 }).pts,
    20,
    'the board score does not overrule the box score',
  );
  // THE MARGIN IS THE BOARD'S, both halves — it is the only figure here the
  // opponent has a say in, and they have no box score to add up
  {
    const l = teamLine(simple(60, 0, 0, 0, 0, 0, 0, 44));
    assert.equal(l.opp, 44, 'points allowed is the board number');
    assert.equal(l.margin, 16);
    assert.equal(l.pm, 16, 'and a team plus-minus IS the margin, not five of them');
  }

  /* ---- THE BASELINE IS EVERY OTHER GAME, and never the subject ----- */
  {
    // newest first, as every caller hands them in. The subject scored 30; the
    // six others scored 10 each, and every one of them counts.
    const subject = simple(30, 10, 10, 6, 4, 10, 20);
    const rest = Array.from({ length: 6 }, () => simple(10, 10, 4, 2, 8, 5, 20));
    const C = teamComparison(subject, [subject, ...rest]);
    assert.equal(C.baseGames, 6, 'six other games — and the subject is dropped out of its own baseline');

    const pts = C.rows.find((r) => r.key === 'pts')!;
    assert.equal(pts.subject, 30);
    assert.equal(pts.base, 10, 'the baseline is the OTHERS, with the subject left out');
    assert.equal(pts.delta, 20);
    assert.equal(pts.ratio, 2, '+200%, off an average that never saw the 30');
    assert.equal(pts.better, true);

    // the same move on the other polarity: turnovers FELL, which is good news
    const to = C.rows.find((r) => r.key === 'to')!;
    assert.equal(to.delta, -4);
    assert.equal(to.better, true, 'fewer turnovers is a better game, not a worse one');
    assert.equal(deltaLabel(to), '-4');

    // FG% is POOLED over the baseline — 30 of 120, not the mean of six 25%s,
    // which happens to agree here and is asserted below where it does not
    const fg = C.rows.find((r) => r.key === 'fg')!;
    assert.equal(fg.subject, 50);
    assert.equal(fg.base, 25);
    assert.equal(deltaLabel(fg), '+25 pts', 'a percentage row carries its UNIT');
    assert.equal(ratioLabel(fg), '+100%', 'and its relative move beside it');

    // A VOLUME ROW MOVED TOO, and it is neither good news nor bad
    const fga = C.rows.find((r) => r.key === 'fga')!;
    assert.equal(fga.delta, 0);
    assert.equal(fga.better, null, 'a row with no polarity is never coloured');
    assert.ok(
      C.highlights.every((h) => h.key !== 'fga' && h.key !== 'tpa'),
      'and never named',
    );
  }

  /* ---- A BASELINE OF ONE GAME IS THE SAME ARITHMETIC ---------------- *
   * Comparing two games is not a second mode: it is an average over one
   * game, which is that game's own figures. The screen's second field is
   * this and nothing more.
   * ------------------------------------------------------------------ */
  {
    const a = simple(80, 40, 20, 6, 10, 30, 60, 70);
    const b = simple(60, 30, 10, 3, 15, 24, 60, 75);
    const C = teamComparison(a, [b]);
    assert.equal(C.baseGames, 1);
    assert.equal(C.rows.find((r) => r.key === 'pts')!.base, 60, "the other game's own points");
    assert.equal(C.rows.find((r) => r.key === 'fg')!.base, 40, 'and its own percentage');
    assert.equal(C.rows.find((r) => r.key === 'opp')!.subject, 70);
    assert.equal(C.rows.find((r) => r.key === 'opp')!.delta, -5);
    assert.equal(
      C.rows.find((r) => r.key === 'opp')!.better,
      true,
      'five fewer points allowed is a better night, not a worse one',
    );
    assert.equal(poolNote(1), '', 'and there is no pooling note, because there is nothing to pool');
  }

  /* ---- A RATE IS POOLED, which is not the mean of the rates --------- */
  {
    // one game 1-for-2 (50%) and one 1-for-18 (5.6%). Pooled that is 2 of 20,
    // or 10%; the mean of the two percentages is 27.8%, and the gap between
    // those two numbers is the whole reason the rule is written down.
    const subject = simple(0, 0, 0, 0, 0, 0, 0);
    const C = teamComparison(subject, [simple(2, 0, 0, 0, 0, 1, 2), simple(2, 0, 0, 0, 0, 1, 18)]);
    const fg = C.rows.find((r) => r.key === 'fg')!;
    assert.equal(fg.base, 10, 'two makes over twenty attempts, not the mean of 50% and 5.6%');
    assert.equal(fg.subject, null, 'and a game with no attempt has no percentage at all');
    assert.equal(fg.delta, null);
    assert.equal(deltaLabel(fg), '—', 'which prints as a dash, never as a zero');
    assert.ok(poolNote(2).includes('pooled'), 'and the note that says so is printed');

    // ASSISTS PER TURNOVER IS THE SAME RULE, and undefined when nobody gave
    // the ball away — a real answer, not a zero
    const ratio = teamComparison(simple(0, 0, 9, 0, 6, 0, 0), [simple(0, 0, 4, 0, 4, 0, 0)]);
    const at = ratio.rows.find((r) => r.key === 'astto')!;
    assert.equal(at.subject, 1.5);
    assert.equal(at.base, 1);
    assert.equal(figure(at, at.subject), '1.50', 'a ratio prints to two places');
    assert.equal(deltaLabel(at), '+0.50', 'and so does its change, with no unit after it');
    assert.equal(
      teamComparison(simple(0, 0, 5, 0, 0, 0, 0), [simple(0, 0, 4, 0, 4, 0, 0)]).rows.find(
        (r) => r.key === 'astto',
      )!.subject,
      null,
      'no turnovers is no ratio',
    );
  }

  /* ---- WHAT A CELL PRINTS, AND HOW WIDE IT IS ----------------------
   * These four strings are the widest things the comparison table ever draws,
   * and the table is five columns beside a label on a phone. It used to print
   * a percentage to a tenth, which is the one place in the app that a tenth
   * was not worth its width: `100.0%` did not fit the Game cell on any device
   * and `44.1%` did not fit on most, so a shooting split arrived with an
   * ellipsis where its last digit should have been. Whole numbers here — and
   * `lib/stats.ts` keeps ITS tenth, because `eFG%` is read one at a time in a
   * tile with a whole quarter of a row to itself.
   * ------------------------------------------------------------------ */
  {
    const perfect = teamComparison(simple(0, 0, 0, 0, 0, 2, 2), [simple(0, 0, 0, 0, 0, 1, 2)]);
    const fg = perfect.rows.find((r) => r.key === 'fg')!;
    assert.equal(figure(fg, fg.subject), '100%', 'a percentage is a whole number in this table');
    assert.equal(figure(fg, fg.base), '50%');
    assert.equal(deltaLabel(fg), '+50 pts', 'and so is the move, with its unit still on it');

    // THE RATIO GIVES UP PAST THREE FIGURES rather than drawing a fourth. A
    // baseline near zero throws ratios in the thousands, which is not a
    // reading anybody can use and IS the widest string this cell would ever be
    // asked to hold. Empty, the same answer it gives when there is no ratio.
    const wild = teamComparison(simple(0, 0, 0, 0, 0, 0, 0), [simple(0, 0, 0, 0, 0, 0, 0)]);
    assert.equal(ratioLabel({ ...fg, ratio: 0.29 }), '+29%');
    assert.equal(ratioLabel({ ...fg, ratio: -1 }), '-100%');
    assert.equal(ratioLabel({ ...fg, ratio: 9.99 }), '+999%', 'three figures still print');
    assert.equal(ratioLabel({ ...fg, ratio: 10 }), '', 'a fourth does not');
    assert.equal(ratioLabel({ ...fg, ratio: null }), '');
    assert.ok(wild.rows.length > 0, 'a game of zeroes still draws its rows');
  }

  /* ---- ONE GAME IS NOT NOTHING -------------------------------------
   * The STATS tab draws the way in whenever there is an official game, so a
   * scorer one game into a season opens a page rather than finding a control
   * missing. What they get is that game's own figures with an empty baseline
   * beside them — never a fabricated average.
   * ------------------------------------------------------------------ */
  {
    const only = simple(30, 10, 5, 3, 4, 10, 20);
    const C = teamComparison(only, [only]);
    assert.equal(C.baseGames, 0);
    const pts = C.rows.find((r) => r.key === 'pts')!;
    assert.equal(pts.subject, 30, 'the game is still printed');
    assert.equal(pts.base, null, 'and there is nothing to compare it with');
    assert.equal(pts.delta, null);
    assert.equal(pts.ratio, null);
    assert.equal(pts.better, null, 'so it is neither good news nor bad');
    assert.equal(deltaLabel(pts), '—');
    assert.equal(ratioLabel(pts), '', 'an absent ratio prints NOTHING, not a dash');
    assert.equal(C.highlights.length, 0, 'and nothing changed, because nothing was compared');
    assert.ok(poolNote(0).length > 0, 'and the page says why');
  }

  /* ---- AN AVERAGE OF ZERO HAS NO PERCENTAGE ------------------------- */
  {
    const subject = simple(0, 0, 0, 5, 0, 0, 0);
    const C = teamComparison(subject, [simple(0, 0, 0, 0, 0, 0, 0), simple(0, 0, 0, 0, 0, 0, 0)]);
    const stl = C.rows.find((r) => r.key === 'stl')!;
    assert.equal(stl.base, 0);
    assert.equal(stl.delta, 5, 'the absolute move is the whole answer');
    assert.equal(stl.ratio, null, 'five steals against none is not an infinite improvement');
    assert.equal(ratioLabel(stl), '');
    assert.ok(
      C.highlights.every((h) => h.key !== 'stl'),
      'and a row with no ratio cannot be ranked, so it is never a highlight',
    );
  }

  /* ---- WHAT CHANGED — two guards, each catching what the other cannot
   * `MIN_RATIO` throws out a big number that barely moved; the per-stat
   * `floor` throws out a small number that moved a long way in percentage
   * terms. Both have to pass, and the list is ranked on the RELATIVE move so
   * a turnover and a rebound can be put beside each other.
   * ------------------------------------------------------------------ */
  {
    // assists 4 → 5 is +25%, well over MIN_RATIO, and it is one assist. The
    // floor is what keeps it off a list it would otherwise be near the top of.
    const subject = simple(62, 40, 5, 4, 12, 25, 60, 60);
    const C = teamComparison(subject, [
      simple(60, 40, 4, 4, 12, 25, 60, 60),
      simple(60, 40, 4, 4, 12, 25, 60, 60),
    ]);
    const ast = C.rows.find((r) => r.key === 'ast')!;
    assert.ok(Math.abs(ast.ratio!) > MIN_RATIO, 'it clears the relative guard');
    assert.ok(
      C.highlights.every((h) => h.key !== 'ast'),
      'and is still not a change, because one assist is not news',
    );
  }

  {
    // a night where several things moved a long way, and one of them is bad
    const subject = simple(90, 50, 20, 12, 20, 40, 60, 60);
    const C = teamComparison(subject, [
      simple(60, 40, 10, 4, 10, 24, 60, 60),
      simple(60, 40, 10, 4, 10, 24, 60, 60),
    ]);
    assert.ok(
      C.highlights.length > 0 && C.highlights.length <= 3,
      'at most three, and at least one',
    );

    // ranked on the relative move, biggest first
    const ratios = C.highlights.map((h) => Math.abs(C.rows.find((r) => r.key === h.key)!.ratio!));
    assert.deepEqual(ratios, [...ratios].sort((a, b) => b - a), 'biggest relative move first');

    const to = C.highlights.find((h) => h.key === 'to');
    assert.ok(to, 'turnovers doubled and that is worth saying');
    assert.equal(to!.better, false, 'and it is BAD news, which is what the polarity is for');
    assert.equal(to!.rose, true, 'the arrow says the figure went UP');
    assert.equal(to!.label, 'Turnovers increased');
    assert.equal(to!.detail, '+10 TO');

    // ONE SENTENCE PER AREA. Rebounds, offensive rebounds and defensive
    // rebounds all moved together — as they always do — and that is one piece
    // of news, not three.
    const areas = C.highlights.map(
      (h) => TEAM_GROUPS.find((g) => g.stats.some((d) => d.key === h.key))!.key,
    );
    assert.equal(new Set(areas).size, areas.length, 'two sentences about one area');

    // GOOD AND BAD ARE NOT BALANCED ON PURPOSE — whatever moved most is what
    // is named, so a night where everything went right says so rather than
    // inventing a complaint. Nothing here asserts one of each.
    for (const h of C.highlights) {
      const row = C.rows.find((r) => r.key === h.key)!;
      assert.equal(h.better, row.better, 'a highlight cannot disagree with its own row');
      assert.equal(h.rose, row.delta! > 0);
    }
  }

  /* ---- A PLAYER'S BASELINE IS THE GAMES THEY APPEARED IN -------------
   * The same denominator `lib/season.ts` uses everywhere, and for the same
   * reason: a player is not having a worse run because the team played a
   * game without them. It also decides what "their last game" means — the
   * last one THEY played, not the last one the team did.
   * ------------------------------------------------------------------ */
  {
    const line = (pts: number) => ({ ...zeroStats(), points: pts, fgMade: 1, fgAttempted: 2 });
    /** A zeroed line is on the sheet and did not play. */
    const g = (pts: number | null): GameState => ({
      ...game(),
      players: [
        {
          id: 'p1',
          number: 1,
          name: 'a.n',
          status: 'bench',
          starter: false,
          stats: pts === null ? zeroStats() : line(pts),
        },
      ],
    });

    // newest first: the team's last game is one this player sat out
    const C = playerComparison([g(null), g(20), g(10), g(10), g(10), g(10), g(10)], 'p1')!;
    const pts = C.rows.find((r) => r.key === 'pts')!;
    assert.equal(pts.subject, 20, 'their last game is the last one THEY played');
    assert.equal(C.baseGames, 5, 'and the baseline skips the game they missed');
    assert.equal(pts.base, 10, 'a DNP is not averaged in as a zero line');
    assert.equal(pts.delta, 10);
    assert.deepEqual(
      C.rows.map((r) => r.key),
      PLAYER_STATS.map((d) => d.key),
      'a player is read on five things, and the plus-minus is one of them',
    );

    assert.equal(
      playerComparison([g(null), g(null)], 'p1'),
      null,
      'a player who has never appeared has no card at all',
    );
    assert.equal(playerComparison([g(10)], 'nobody'), null, 'and neither does a stranger');

    const one = playerComparison([g(14)], 'p1')!;
    assert.equal(one.baseGames, 0, 'one appearance is a comparison with an empty baseline');
    assert.equal(one.rows.find((r) => r.key === 'pts')!.subject, 14);
  }

  /* ---- WHO PLAYED ABOVE THEIR OWN NORMAL ----------------------------
   * Every player against THEMSELVES, in the game's own order, nothing
   * ranked — and a player with nothing to compare against keeps their row.
   * ------------------------------------------------------------------ */
  {
    const sheet = (pts: number, other: number): GameState => ({
      ...game(),
      players: [
        { id: 'p1', number: 7, name: 'one', status: 'active', starter: true,
          stats: { ...zeroStats(), points: pts } },
        { id: 'p2', number: 9, name: 'two', status: 'active', starter: true,
          stats: { ...zeroStats(), points: other } },
        { id: 'p3', number: 4, name: 'three', status: 'bench', starter: false, stats: zeroStats() },
      ],
    });

    const subject = sheet(20, 4);
    const I = playerImpact(subject, [subject, sheet(10, 6), sheet(10, 8)]);
    assert.deepEqual(I.map((r) => r.id), ['p1', 'p2'], 'the bench that never played is not a row');
    assert.deepEqual(I.map((r) => r.number), [7, 9], "and the order is the GAME's, not a ranking");
    assert.equal(I[0].cells.find((c) => c.key === 'pts')!.subject, 20);
    assert.equal(I[0].cells.find((c) => c.key === 'pts')!.base, 10, 'their own two other games');
    assert.equal(I[0].baseGames, 2);
    assert.equal(I[1].cells.find((c) => c.key === 'pts')!.delta, -3);

    const alone = playerImpact(subject, [subject]);
    assert.equal(alone.length, 2, 'a first game keeps every row');
    assert.equal(alone[0].cells[0].base, null, 'with dashes where the baseline would be');
  }

  /* ---- POINTS BY PERIOD, and the shape that will not average --------
   * A half is not a quarter. The baseline is narrowed to the games played to
   * the same regulation, and a period nobody else reached prints a dash
   * rather than a zero — the other games did not score nothing in the
   * overtime, they never played one.
   * ------------------------------------------------------------------ */
  {
    const played = (q1: number, q2: number): GameState => {
      const g = game();
      A.recordShot(g, 'p1', at(396, 100), '2PT', true, null, null);
      for (let i = 2; i <= q1 / 2; i++) A.recordShot(g, 'p1', at(396, 100), '2PT', true, null, null);
      A.nextPeriod(g);
      for (let i = 1; i <= q2 / 2; i++) A.recordShot(g, 'p1', at(396, 100), '2PT', true, null, null);
      return g;
    };

    const subject = played(20, 10);
    const R = periodRows(subject, [subject, played(10, 10), played(10, 20)])!;
    assert.deepEqual(R.map((r) => r.label), ['Q1', 'Q2'], 'one row per period the game reached');
    assert.equal(R[0].subject, 20);
    assert.equal(R[0].base, 10, 'averaged over the games that reached that period');
    assert.equal(R[0].better, true);
    assert.equal(R[1].delta, -5);

    // A GAME PLAYED TO HALVES IS NOT IN THIS AVERAGE.
    const halves = { ...played(10, 10), periods: 2 };
    const only = periodRows(subject, [subject, halves])!;
    assert.equal(only[0].base, null, 'an H1 is not a Q1, so there is nothing to average');
    assert.equal(figure(only[0], only[0].base), '—');
  }
}

/* ---- after a timeout -----------------------------------------------
 * The one thing on this page the last game is compared with ITSELF over. It
 * is arithmetic on the log's own timeline, so all three of the ways that
 * arithmetic goes wrong are walked here: the window that runs past a buzzer,
 * the two timeouts whose windows overlap, and the basket that reads on the
 * very second the timeout was called.
 * ------------------------------------------------------------------ */
{
  const shot = (g: GameState, made: boolean) =>
    A.recordShot(g, 'p1', at(396, 200), '2PT', made, null, null);

  assert.equal(timeoutRun(game()), null, 'a game with no timeout has nothing to compare');
  assert.equal(AFTER_TIMEOUT, 120, 'two minutes of game clock, and it is the file that says so');

  /* ---- the two slices, and the rate over each ---------------------- */
  {
    const g = game();
    A.recordOppPoint(g, 2); // 10:00 — before any timeout, so it is the REST
    A.tickSeconds(g, 60);
    A.addTimeout(g); // 9:00, and the window is 9:00 → 7:00
    A.tickSeconds(g, 30);
    shot(g, true); // 8:30, inside it
    A.tickSeconds(g, 200);
    A.recordOppPoint(g, 3); // 5:10, outside it

    const r = timeoutRun(g)!;
    assert.equal(r.count, 1);
    assert.equal(r.afterSeconds, 120, 'the whole window fitted inside the quarter');
    assert.equal(r.restSeconds, 170, 'and the rest is every other second played');
    assert.equal(r.afterUs, 2);
    assert.equal(r.afterThem, 0);
    assert.equal(r.restUs, 0);
    assert.equal(r.restThem, 5, 'both opponent baskets fell outside the window');
    assert.equal(r.after, 1, 'two points in two minutes is +1.0 a minute');
    assert.equal(Math.round(r.rest! * 100) / 100, -1.76);
    assert.equal(r.better, true, 'and the team was better after the huddle');
  }

  /* ---- A WINDOW IS CUT SHORT BY ITS OWN BUZZER --------------------- */
  {
    const g = game();
    A.tickSeconds(g, 540);
    A.addTimeout(g); // 1:00 left in the first quarter
    A.tickSeconds(g, 60); // which runs out
    A.nextPeriod(g);
    A.tickSeconds(g, 120);

    const r = timeoutRun(g)!;
    assert.equal(
      r.afterSeconds,
      60,
      'a minute of window, not two: the huddle at the buzzer is a different huddle',
    );
    assert.equal(r.restSeconds, 660, 'and the second quarter belongs to the rest of the game');
  }

  /* ---- TWO TIMEOUTS CLOSE TOGETHER ARE ONE STRETCH ----------------- */
  {
    const g = game();
    A.tickSeconds(g, 60);
    A.addTimeout(g); // window 60 → 180
    A.tickSeconds(g, 30);
    A.addTimeout(g); // window 90 → 210, and the two overlap
    A.tickSeconds(g, 400);

    const r = timeoutRun(g)!;
    assert.equal(r.count, 2, 'both were called');
    assert.equal(r.afterSeconds, 150, 'and their shared minutes are counted once');
  }

  /* ---- THE BASKET THE TIMEOUT WAS CALLED OVER IS NOT ITS DOING ----- */
  {
    const g = game();
    A.tickSeconds(g, 60);
    A.recordOppPoint(g, 2); // 9:00 — the basket that emptied the bench
    A.addTimeout(g); // called on the same second
    A.tickSeconds(g, 300);

    const r = timeoutRun(g)!;
    assert.equal(r.afterThem, 0, 'the play the timeout answered belongs to the play before it');
    assert.equal(r.restThem, 2);
  }

  /* ---- and the labels the screen prints ---------------------------- */
  assert.equal(netLabel(null), '—', 'a rate that cannot be read is a dash, never a zero');
  assert.equal(netLabel(2), '+2');
  assert.equal(netLabel(-1.76), '-1.8', 'one decimal, the way it is drawn');
}

/* ---- what a stat is CALLED -----------------------------------------
 * One rule for the three panels that name one, so a foul kind and a tally can
 * never end up reading differently on the same board.
 * ------------------------------------------------------------------ */
{
  assert.equal(DEFAULT_OPTIONS.labels, 'full', 'a fresh install spells the word out');

  assert.deepEqual(
    tileWords('full', 'DF', 'Defensive'),
    { code: 'Defensive', word: true },
    'the word takes the big slot, and says so — a word cannot wear DF’s type size',
  );
  assert.deepEqual(
    tileWords('short', 'DF', 'Defensive'),
    { code: 'DF', word: false },
    'the abbreviation alone, with nothing under it',
  );
  assert.deepEqual(
    tileWords('both', 'DF', 'Defensive'),
    { code: 'DF', caption: 'Defensive', word: false },
    'and BOTH is the tile the board has always drawn',
  );

  // every pair the three panels pass, through every mode: the full word is
  // always reachable, and no mode can leave a tile with nothing on it
  const pairs: [string, string][] = [
    ...FOUL_MENU.map((k) => [FOUL_KINDS[k].short, FOUL_KINDS[k].label] as [string, string]),
    ...TALLY_TILES.map(([, abbr, word]) => [abbr, word] as [string, string]),
    ['DR', 'Defensive'],
    ['OR', 'Offensive'],
  ];
  for (const [short, full] of pairs) {
    assert.ok(short.length && full.length, `${short}/${full}: both halves are written`);
    for (const mode of ['short', 'full', 'both'] as const) {
      const w = tileWords(mode, short, full);
      assert.ok(w.code, `${short}/${full} in ${mode}: a tile is never blank`);
      assert.equal(
        w.code === full || w.caption === full || mode === 'short',
        true,
        `${short}/${full} in ${mode}: the word is on the tile unless SHORT was asked for`,
      );
    }
  }
}

/* ---- formatting --------------------------------------------------- */
assert.equal(mmss(600), '10:00');
assert.equal(mmss(59), '00:59');
assert.equal(ord(1), '1st');
assert.equal(ord(2), '2nd');
assert.equal(ord(3), '3rd');
assert.equal(ord(4), '4th');
assert.equal(ord(11), '11th');

/* ---- which board control stays lit --------------------------------- */
{
  assert.equal(litControl(null, null), null, 'nothing open, nothing lit');

  // the chain the quarter cell opens stays on the quarter cell
  assert.equal(litControl({ kind: 'endQuarter' }, null), 'quarter');
  assert.equal(litControl({ kind: 'setClock' }, null), 'quarter');
  assert.equal(litControl({ kind: 'endGame' }, null), 'quarter');

  // step 1 of each flow
  assert.equal(litControl({ kind: 'foulKind' }, null), 'pf');
  assert.equal(litControl({ kind: 'rebKind' }, null), 'rb');
  assert.equal(litControl({ kind: 'ftResult' }, 'ft'), 'ft');

  // step 2 is ONE panel for every flow — only the entry says whose it is
  assert.equal(litControl({ kind: 'who' }, 'foul'), 'pf');
  assert.equal(litControl({ kind: 'who' }, 'ft'), 'ft');
  assert.equal(litControl({ kind: 'who' }, 'oreb'), 'rb');
  assert.equal(litControl({ kind: 'who' }, 'dreb'), 'rb');
  assert.equal(litControl({ kind: 'who' }, 'made'), null, 'a shot came from the court');
  assert.equal(litControl({ kind: 'who' }, 'steal'), null, 'a tally came from a player panel');

  // the court's own panels light nothing on the board
  assert.equal(litControl({ kind: 'what' }, null), null);
  assert.equal(litControl({ kind: 'assist' }, 'made'), null);

  // the rail asks the other half of the question
  assert.equal(litPlayerId({ kind: 'playerActions', playerId: 'p3', bumped: null }), 'p3');
  assert.equal(litPlayerId({ kind: 'subOut', outId: 'p4' }), 'p4');
  assert.equal(litPlayerId({ kind: 'fouledOut', playerId: 'p5', fresh: true }), 'p5');
  assert.equal(litPlayerId({ kind: 'who' }), null, 'step 2 is a grid, not a row');
  assert.equal(litPlayerId(null), null);
}

/* ---- the quarters ------------------------------------------------
 * The whole game is the board's counters; a quarter is REBUILT from the log,
 * and nothing in the type system ties the two together. So: play a small game
 * across two periods and read both back.
 *
 * The floor and the clock are the two things no event counts, and they are
 * what the walk in `lib/box.ts` reconstructs — so they are what is asserted
 * hardest here.
 * ------------------------------------------------------------------ */
{
  const g = game();
  const paint = at(396, 100);
  const top3 = at(396, 500);

  // Q1: we score two in the paint, they answer with three, we take the lead
  // back from the top of the key, and the quarter then runs out.
  A.tickSeconds(g, 60);
  A.recordShot(g, 'p1', paint, '2PT', true, null, null);
  A.recordOppPoint(g, 3);
  A.tickSeconds(g, 60);
  A.recordShot(g, 'p12', top3, '3PT', true, null, null);
  A.tickSeconds(g, PERIOD_LEN - 120);
  assert.equal(g.remaining, 0, 'the quarter ran out');

  // Q2, thirty seconds in: p1 steals it and finishes at the other end.
  g.period = 2;
  g.remaining = PERIOD_LEN;
  A.tickSeconds(g, 30);
  A.recordTally(g, 'p1', null, 'steal');
  A.recordShot(g, 'p1', paint, '2PT', true, null, null);

  assert.deepEqual(periodsOf(g), [1, 2], 'both quarters are offered');

  // the against-half of the plus-minus, which is what makes it a plus-minus
  const p1 = A.byId(g, 'p1')!;
  assert.equal(p1.stats.onCourtPoints, 7, 'every point we scored, they were on for');
  assert.equal(p1.stats.onCourtOppPoints, 3, 'and every point against');
  assert.equal(plusMinus(p1.stats), 4);
  assert.equal(plusMinus(A.byId(g, 'p7')!.stats), 0, 'the bench is on for nothing');
  // four points and a steal, two of two, nothing wasted
  assert.equal(efficiency(p1.stats), 5);

  const q1 = linesFor(g, 1);
  const line = (ps: typeof q1, id: string) => ps.find((p) => p.id === id)!.stats;
  assert.equal(line(q1, 'p1').points, 2, 'the quarter keeps its own points');
  assert.equal(line(q1, 'p12').points, 3);
  assert.equal(line(q1, 'p1').steals, 0, "and not the next quarter's steal");
  assert.equal(line(q1, 'p1').secondsPlayed, PERIOD_LEN, 'a starter played all of it');
  assert.equal(line(q1, 'p7').secondsPlayed, 0, 'the bench played none of it');
  assert.equal(plusMinus(line(q1, 'p1')), 2, '5-3 in the first');

  const q2 = linesFor(g, 2);
  assert.equal(line(q2, 'p1').points, 2);
  assert.equal(line(q2, 'p1').steals, 1);
  assert.equal(line(q2, 'p1').secondsPlayed, 30, 'thirty seconds of the second');
  assert.equal(plusMinus(line(q2, 'p1')), 2, 'two unanswered');

  // the quarters add up to the whole game, which is the point of deriving
  // minutes from the same clock the ticker credits
  assert.equal(
    line(q1, 'p1').secondsPlayed + line(q2, 'p1').secondsPlayed,
    p1.stats.secondsPlayed,
    'the quarters and the counter tell the same story',
  );

  // a substitution moves a name, and the quarter's minutes move with it
  {
    const h = JSON.parse(JSON.stringify(g)) as GameState;
    A.substitute(h, 'p1', 'p7');
    A.tickSeconds(h, 30);
    const q = linesFor(h, 2);
    assert.equal(line(q, 'p1').secondsPlayed, 30, 'the one who came off keeps what they played');
    assert.equal(line(q, 'p7').secondsPlayed, 30, 'the one who came on gets the rest');
  }

  /* -- the scoreline ------------------------------------------------ */
  const marks = scoreline(g.events);
  assert.equal(marks.length, 5, 'four scores and the 0-0 they start from');
  assert.equal(marks[0].side, null, 'the seed belongs to neither team');

  const all = advancedFor(g, null, g.players);
  assert.equal(all.biggestLead, 4, '7-3 is the widest it got');
  assert.equal(all.oppBiggestLead, 1, 'and 2-3 the other way');
  assert.equal(all.biggestRun, 5, 'the three and the two ran together');
  assert.equal(all.oppBiggestRun, 3);
  assert.equal(all.leadChanges, 2, 'they went ahead, then we did');
  assert.equal(all.timesTied, 0, 'it was never level after the tip');
  assert.equal(all.timeAhead, 510, 'ahead from the go-ahead three to now');
  assert.equal(all.paint, 4, 'both twos were in the paint');
  assert.equal(all.fastBreak, 2, 'the steal was finished inside the window');
  assert.equal(all.offTurnovers, 2, 'the same basket, counted off the steal');
  assert.equal(all.secondChance, 0, 'nothing followed an offensive board');
  assert.equal(all.bench, 0);
  assert.equal(all.ppp, null, 'no possessions tapped, no points per possession');

  const first = advancedFor(g, 1, linesFor(g, 1));
  assert.equal(first.biggestLead, 2, 'the first quarter got no further ahead than two');
  assert.equal(first.biggestRun, 3, "and the run that did it was the three");
  assert.equal(first.timeAhead, 480, 'clipped at the end of the quarter');
  assert.equal(first.fastBreak, 0, 'the break was in the second');

  const second = advancedFor(g, 2, linesFor(g, 2));
  assert.equal(second.biggestLead, 4, 'a lead carried into a quarter is a lead held in it');
  assert.equal(second.biggestRun, 2, 'but a run is not carried in');
  assert.equal(second.leadChanges, 0);
  assert.equal(second.timeAhead, 30);

  /* -- what the screen actually reads ------------------------------- */
  const rAll = report(g, null);
  assert.equal(rAll.us, 7);
  assert.equal(rAll.them, 3);
  assert.equal(rAll.team.twom, 2, 'the two-point split is its own column');
  assert.equal(rAll.team.tpm, 1);
  assert.equal(rAll.team.sec > 0, true, 'the totals row carries minutes');

  const rOne = report(g, 1);
  assert.equal(rOne.us, 5, "a quarter's score is its own");
  assert.equal(rOne.them, 3);
  assert.equal(rOne.zones.paint.m, 1, 'and so are its zone splits');
  assert.equal(rOne.zones.top3.m, 1);

  assert.equal(shotsIn(g.events, 2).length, 1, 'one shot in the second');
  assert.equal(shotsIn(g.events, null).length, 3);

  // second chance: an offensive board, then a putback
  {
    const h = game();
    A.recordRebound(h, 'p1', null, 'offensive');
    A.recordShot(h, 'p1', paint, '2PT', true, null, null);
    assert.equal(advancedFor(h, null, h.players).secondChance, 2, 'the putback is second chance');
    A.recordShot(h, 'p1', paint, '2PT', true, null, null);
    assert.equal(
      advancedFor(h, null, h.players).secondChance,
      2,
      'the possession ended with the first one',
    );
  }
}

/* ---- the game flow -------------------------------------------------
 * The margin chart and the quarter table are two readings of one walk, and
 * both of them put NUMBERS ON A TIME AXIS — which is the one thing on these
 * screens that can be confidently, invisibly wrong. A clock corrected by hand,
 * a game nobody ran the clock for, an overtime: each one is a way for a
 * picture to end up drawn out of arithmetic that does not hold.
 * ------------------------------------------------------------------ */
{
  const paint = at(396, 100);
  const top3 = at(396, 500);

  const g = game();
  A.tickSeconds(g, 60);
  A.recordShot(g, 'p1', paint, '2PT', true, null, null); // 2-0 at 1:00
  A.tickSeconds(g, 60);
  A.recordOppPoint(g, 3); // 2-3 at 2:00
  A.tickSeconds(g, PERIOD_LEN - 120);
  g.period = 2;
  g.remaining = PERIOD_LEN;
  A.tickSeconds(g, 30);
  A.recordShot(g, 'p12', top3, '3PT', true, null, null); // 5-3 at 10:30

  /* -- the table ---------------------------------------------------- */
  const qs = periodScores(g);
  assert.deepEqual(
    qs.map((q) => [q.period, q.us, q.them]),
    [
      [1, 2, 3],
      [2, 3, 0],
    ],
    'each period keeps its own two figures',
  );
  assert.deepEqual(
    qs.map((q) => q.label),
    ['Q1', 'Q2'],
    'and the GAME says what a period is called',
  );
  assert.deepEqual(
    qs.map((q) => q.live),
    [false, true],
    'the period the game is standing in is the unfinished one',
  );
  assert.equal(
    qs.reduce((n, q) => n + q.us, 0),
    g.score,
    'the periods add up to the board',
  );
  assert.equal(
    qs.reduce((n, q) => n + q.them, 0),
    g.oppScore,
  );

  // A GAME PLAYED IN HALVES IS READ BACK IN HALVES, off the game and never off
  // the live setting — the same rule `periodLabel` is held to everywhere else.
  {
    const h = JSON.parse(JSON.stringify(g)) as GameState;
    h.periods = 2;
    assert.deepEqual(
      periodScores(h).map((q) => q.label),
      ['H1', 'H2'],
    );
  }

  // A FINISHED GAME HAS NO LIVE ROW, whichever period it stopped in.
  {
    const h = JSON.parse(JSON.stringify(g)) as GameState;
    h.ended = true;
    assert.deepEqual(
      periodScores(h).map((q) => q.live),
      [false, false],
    );
  }

  /* -- the chart ---------------------------------------------------- */
  const f = flowOf(g);
  assert.deepEqual(
    f.points.map((p) => [p.at, p.margin]),
    [
      [0, 0],
      [60, 2],
      [120, -1],
      [630, 2],
    ],
    'the seed, then one point per score, each at the second it happened',
  );
  assert.equal(f.end, 630, 'the game has got as far as the clock says');
  assert.deepEqual(f.bounds, [PERIOD_LEN], 'one buzzer has gone, and it is drawn');
  assert.equal(f.span, 2, 'the axis holds the biggest margin either way');
  assert.equal(f.timed, true);
  assert.equal(f.reconciled, true, 'the running total met the board');
  assert.equal(f.us, g.score);
  assert.equal(f.them, g.oppScore);

  // A CLOCK CORRECTED BACKWARDS DOES NOT REWIND THE WALK. The log's order is
  // the truth about what happened first; the clock is only roughly when.
  {
    const h = JSON.parse(JSON.stringify(g)) as GameState;
    const opp = h.events.find((e) => e.type === 'oppPoint')!;
    opp.gameClock = '09:59'; // one second in, behind the basket before it
    assert.deepEqual(
      flowOf(h).points.map((p) => p.at),
      [0, 60, 60, 630],
      'a stamp that would run backwards is held where the one before it was',
    );
  }

  // NO CLOCK, NO TIME AXIS. A scorer who never started the clock gets the
  // quarter table and no picture, rather than every basket stacked on zero.
  {
    const h = game();
    A.recordShot(h, 'p1', paint, '2PT', true, null, null);
    A.recordOppPoint(h, 2);
    assert.equal(flowOf(h).timed, false, 'nothing has a time to be drawn at');
    assert.equal(periodScores(h)[0].us, 2, 'and the table is unaffected by that');
  }

  // A CHART THAT WOULD END ON A SCORE THE GAME NEVER HELD IS NOT DRAWN.
  {
    const h = JSON.parse(JSON.stringify(g)) as GameState;
    h.score += 2;
    assert.equal(flowOf(h).reconciled, false);
  }

  /* -- the axis reads back ------------------------------------------ */
  assert.equal(stampOf(0, PERIOD_LEN, 4), 'Q1 10:00', 'the tip');
  assert.equal(stampOf(PERIOD_LEN, PERIOD_LEN, 4), 'Q1 00:00', 'the buzzer is its own quarter');
  assert.equal(stampOf(PERIOD_LEN + 1, PERIOD_LEN, 4), 'Q2 09:59', 'and the next second is not');
  assert.equal(stampOf(4 * PERIOD_LEN + 1, PERIOD_LEN, 4), 'OT 09:59', 'past regulation is OT');
  assert.equal(stampOf(300, PERIOD_LEN, 2), 'H1 05:00', 'halves, on a game played in halves');
}

/* ---- what stands out -----------------------------------------------
 * The only prose in the app, and therefore the only place it could tell a
 * scorer something the board never recorded. Every sentence is asserted
 * against the log that produced it, and both guards — the sample floor and the
 * cap — are asserted by building games that only just fail them.
 * ------------------------------------------------------------------ */
{
  const paint = at(396, 100);
  const top3 = at(396, 500);

  // NOTHING HAPPENED, SO NOTHING IS SAID. There is no least-uninteresting
  // fallback: a quiet game gets no card at all.
  {
    const q = game();
    A.recordShot(q, 'p1', paint, '2PT', true, null, null);
    A.recordOppPoint(q, 2);
    assert.deepEqual(observations(q), [], 'a quiet game says nothing');
  }

  /* -- a run, and where it was -------------------------------------- */
  {
    const g = game();
    A.recordShot(g, 'p1', paint, '2PT', true, null, null);
    g.period = 2;
    g.remaining = PERIOD_LEN;
    A.recordOppPoint(g, 3);
    A.recordOppPoint(g, 3);
    A.recordOppPoint(g, 3);

    assert.equal(runsOf(g).them.points, 9);
    assert.equal(runsOf(g).them.period, 2, 'the period the run got that long in');
    assert.equal(runsOf(g).us.points, 2);

    const [o] = observations(g);
    assert.equal(o.key, 'oppRun');
    assert.equal(o.text, 'The opponent scored 9 unanswered points in Q2.');
    assert.equal(o.split, 2, 'and it carries the quarter, which is the way in');

    // EIGHT IS THE BAR, AND SEVEN IS NOT NEWS.
    const h = game();
    A.recordOppPoint(h, 3);
    A.recordOppPoint(h, 2);
    A.recordOppPoint(h, 2);
    assert.deepEqual(observations(h), [], 'seven unanswered is a game, not a run');
  }

  /* -- where the turnovers came ------------------------------------- */
  {
    const g = game();
    A.recordTally(g, 'p1', null, 'turnover');
    A.recordTally(g, 'p12', null, 'turnover');
    g.period = 3;
    g.remaining = PERIOD_LEN;
    for (let i = 0; i < 4; i++) A.recordTally(g, 'p1', null, 'turnover');

    const [o] = observations(g);
    assert.equal(o.text, '4 of 6 turnovers came in Q3.', 'a count, and its denominator');
    assert.equal(o.split, 3);

    // FIVE TURNOVERS IS NOT ENOUGH TO ASK WHERE THEY WERE.
    const h = game();
    for (let i = 0; i < 5; i++) A.recordTally(h, 'p1', null, 'turnover');
    assert.deepEqual(observations(h), []);
  }

  /* -- the line ------------------------------------------------------ */
  {
    const g = game();
    for (let i = 0; i < 5; i++) A.recordFreeThrowTrip(g, 'p1', [true, false], false);
    const [o] = observations(g);
    assert.equal(o.text, 'Free throws: 5/10, with 5 misses.');
    assert.equal(o.split, null, 'a whole-game fact has no quarter to open');

    // NINE ATTEMPTS IS BELOW THE FLOOR, however they went.
    const h = game();
    for (let i = 0; i < 3; i++) A.recordFreeThrowTrip(h, 'p1', [false, false, false], false);
    assert.equal(h.players[0].stats.ftAttempted, 9);
    assert.deepEqual(observations(h), [], MIN_ATTEMPTS + ' attempts, or no sentence');
  }

  /* -- the two splits, and the sample each of them needs -------------- */
  {
    const g = game();
    for (let i = 0; i < 12; i++) A.recordShot(g, 'p1', paint, '2PT', i < 6, null, null);
    for (let i = 0; i < 10; i++) A.recordShot(g, 'p12', top3, '3PT', i < 2, null, null);

    const T = totals(g.players);
    assert.equal(T.twoa, 12);
    assert.equal(T.tpa, 10);
    const [o] = observations(g);
    assert.equal(
      o.text,
      'Three-pointers: 2/10; two-pointers: 6/12.',
      'both splits side by side, and no verdict about either',
    );

    // NINE THREES IS THE SAME NIGHT AND IS NOT A SENTENCE.
    const h = game();
    for (let i = 0; i < 12; i++) A.recordShot(h, 'p1', paint, '2PT', i < 6, null, null);
    for (let i = 0; i < 9; i++) A.recordShot(h, 'p12', top3, '3PT', i < 2, null, null);
    // it still put an unanswered run together, so the card is not empty — what
    // is missing is the SHOOTING sentence, which is the guard being the guard
    assert.deepEqual(
      observations(h).map((x) => x.key),
      ['ourRun'],
      'one attempt short of the floor is still short of the floor',
    );
  }

  /* -- the order, and the cap ---------------------------------------- */
  {
    const g = game();
    // their run, a bad night on the line, and our turnovers, all in one game
    A.recordOppPoint(g, 3);
    A.recordOppPoint(g, 3);
    A.recordOppPoint(g, 3);
    for (let i = 0; i < 5; i++) A.recordFreeThrowTrip(g, 'p1', [true, false], false);
    g.period = 2;
    g.remaining = PERIOD_LEN;
    for (let i = 0; i < 6; i++) A.recordTally(g, 'p1', null, 'turnover');

    assert.deepEqual(
      observations(g).map((o) => o.key),
      ['oppRun', 'turnovers', 'freeThrows'],
      'worst news first, and the order is a list rather than a score',
    );
    assert.equal(standouts(g).length, OBS_MAX, 'two of them print');
    assert.deepEqual(
      standouts(g).map((o) => o.key),
      ['oppRun', 'turnovers'],
    );
  }
}

/* ---- the sparse-sample floor ---------------------------------------
 * A percentage over four attempts is the loudest number any comparison can
 * produce, and it is not a fact about anybody's shooting. `MIN_ATTEMPTS` is
 * the guard; it applies to BOTH sides of the comparison, and to the RATE rows
 * alone — a team that scored twenty points scored twenty points.
 * ------------------------------------------------------------------ */
{
  const line = (over: Partial<Line>): Line => ({
    pts: 0, fgm: 0, fga: 0, twom: 0, twoa: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0,
    pm: 0, eff: 0, opp: 0, margin: 0,
    ...over,
  });

  // A HUGE MOVE ON FOUR SHOTS IS NOT A HIGHLIGHT.
  const thin = compare(line({ fgm: 3, fga: 4 }), [line({ fgm: 4, fga: 20 })]);
  const thinFg = thin.rows.find((r) => r.key === 'fg')!;
  assert.equal(thinFg.subjectDen, 4, 'the row remembers what it was made of');
  assert.equal(thinFg.baseDen, 20);
  assert.ok((thinFg.delta ?? 0) > 30, 'and the move really is enormous');
  assert.deepEqual(
    thin.highlights.map((h) => h.key),
    [],
    'four attempts say nothing about shooting',
  );

  // NOR IS ONE MEASURED AGAINST A BASELINE THAT BARELY SHOT.
  const noBase = compare(line({ fgm: 8, fga: 20 }), [line({ fgm: 2, fga: 4 })]);
  assert.deepEqual(
    noBase.highlights.map((h) => h.key),
    [],
  );

  // WITH BOTH SIDES OVER THE FLOOR IT IS A HIGHLIGHT AGAIN.
  const solid = compare(line({ fgm: 12, fga: 20, twom: 12, twoa: 20 }), [
    line({ fgm: 8, fga: 20, twom: 8, twoa: 20 }),
  ]);
  assert.ok(
    solid.highlights.some((h) => h.key === 'fg'),
    'twenty attempts either side is a reading',
  );
  assert.equal(solid.rows.find((r) => r.key === 'fg')!.subjectDen, 20);

  // THE GUARD IS THE RATE ROWS' ALONE. A counting stat is its own sample.
  const counts = compare(line({ pts: 20, fga: 2, fgm: 1 }), [line({ pts: 10, fga: 2, fgm: 1 })]);
  assert.deepEqual(
    counts.highlights.map((h) => h.key),
    ['pts'],
  );
  assert.equal(
    counts.rows.find((r) => r.key === 'pts')!.subjectDen,
    null,
    'a count has no denominator to guard',
  );

  // eFG COUNTS A THREE AS ONE AND A HALF, on the table as in `lib/stats.ts`.
  {
    const efgRow = compare(line({ fgm: 4, fga: 8, tpm: 2, tpa: 4 }), []).rows.find(
      (r) => r.key === 'efg',
    )!;
    assert.equal(efgRow.subject, 62.5, 'four makes of eight, two of them threes: (4 + 1) / 8');
  }
  assert.equal(efgValue(totals([])), null, 'no attempts, no percentage');
  assert.equal(efg(totals([])), '-');
  {
    const g = game();
    for (let i = 0; i < 4; i++) A.recordShot(g, 'p1', at(396, 100), '2PT', i < 2, null, null);
    for (let i = 0; i < 4; i++) A.recordShot(g, 'p12', at(396, 500), '3PT', i < 2, null, null);
    // four makes of eight, two of them threes: (4 + 1) / 8
    assert.equal(efgValue(totals(g.players)), 62.5);
    assert.equal(efg(totals(g.players)), '62.5%');
  }
}

/* ---- the exported sheet --------------------------------------------
 * `lib/pdf.ts` prints a game onto paper, and paper is the one output nobody
 * can go back and fix. It is a pure function over a GameState precisely so it
 * can be run here: play a short game, render it, and read the sheet back.
 *
 * The three things asserted are the three that would be silently wrong. THE
 * NUMBERS ON IT ARE THE SCREEN'S — same `report()`, so the sheet cannot drift
 * from the tab the button sits on. THE PERIOD LINE ADDS UP to the game's own
 * score, because it is a second walk over the log and not the board's counter.
 * And EVERY TYPED STRING IS ESCAPED: a club name is free text, and a sheet is
 * assembled by concatenation.
 * ------------------------------------------------------------------ */
{
  const g = game();
  g.team.name = 'KHÁNH HÒA <b>';
  g.opponent = 'SƠN LA';
  g.competition = 'VBA 2026';
  g.note = 'round 12';

  A.tickSeconds(g, 60);
  A.recordShot(g, 'p1', at(396, 100), '2PT', true, 'p12', null);
  A.recordOppPoint(g, 3);
  A.recordFreeThrowTrip(g, 'p12', [true, false], false);
  A.nextPeriod(g);
  A.tickSeconds(g, 30);
  A.recordShot(g, 'p12', at(396, 500), '3PT', false, null, null);
  A.recordRebound(g, 'p1', null, 'offensive');

  const qs = periodScores(g);
  assert.deepEqual(
    qs.map((q) => [q.period, q.us, q.them]),
    [
      [1, 3, 3],
      [2, 0, 0],
    ],
    'the period line is walked off the log, both sides of it',
  );
  assert.equal(
    qs.reduce((n, q) => n + q.us, 0),
    g.score,
    'and the quarters add up to the score the board kept',
  );

  const html = gameReportHtml(g, Date.UTC(2026, 7, 19, 12, 0));

  assert.ok(html.includes('KHÁNH HÒA &lt;b&gt;'), 'a typed name is escaped, never injected');
  assert.ok(!html.includes('KHÁNH HÒA <b>'), 'and the raw markup does not survive anywhere');
  assert.equal(reportTitle(g), 'VBA 2026', 'an official game is filed under its competition');
  assert.equal(reportTitle({ ...g, kind: 'practice' }), 'Practice', 'a practice is filed as one');

  // the numbers are the screen's, not a second derivation
  const rep = report(g, null);
  assert.ok(html.includes(`>${rep.us}</span>`), 'the headline score is the report’s own');
  assert.ok(html.includes('Paint'), 'every zone is named in the table');
  assert.ok(html.includes('Top 3'), 'the empty ones included — 0/0 is a fact');
  assert.ok(html.includes('DNP'), 'a player who never took the floor says so');
  // The requested chart uses the shared court; notes and play log stay absent.
  assert.ok(html.includes('<svg'), 'the match sheet includes its shot chart');
  assert.ok(!html.includes('class="legend"'), 'the old notes block is removed');
  assert.ok(html.includes('<path'), 'the chart carries court line work');
  assert.ok(!html.includes('Play by play'), 'the play log is off the sheet');
  assert.ok(!html.includes('3PT MISSED'), 'so no play line survives on it');

  assert.equal(
    reportFileName({ ...g, team: { name: 'KHÁNH HÒA' } }, Date.UTC(2026, 7, 19, 12, 0)),
    `HOOPLOG-KHANH-HOA-vs-SON-LA-${new Date(Date.UTC(2026, 7, 19, 12, 0)).getDate()}-08-2026.pdf`,
    'diacritics are folded, not dropped — the file has to be recognisable in a list',
  );
}

/* ---- the fill ends on a drawn line ---------------------------------
 * `ZONE_PATHS` carries `zoneFor`'s partition a second time, as eleven closed
 * paths, and nothing in the type system ties the two together. So: rasterise
 * the real `d` strings out of `lib/court.ts` and assert all 412,632 cells of
 * the viewBox resolve to exactly the zone `zoneFor` names — no gap, no
 * overlap, no drift. Move one vertex and it names the first cell to disagree.
 *
 * They are read out of the SOURCE rather than imported, because what is being
 * checked is the text a human edits: an import would only prove the array
 * agrees with itself.
 *
 * It samples at (px + 0.31, py + 0.27) rather than at the pixel centre. Every
 * boundary here is integer, y = 203.7, or a line of slope 123/245, and a
 * centre lands EXACTLY on one of them often enough to matter — an exact tie is
 * decided by `<=` on one side and by the scanline's edge rule on the other,
 * which is noise, not drift. No sample at this offset can sit on a boundary.
 * -------------------------------------------------------------------- */
{
  const W = 792, H = 521, BX = 396, BY = 76, R = 352;
  const art = readFileSync(join(process.cwd(), 'lib', 'court.ts'), 'utf8');
  const svg = readFileSync(join(process.cwd(), 'components', 'board', 'CourtSvg.tsx'), 'utf8');

  const paths = [...art.matchAll(/\{ zone: '(\w+)', side: '(\w)', d: '([^']+)' \}/g)];
  assert.equal(paths.length, 11, 'ZONE_PATHS should carry one closed path per zone');

  // Every arc in those strings is the three-point arc, so it is centred on the
  // basket and the sweep flag is all that is needed to walk one: 1 = increasing
  // angle (clockwise on a y-down screen), 0 = decreasing.
  const flatten = (d: string) => {
    const pts: [number, number][] = [];
    let cur: [number, number] = [0, 0];
    for (const [, op, raw] of d.matchAll(/([MLA])([-\d. ]+)/g)) {
      const n = raw.trim().split(/\s+/).map(Number);
      if (op !== 'A') {
        cur = [n[0], n[1]];
        pts.push(cur);
        continue;
      }
      const to: [number, number] = [n[5], n[6]];
      let a0 = Math.atan2(cur[1] - BY, cur[0] - BX);
      let a1 = Math.atan2(to[1] - BY, to[0] - BX);
      if (n[4] === 1) while (a1 < a0) a1 += 2 * Math.PI;
      else while (a1 > a0) a1 -= 2 * Math.PI;
      for (let i = 1; i <= 2000; i++) {
        const a = a0 + ((a1 - a0) * i) / 2000;
        pts.push([BX + R * Math.cos(a), BY + R * Math.sin(a)]);
      }
      cur = to;
    }
    return pts;
  };

  const grid: string[] = new Array(W * H).fill('');
  for (const [, z, s, d] of paths) {
    const poly = flatten(d);
    for (let py = 0; py < H; py++) {
      const y = py + 0.27;
      const xs: number[] = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const lo = Math.max(0, Math.ceil(xs[k] - 0.31));
        const hi = Math.min(W - 1, Math.floor(xs[k + 1] - 0.31));
        for (let px = lo; px <= hi; px++) {
          const i = py * W + px;
          grid[i] = grid[i] ? `${grid[i]}+${z}|${s}` : `${z}|${s}`;
        }
      }
    }
  }

  let drift = 0;
  let first = '';
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const nx = (px + 0.31) / W, ny = (py + 0.27) / H;
      const z = zoneFor(nx, ny);
      const want = `${z}|${zoneSide(z, nx)}`;
      const got = grid[py * W + px];
      if (got === want) continue;
      drift++;
      if (!first) first = `(${px}, ${py}) is ${want} but the SVG paints ${got || 'nothing'}`;
    }
  }
  assert.equal(drift, 0, `CourtSvg has drifted off zoneFor on ${drift} of ${W * H} cells — ${first}`);

  // And the drawing itself: every line the partition is cut on must still be
  // painted. These are the strings zoneFor's constants were read off — they
  // live in COURT_LINES now, and both renderers draw that list rather than a
  // copy, so the component is checked for the READ rather than for the strings.
  for (const d of [
    'M277 0 L277 276 M513 0 L513 276', // the lane
    'M277 276 L513 276', // the free-throw line
    'M68 101 L277 101', // the 2PT corner cut, both ends
    'M513 101 L724 101',
    'M0 203.7 L68 203.7', // the 3PT corner cut, both ends
    'M724 203.7 L792 203.7',
    'M310 276 L187 521', // the lane extensions
    'M480 276 L603 521',
    'M68 0 L68 203.7 A352 352 0 0 0 724 203.7 L724 0', // the three-point line
  ])
    assert.ok(art.includes(`'${d}'`), `the court no longer draws ${d} — a zone edge lost its line`);
  for (const name of ['ZONE_PATHS', 'COURT_LINES'])
    assert.ok(svg.includes(name), `CourtSvg should draw ${name}, not a second copy of it`);
}

/* ---- the shelf, filtered ---------------------------------------------
 * MATCHES is a FLAT list again — no day headings, no groups, no practice run.
 * The one derivation left is the strip at the top of it, and it is here rather
 * than in the screen so this can exercise it without React.
 * -------------------------------------------------------------------- */
{
  const at = (d: number): number => new Date(2026, 7, d, 19, 30).getTime();
  const row = (id: string, d: number, kind: 'practice' | 'official'): GameSummary => ({
    id,
    endedAt: at(d),
    score: kind === 'official' ? 64 : 0,
    oppScore: kind === 'official' ? 16 : 0,
    periods: 4,
    kind,
    competition: kind === 'official' ? 'HBL' : '',
    opponent: kind === 'official' ? 'CCV' : '',
  });

  const index: GameSummary[] = [
    row('a', 25, 'practice'),
    row('b', 25, 'practice'),
    row('c', 25, 'official'),
    row('d', 21, 'official'),
    row('e', 19, 'practice'),
  ];

  // ALL is the identity, and it is the identity by REFERENCE — the shelf's own
  // order is the index's, and re-deriving it would be a second array to keep
  // in step with a store that already guarantees newest-first
  assert.equal(filterIn(index, 'all'), index, 'ALL hands the index straight back');

  assert.deepEqual(
    filterIn(index, 'official').map((g) => g.id),
    ['c', 'd'],
    'OFFICIAL keeps the matches, in shelf order',
  );
  assert.deepEqual(
    filterIn(index, 'practice').map((g) => g.id),
    ['a', 'b', 'e'],
    'and PRACTICE keeps the rest, likewise',
  );
  assert.equal(
    filterIn(index, 'official').length + filterIn(index, 'practice').length,
    index.length,
    'the two slices partition the shelf: nothing is dropped and nothing is counted twice',
  );

  // a row written before the two kinds existed is OFFICIAL, here as everywhere
  const old: GameSummary = { id: 'f', endedAt: at(1), score: 50, oppScore: 40, periods: 4 };
  assert.deepEqual(
    filterIn([old], 'official').map((g) => g.id),
    ['f'],
    'a kindless row filters as the official game the season already counted it as',
  );
  assert.equal(filterIn([old], 'practice').length, 0);

  // THE ROW'S DATE IS DIGITS, and it stayed digits: the spelled-month heading
  // went with the grouping that was its only caller
  assert.equal(dayMonthLabel(at(19)), '19/08');
}

/* ---- styling guards ------------------------------------------------
 * Three greps over the component tree. They are here rather than in a linter
 * because each one encodes a bug that shipped: the symptom was always "some of
 * the CSS made it across and some did not", which no type can catch.
 * -------------------------------------------------------------------- */
{
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
    });

  // `app/` is scanned too: the routes are components, and the three traps
  // below are exactly as easy to fall into on a home screen as on the board
  const files = ['components', 'app']
    .flatMap((dir) => walk(join(process.cwd(), dir)))
    .map((f) => ({ path: relative(process.cwd(), f), src: readFileSync(f, 'utf8') }));
  assert.ok(files.length > 20, 'the component tree should be found from the project root');
  assert.ok(
    files.some((f) => f.path === join('app', '(tabs)', 'index.tsx')),
    'and the routes with it, tab group included',
  );

  // 1. Function styles. NativeWind's interop walks the ["style", …] path with
  //    `if (typeof parent[prop] !== "object") parent[prop] = {}` — a function is
  //    not an object, so the ENTIRE style is replaced with {} and every rule in
  //    it vanishes silently. Use components/ui/Press instead.
  for (const f of files) {
    if (f.path.endsWith(join('ui', 'Press.tsx'))) continue; // documents the trap
    assert.ok(
      !f.src.includes('style={({'),
      `${f.path}: function style prop — NativeWind deletes it. Use <Press style={} pressedStyle={} />`,
    );
  }

  // 2. Raw Pressables, which is how a function style gets reintroduced.
  const RAW_PRESSABLE_OK = [
    join('components', 'board', 'Court.tsx'), // needs the touch event for locationX/Y
    join('components', 'panels', 'PanelHost.tsx'), // the scrim
    join('components', 'ui', 'Press.tsx'),
  ];
  for (const f of files) {
    if (RAW_PRESSABLE_OK.includes(f.path)) continue;
    assert.ok(
      !/\bPressable\b/.test(f.src),
      `${f.path}: imports Pressable directly — use components/ui/Press`,
    );
  }

  // 3. Inverted surfaces. A rule that sets BOTH a background and a colour must
  //    carry both across; keeping the ink and dropping the fill is how MADE and
  //    SUBSTITUTE became dark-on-dark.
  const INK_FOR: Record<string, string> = {
    't.ink': 't.surface',
    't.ink2': 't.surface',
    't.accent': 't.accentInk',
    't.danger': 't.dangerInk',
  };
  const FILL = /backgroundColor:\s*(?:[^,\n]*?)(t\.(?:ink2|ink|accentInk|accent|danger))\b/g;
  // the three files whose fills are CHART MARKS rather than surfaces: a shot
  // dot, a free-throw dot and a zone's heat have no ink to lose because they
  // have nothing written inside them
  const NO_TEXT_INSIDE = [
    join('components', 'board', 'Court.tsx'), // the live mark is a dot
    join('components', 'stats', 'ZonesTab.tsx'), // shot dots, the zone heat, its scale
    join('components', 'ui', 'Dot.tsx'), // the availability dot, likewise
    // the door's two accent MARKS: the progress row, which is one dot per step
    // with the current one drawn as a bar, and the 2px rule under the club
    // field that turns accent once the name is good. Neither has anything
    // written inside it. This file passed the guard by accident until the
    // numbered `Badge` was cut with the board step's list of four lines — it
    // was the only thing here that ever set `accentInk`.
    join('components', 'intro', 'parts.tsx'),
    join('components', 'ui', 'Slug.tsx'), // the lobby's accent rule: a ground, not a mark
    join('app', 'player', '[id].tsx'), // shot dots on court
    // the walkthrough's finger: a contact dot and a ripple ring, which are
    // marks in the same sense a shot dot is — nothing is written inside either
    join('components', 'tutorial', 'Finger.tsx'),
  ];
  for (const f of files) {
    if (NO_TEXT_INSIDE.includes(f.path)) continue;
    for (const [, fill] of f.src.matchAll(FILL)) {
      const ink = INK_FOR[fill];
      if (!ink) continue;
      assert.ok(
        f.src.includes(ink),
        `${f.path}: fills with ${fill} but never sets ${ink} — inverted surface missing its ink`,
      );
    }
  }

  /* 4. FIXED-WIDTH NUMERIC COLUMNS, HELD TO WHAT THEY HAVE TO HOLD.
   *
   * Every numeric cell on the stats screens states its width in em of its own
   * type size, and for a long time each of those numbers was an eye rather
   * than a measurement. The eye is wrong about one glyph in particular:
   * INTER'S PERCENT SIGN IS A FULL EM, half again as wide as one of its
   * digits, so a column sized for `12.5` has no room for `100%`. Six of them
   * were short — the zones' Pct, and all four of the comparison table's — and
   * the symptom was a percentage printed with an ellipsis where its last digit
   * belonged, on every device the app runs on.
   *
   * So the constants are grepped out of the components and checked against
   * `theme/figures.ts`, which is Inter's own advances. It is a grep for the
   * same reason the other three are: these are `.tsx` and this file runs under
   * plain node, with no React and no device.
   *
   * A cell whose FONT SIZE is a step up from the row it sits in pays for that
   * here too — the comparison table's Game column is set at `fsMd` inside a
   * width stated in `fsSm`, and the ramp opens that gap to 1.28 in the middle
   * of its range, which is `RAMP_MAX` below.
   */
  const RAMP_MAX = 2.15 / 1.68; // the widest fsMd : fsSm the ramp reaches

  /** [file, constant, the widest string it holds, weight, tracking, size factor] */
  const COLUMNS: [string, string, string, FigWeight, number, number][] = [
    // the comparison table — `lib/analysis.ts` prints every one of these
    [join('components', 'stats', 'Compare.tsx'), 'W_LAST', '100%', 700, LS_TIGHT, RAMP_MAX],
    [join('components', 'stats', 'Compare.tsx'), 'W_LAST', '-23.4', 700, LS_TIGHT, RAMP_MAX],
    [join('components', 'stats', 'Compare.tsx'), 'W_AVG', '-100.0', 500, 0, 1],
    [join('components', 'stats', 'Compare.tsx'), 'W_AVG', '100%', 500, 0, 1],
    [join('components', 'stats', 'Compare.tsx'), 'W_DELTA', '+100 pts', 600, 0, 1],
    [join('components', 'stats', 'Compare.tsx'), 'W_DELTA', '-12.34', 600, 0, 1],
    // the ratio cell is set at 0.86 of the row's size, which is its factor
    [join('components', 'stats', 'Compare.tsx'), 'W_RATIO', '+999%', 500, 0, 0.86],
    [join('components', 'stats', 'Compare.tsx'), 'W_RATIO', '-100%', 500, 0, 0.86],
  ];

  const byPath = new Map(files.map((f) => [f.path, f.src]));
  for (const [path, name, widest, weight, tracking, factor] of COLUMNS) {
    const src = byPath.get(path);
    assert.ok(src, `${path}: not found — the column guard is pointing at nothing`);
    const found = new RegExp(`const ${name} = ([0-9.]+);`).exec(src!);
    assert.ok(found, `${path}: ${name} is gone or is no longer a plain number`);
    const need = figEm(widest, weight, tracking) * factor;
    assert.ok(
      Number(found![1]) >= need,
      `${path}: ${name} is ${found![1]}em and "${widest}" wants ${need.toFixed(3)}em — it will print an ellipsis`,
    );
  }

  // The two columns written at their call site rather than as a constant.
  const zones = byPath.get(join('components', 'stats', 'ZonesTab.tsx'))!;
  assert.ok(
    /width: fs \* ([0-9.]+),[\s\S]{0,400}\{pctText\}/.test(zones),
    'ZonesTab: the Pct column is no longer `width: fs * n`',
  );
  const zonePct = Number(/width: fs \* ([0-9.]+),[\s\S]{0,400}\{pctText\}/.exec(zones)![1]);
  assert.ok(
    zonePct >= figEm('100%', 500),
    `ZonesTab: the Pct column is ${zonePct}em and "100%" wants ${figEm('100%', 500).toFixed(3)}em`,
  );

  const parts = byPath.get(join('components', 'stats', 'parts.tsx'))!;
  const lineSub = Number(/width: m\.fsSm \* ([0-9.]+),[\s\S]{0,400}\{sub \?\? ''\}/.exec(parts)![1]);
  assert.ok(
    lineSub >= figEm('100%', 500),
    `parts.tsx: Line's sub column is ${lineSub}em and "100%" wants ${figEm('100%', 500).toFixed(3)}em`,
  );

  // AND THE TILE, WHICH IS THE OTHER SHAPE: it has no stated width, so it
  // measures itself and steps down the ramp. What is asserted is that it still
  // does — a tile that goes back to a flat `m.fsXl` clips `100%` three across.
  assert.ok(
    /figFit\(/.test(parts),
    'parts.tsx: Tile no longer fits its value — a long figure will clip',
  );
}

/* ------------------------------------------------------- the paywall ----- */
{
  /**
   * THE GATE TABLE, WALKED RATHER THAN LISTED.
   *
   * `lib/billing.ts` is a plain module for exactly this: the rule that decides
   * whether somebody can use what they paid for is the last one that should be
   * testable only by installing the app and buying something.
   */

  // PAYING OPENS EVERYTHING. Walked over every gate, so a gate added later
  // cannot quietly stay shut for a subscriber.
  for (const g of GATES) {
    assert.equal(locked(g, { entitled: true, trialUsed: false }), false, `paid but ${g} locked`);
    assert.equal(locked(g, { entitled: true, trialUsed: true }), false, `paid but ${g} locked`);
  }

  // A FRESH INSTALL MAY START ITS ONE GAME, and may do nothing else.
  const fresh = { entitled: false, trialUsed: false };
  assert.equal(locked('newGame', fresh), false, 'the free game is not free');
  assert.equal(locked('season', fresh), true);
  assert.equal(locked('export', fresh), true);
  assert.equal(locked('deepStats', fresh), true);

  // ONCE THE FREE GAME IS FILED, EVERY GATE IS SHUT.
  const spent = { entitled: false, trialUsed: true };
  for (const g of GATES) assert.equal(locked(g, spent), true, `${g} open after the trial`);

  // `newGame` IS THE ONLY GATE THE TRIAL MOVES. If a second one ever becomes
  // conditional this fails, which is the point: the trial is one game, and a
  // second thing that switches on it is a second rule nobody wrote down.
  const moves = GATES.filter((g) => locked(g, fresh) !== locked(g, spent));
  assert.deepEqual(moves, ['newGame'], 'the trial moves a gate it should not');

  // EVERY GATE HAS A LINE TO SHOW, or the paywall opens with nothing to say
  // about why it opened.
  for (const g of GATES) {
    assert.ok(GATE_PITCH[g] && GATE_PITCH[g].length > 0, `${g} has no pitch`);
  }

  // DONG, GROUPED FROM THE RIGHT. The bug this catches is grouping from the
  // LEFT, which is correct for six digits and wrong for every other length.
  assert.equal(vnd(99_000), '99.000₫');
  assert.equal(vnd(999_000), '999.000₫');
  assert.equal(vnd(0), '0₫');
  assert.equal(vnd(1_000_000), '1.000.000₫');
  assert.equal(vnd(83_250), '83.250₫');

  // THE YEARLY CARD'S SECOND READING IS DERIVED, so it cannot drift from the
  // price above it.
  const yearly = PLANS.find((p) => p.key === 'yearly');
  assert.ok(yearly && yearly.note === vnd(Math.round(yearly.price / 12)) + ' a month');

  // ONE BADGE ON ONE CARD. Two would be two best offers.
  assert.equal(PLANS.filter((p) => p.badge).length, 1, 'more than one plan is flagged');
  assert.ok(PLANS.some((p) => p.key === DEFAULT_PLAN), 'the default plan is not on the screen');

  // THE BENEFITS ARE THREE AND EACH HAS A BOLD NOUN — the device that makes
  // three short lines scannable rather than three sentences.
  assert.equal(BENEFITS.length, 3);
  for (const b of BENEFITS) assert.ok(b.bold.length > 0 && b.icon.length > 0);
}

/* ------------------------------------------------------------ the door ----
 * `constants/intro.ts` is a copy table and `constants/options.ts` is the four
 * answer tables the settings page and the door now share. Both are plain data
 * for exactly this: the steps a scorer walks once per install are the
 * screens nobody re-opens to check, so what holds them is a script rather than
 * somebody remembering to reinstall the app.
 * -------------------------------------------------------------------- */
{
  // FOUR STEPS, AND EVERY ONE OF THEM HAS SOMETHING TO SAY. The dots are drawn
  // off `INTRO_STEPS`, so a step added without copy is a blank screen with a
  // live button on it — and a step REMOVED without its copy going too is a
  // table with an orphan in it, which is how the rules step would have lingered.
  assert.equal(INTRO_STEPS.length, 4, 'the door is four steps');
  assert.equal(
    Object.keys(INTRO_COPY).length,
    INTRO_STEPS.length,
    'the copy table and the door disagree about how many steps there are',
  );
  assert.equal(new Set(INTRO_STEPS).size, INTRO_STEPS.length, 'and each is named once');
  for (const step of INTRO_STEPS) {
    const c = INTRO_COPY[step];
    assert.ok(c, `${step} has no copy`);
    assert.ok(c.title.length > 0, `${step} has no title`);
    assert.ok(c.blurb.length > 0, `${step} has no sentence under it`);
  }

  // THE LIT HALF IS THE TWO STEPS THAT ASK FOR NOTHING. `hi` is a second line
  // of headline painted with `glowInk`; the three steps that carry a form
  // underneath must not have one, or the question is competing with the answer.
  const lit = INTRO_STEPS.filter((s) => INTRO_COPY[s].hi);
  assert.deepEqual(lit, ['board', 'trial'], 'the wrong steps are shouting');

  // THE THIRD STEP OPENS THE BOARD RATHER THAN EXPLAINING IT, and what it is
  // lit for is the INVITATION — the tour is two minutes and the sentence under
  // the headline has to say so. `BOARD_STEPS` and the four numbered lines were
  // cut with the page: the walkthrough teaches the same four by having the
  // scorer do them. Nothing asserts the handoff itself, because it is a `push`
  // and a `begin` inside a component; what IS held here is that the step is
  // still named, still lit, and still one of the two that ask for nothing.
  assert.ok(INTRO_STEPS.includes('board'), 'the door lost its way onto the board');

  // THREE THINGS THE FREE GAME GIVES, each with a glyph and a line. Three
  // because the paywall's own list is three: the two sit one tap apart on the
  // last step and are read against each other.
  assert.equal(TRIAL_GIVES.length, BENEFITS.length, 'the trial and the offer count differently');
  for (const g of TRIAL_GIVES) {
    assert.ok(g.icon.length > 0 && g.title.length > 0 && g.blurb.length > 0);
  }
  // AND THEY ARE NOT THE SAME THREE. One list says what is already yours and
  // the other sells the subscription; saying one sentence twice one tap apart
  // makes it mean less on both.
  for (const g of TRIAL_GIVES) {
    assert.ok(
      !BENEFITS.some((b) => b.bold === g.title),
      `the trial and the paywall both claim "${g.title}"`,
    );
  }

  // THE FOUR ANSWER TABLES ARE THE OPTION'S OWN RANGE, WHOLE. `app/settings.tsx`
  // is the only screen that reads them since the door's rules step was cut, and
  // the failure they are here to catch is a length or a period count that
  // exists in the type and is offered by nothing.
  assert.deepEqual(PERIOD_CHOICES.map((c) => c.key), [2, 4], 'basketball has two shapes');
  assert.deepEqual(
    LENGTH_CHOICES.map((c) => c.key),
    [360, 480, 600, 720],
    'six to twelve minutes, youth to NBA',
  );
  assert.ok(PERIOD_CHOICES.some((c) => c.key === DEFAULT_OPTIONS.periods));
  assert.ok(LENGTH_CHOICES.some((c) => c.key === DEFAULT_OPTIONS.periodLen));
  assert.ok(LABEL_CHOICES.some((c) => c.key === DEFAULT_OPTIONS.labels));
  assert.ok(BOARD_CHOICES.some((c) => c.key === DEFAULT_OPTIONS.board));
  assert.ok(POSS_CHOICES.some((c) => c.key === DEFAULT_OPTIONS.poss));
  // A FRESH BOARD COUNTS TIMEOUTS AND NOTHING ELSE on that cell. The footer is
  // the one row where a setting adds a control rather than changing one, and
  // the quieter board is the default — see `Options.poss`.
  assert.equal(DEFAULT_OPTIONS.poss, 'off', 'the fourth cell opens whole');

  // WHAT THE TWO STAMPED SWITCHES ADD UP TO, and it is DERIVED — the door
  // prints it under the segments and again on the way past them, so a typed
  // string would be two chances to disagree with the switches above it.
  assert.equal(shapeLabel(4, 600), '4 × 10:00', 'the default night');
  assert.equal(shapeLabel(2, 720), '2 × 12:00');
  assert.equal(shapeLabel(4, 360), '4 × 6:00');
}

/* ----------------------------------------------------- the walkthrough ----
 * `constants/tutorial.ts` is a script and `lib/tutorial.ts` is its rulebook,
 * and both are plain data and plain functions for exactly this reason: the
 * twenty steps a scorer walks over the real board are the screens NOBODY
 * re-opens to check. A step that can never be finished, a ring pointing at a
 * name nothing reports, or a caption that talks about the app's own insides is
 * caught here rather than by somebody two minutes into a tour on a phone.
 * -------------------------------------------------------------------- */
{
  /* -- the script itself -------------------------------------------- */

  assert.ok(TUTORIAL_STEPS.length > 0, 'the tour has no steps');
  assert.equal(
    new Set(TUTORIAL_STEPS.map((s) => s.id)).size,
    TUTORIAL_STEPS.length,
    'two steps share an id — `lastStep` remembers one and lands on the other',
  );

  /**
   * THE COPY RULES, ENFORCED. A STEP IS A TITLE AND NOTHING ELSE — the meaning
   * line under it and the instruction that swapped in after six idle seconds
   * are both gone — so the whole of what a card says has to sit on two lines of
   * `fsLg` and carry NO IMPLEMENTATION VOCABULARY: a scorer does not know what
   * a panel is and should never have to.
   */
  const BANNED = ['panel', 'state', 'store', 'render', 'component', 'props', 'array'];
  for (const step of TUTORIAL_STEPS) {
    assert.ok(step.title.length > 0, `${step.id} has no title`);
    assert.ok(step.title.split(' ').length <= 5, `${step.id}: the title is a sentence`);
    const said = step.title.toLowerCase();
    for (const word of BANNED) {
      assert.ok(!said.includes(word), `${step.id} says "${word}" — the app talking about itself`);
    }
  }

  // AND NO TWO OF THEM SAY THE SAME THING. With the meaning line gone the title
  // IS the card, so two steps sharing one are two identical screens and a
  // scorer who has just been moved on cannot tell that anything happened. The
  // branch pairs are held to it as well: only one of a pair is ever in a tour,
  // but a pair allowed to agree is a pair nobody has to think about.
  assert.equal(
    new Set(TUTORIAL_STEPS.map((s) => s.title)).size,
    TUTORIAL_STEPS.length,
    'two steps carry the same title — the card is the title, so that is one card twice',
  );

  /* -- every ring points at something that can report a box ---------- */

  const targetNames = new Set<string>(TARGETS);
  for (const step of TUTORIAL_STEPS) {
    if (step.target) {
      assert.ok(targetNames.has(step.target), `${step.id} points at an unknown target`);
    }
    for (const v of step.via ?? []) {
      assert.ok(targetNames.has(v.target), `${step.id} points at an unknown target via a panel`);
      // A `via` KEYED ON A KIND THAT DOES NOT EXIST is a ring that never moves,
      // and the type cannot catch it: the key is a string so the tour does not
      // have to import the panel union. `MODE` is the one list of every kind.
      assert.ok(v.panel in MODE, `${step.id} waits for something that cannot open: ${v.panel}`);
    }
  }

  /* -- and only the floor says where inside itself to point ---------- */

  // A SPOT ON ANYTHING BUT THE FLOOR IS A COORDINATE NOBODY READS: `spotFor`
  // answers null for every other target, so a step carrying one would be a
  // fact the tour has no way of showing to be wrong.
  for (const step of TUTORIAL_STEPS) {
    if (step.spot) {
      assert.equal(step.target, 'court', `${step.id} carries a spot but is not about the floor`);
    }
  }

  /* -- the branches, walked over every value they can take ----------- */

  const OPTION_VALUES = {
    ft: ['quick', 'trip'],
    tap: ['stats', 'sub'],
    assist: ['ask', 'skip'],
    poss: ['on', 'off'],
  } as const;

  for (const [option, values] of Object.entries(OPTION_VALUES)) {
    const group = TUTORIAL_STEPS.filter((s) => s.when?.option === option);
    assert.ok(group.length > 0, `nothing branches on ${option}`);
    for (const value of values) {
      const hit = group.filter((s) => s.when?.is === value);
      // EXACTLY ONE PER VALUE. Zero is a board the tour never explains; two is
      // the same thing taught twice, one step after the other.
      assert.equal(hit.length, 1, `${option}=${value} has ${hit.length} steps, not one`);
    }
  }

  // THE TOUR IS THE SAME LENGTH WHATEVER THE SETTINGS SAY, because every branch
  // drops exactly one of a pair. A scorer on a `trip` board is not handed a
  // shorter walkthrough than a scorer on a `quick` one.
  const lengths = new Set<number>();
  for (const ft of OPTION_VALUES.ft) {
    for (const tap of OPTION_VALUES.tap) {
      for (const assist of OPTION_VALUES.assist) {
        for (const poss of OPTION_VALUES.poss) {
          const o = { ...DEFAULT_OPTIONS, ft, tap, assist, poss };
          const walked = visibleSteps(o);
          lengths.add(walked.length);
          for (const step of walked) {
            assert.ok(stepApplies(step, o), `${step.id} is in a tour it does not apply to`);
          }
          assert.equal(
            new Set(walked.map((s) => s.id)).size,
            walked.length,
            'a tour has the same step twice',
          );
        }
      }
    }
  }
  assert.equal(lengths.size, 1, 'the tour is a different length depending on the settings');

  /* -- where a remembered step lands --------------------------------- */

  const tour = visibleSteps(DEFAULT_OPTIONS);
  assert.equal(stepIndex(tour, null), 0, 'nothing remembered starts anywhere but the start');
  assert.equal(stepIndex(tour, 'no-such-step'), 0, 'a step that is gone starts the tour again');
  assert.equal(stepIndex(tour, tour[3].id), 3);
  // A STEP DROPPED BY A SETTING CHANGE IS NOT A CRASH. A scorer who walked half
  // the tour, went to the settings page and came back must land at the start
  // rather than at an index that no longer exists.
  assert.equal(
    stepIndex(visibleSteps({ ...DEFAULT_OPTIONS, ft: 'trip' }), 'ft.quick'),
    0,
    'a dropped step must fall back to the start',
  );


  /* -- and the tour closes what the next step does not want ---------- */

  /**
   * WALKED PAIRWISE OVER THE WHOLE SCRIPT, because the failure it catches is a
   * step nobody can finish and it is invisible in the step that causes it.
   *
   * A step whose flow ENDS on a sheet leaves one standing, and the two that
   * light and close still take `LIT_MS` to go — longer than the tour takes to
   * move on. The step after each points at a control on the BOARD, underneath
   * that sheet — so if the tour did not close it, the scorer's tap would land
   * on the sheet and dismiss it rather than on the control the ring is drawn
   * around.
   */
  for (let i = 0; i < tour.length - 1; i += 1) {
    const here = tour[i];
    const next = tour[i + 1];
    // whatever this step could plausibly leave open is whatever it pointed at
    const leftOpen = (here.via ?? []).map((v) => v.panel);
    for (const open of leftOpen) {
      const keeps = wantsPanel(next, open);
      const onBoard = !next.target || !PANEL_TARGETS.includes(next.target);
      assert.ok(
        keeps || onBoard,
        `${next.id} points inside a sheet that ${here.id} may have closed`,
      );
    }
  }

  // A STEP THAT POINTS AT A SHEET WANTS THE SHEET, whatever is open.
  for (const target of PANEL_TARGETS) {
    const step = TUTORIAL_STEPS.find((s) => s.target === target);
    if (step) assert.equal(wantsPanel(step, null), true, `${step.id} would close its own sheet`);
  }
  // AND A STEP THAT POINTS AT THE BOARD DOES NOT, which is the half that
  // actually closes something.
  const rb = TUTORIAL_STEPS.find((s) => s.id === 'rb');
  assert.ok(rb);
  assert.equal(
    wantsPanel(rb, 'ftResult'),
    false,
    'the free-throw dock survives into the rebound step, which sits under it',
  );
  // BOTH HALVES OF THE FOURTH FOOTER CELL, because which of the two follows the
  // tally step is `options.poss`'s answer and the sheet has to close either way.
  for (const id of ['poss', 'timeout']) {
    const step = TUTORIAL_STEPS.find((s) => s.id === id);
    assert.ok(step, `${id} is not in the script`);
    assert.equal(
      wantsPanel(step, 'playerActions'),
      false,
      `a player's tiles survive into ${id}, which sits under them`,
    );
  }
  // but a step mid-flow keeps the sheet its own `via` names
  const pf = TUTORIAL_STEPS.find((s) => s.id === 'pf');
  assert.ok(pf);
  assert.equal(wantsPanel(pf, 'foulKind'), true, 'the foul step closes its own first question');

  /* -- the completion rule, one shape at a time ---------------------- */

  const w = (over: Partial<Watch> = {}): Watch => ({
    panel: null,
    opens: 0,
    events: [],
    possessions: 0,
    timeouts: 0,
    running: false,
    ...over,
  });
  const shotAt = (made: boolean) => ({ type: 'shot', made });
  const foul = { type: 'foul', made: null };

  // A QUESTION HAS TO HAVE BEEN OPENED, not merely to be open. The same kind
  // twice in a row — a player's own tiles reopening after every tally — leaves
  // the kind exactly where it was, which is what `opens` is for.
  assert.equal(isDone({ on: 'panel', kind: 'who' }, w(), w({ panel: 'who' })), false);
  assert.equal(isDone({ on: 'panel', kind: 'who' }, w(), w({ panel: 'who', opens: 1 })), true);
  assert.equal(
    isDone({ on: 'panel', kind: 'who' }, w(), w({ panel: 'what', opens: 1 })),
    false,
    'the wrong question opening does not answer the right one',
  );
  assert.equal(
    isDone(
      { on: 'anyPanel' },
      w({ panel: 'playerActions', opens: 3 }),
      w({ panel: 'playerActions', opens: 4 }),
    ),
    true,
    'the same thing opened again is still a tap that landed',
  );

  // ONLY WHAT HAPPENED SINCE THE STEP OPENED. A foul logged three steps ago
  // must not finish the step that asks for one.
  assert.equal(
    isDone({ on: 'event', type: 'foul' }, w({ events: [foul] }), w({ events: [foul] })),
    false,
    'something from before the step finished it',
  );
  assert.equal(isDone({ on: 'event', type: 'foul' }, w(), w({ events: [foul] })), true);

  // A MISS DOES NOT FINISH THE STEP THAT ASKS FOR A MAKE, which is the whole
  // reason the tour teaches the two separately.
  assert.equal(isDone({ on: 'shot', made: true }, w(), w({ events: [shotAt(false)] })), false);
  assert.equal(isDone({ on: 'shot', made: true }, w(), w({ events: [shotAt(true)] })), true);

  // THE FOUR TALLIES ARE ONE ANSWER, read off `constants/game.ts` rather than
  // listed here — a fifth must not need this file edited to be recognised.
  for (const [type] of TALLY_TILES) {
    assert.equal(
      isDone({ on: 'tally' }, w(), w({ events: [{ type, made: null }] })),
      true,
      `${type} does not finish the tally step`,
    );
  }
  assert.equal(isDone({ on: 'tally' }, w(), w({ events: [shotAt(true)] })), false);

  assert.equal(isDone({ on: 'poss' }, w({ possessions: 4 }), w({ possessions: 5 })), true);
  assert.equal(isDone({ on: 'poss' }, w({ possessions: 4 }), w({ possessions: 4 })), false);
  assert.equal(isDone({ on: 'timeout' }, w({ timeouts: 1 }), w({ timeouts: 2 })), true);
  assert.equal(isDone({ on: 'timeout' }, w({ timeouts: 1 }), w({ timeouts: 1 })), false);
  assert.equal(
    isDone({ on: 'timeout' }, w({ possessions: 4 }), w({ possessions: 5 })),
    false,
    'the other half of the cell does not finish this one',
  );
  assert.equal(isDone({ on: 'clock' }, w(), w({ running: true })), true);
  assert.equal(isDone({ on: 'clock' }, w({ running: true }), w()), true, 'stopping counts too');

  /**
   * UNDO IS WATCHED ON BOTH COUNTERS, and the second one is not decoration.
   * The step before it in the script is POSSESSIONS, and undoing a possession
   * moves a counter while leaving the log exactly as long as it was — so a rule
   * that only watched the log would leave a scorer pressing UNDO at a step that
   * never ends.
   */
  assert.equal(isDone({ on: 'undo' }, w({ events: [shotAt(true)] }), w({ events: [] })), true);
  assert.equal(
    isDone({ on: 'undo' }, w({ possessions: 10 }), w({ possessions: 9 })),
    true,
    'undoing a possession has to finish the undo step',
  );
  assert.equal(
    isDone({ on: 'undo' }, w({ timeouts: 3 }), w({ timeouts: 2 })),
    true,
    'and so does undoing a timeout, which is the step before it on a whole cell',
  );
  assert.equal(isDone({ on: 'undo' }, w(), w({ events: [shotAt(true)] })), false);

  // A STEP WITH NOTHING TO TAP IS NEVER FINISHED BY THE BOARD. Its caption's
  // own button is the only way on, which is what `needsButton` is asked.
  assert.equal(isDone({ on: 'next' }, w(), w({ events: [shotAt(true)], opens: 9 })), false);

  /* -- where the ring goes ------------------------------------------- */

  // A SHOT IS THREE STEPS AND THE RING DOES NOT WANDER INSIDE THEM: the spot
  // is on the floor, the result is on its own tile, the shooter is on the
  // sheet. The one place it still moves is the last tap of a three on a board
  // that asks for the assist, because that board does not record the shot
  // until the assist bar is answered.
  const arc = TUTORIAL_STEPS.find((s) => s.id === 'three');
  assert.ok(arc, 'the three-point step is gone');
  assert.equal(targetFor(arc, null), 'court', 'a shot starts on the floor');
  const made = TUTORIAL_STEPS.find((s) => s.id === 'three.made');
  assert.ok(made, 'the step that asks for MADE is gone');
  assert.equal(targetFor(made, 'what'), 'what.made', 'the result is a tile of its own');
  const scored = TUTORIAL_STEPS.find((s) => s.id === 'three.who.ask');
  assert.ok(scored, 'the assist board lost the last tap of its three');
  assert.equal(targetFor(scored, null), 'panel', 'the shooter is picked on the sheet');
  assert.equal(targetFor(scored, 'assist'), 'assist.none', 'and the ring follows onto the bar');
  assert.equal(
    targetFor(scored, 'endQuarter'),
    'panel',
    'something this step knows nothing about leaves the ring where it was',
  );

  /* -- and WHERE on it the finger lands ------------------------------ */

  /**
   * THE HAND HAS TO BE IN THE ZONE THE CAPTION IS TALKING ABOUT.
   *
   * A control is one thing and its middle is where a finger belongs; the FLOOR
   * is seven zones, and its middle is a two. So a step about the floor carries
   * its own `spot`, and this asserts the thing that makes that worth doing: the
   * coordinate under *Tap outside the arc* really is a THREE — and the floor
   * step before it really is a two, or the tour teaches the same shot twice.
   */
  for (const id of ['three']) {
    const s = TUTORIAL_STEPS.find((x) => x.id === id);
    assert.ok(s, `${id} is gone`);
    const spot = spotFor(s, 'court');
    assert.ok(spot, `${id} points at the floor with no spot on it`);
    assert.equal(
      shotTypeFor(spot.x, spot.y),
      '3PT',
      `${id} says "outside the arc" and points at a two`,
    );
    assert.equal(spotFor(s, 'panel'), null, 'a panel is pointed at in the middle');
  }

  const floor = TUTORIAL_STEPS.find((s) => s.id === 'court');
  assert.ok(floor, 'the first floor step is gone');
  const floorSpot = spotFor(floor, 'court');
  assert.ok(floorSpot, 'the first floor step has no spot');
  assert.equal(
    shotTypeFor(floorSpot.x, floorSpot.y),
    '2PT',
    'the tour teaches a two and then a three, and this one is not the two',
  );

  // and the middle of the floor is exactly what the spot exists to avoid
  assert.equal(shotTypeFor(0.5, 0.5), '2PT', 'the centre of the court stopped being a two');

  /* -- every string the tour prints ---------------------------------- */

  for (const [key, value] of Object.entries(TUTORIAL_COPY)) {
    if (typeof value === 'string') assert.ok(value.length > 0, `TUTORIAL_COPY.${key} is empty`);
  }
  for (const [key, value] of Object.entries(TUTORIAL_COPY.regions)) {
    assert.ok(value.length > 0, `the ${key} region has no label`);
  }

  /* -- the throwaway game -------------------------------------------- */

  const tg = tutorialGame(DEFAULT_OPTIONS, 'Test FC');
  assert.equal(tg.players.length, TUTORIAL_SQUAD.length, 'the tour lost a shirt');
  /**
   * FOUR ON THE FLOOR AND ONE SHOWING OUT, which is what a board looks like
   * between a disqualification and the substitution that answers it.
   *
   * The disqualified one MUST be one of the five, and that is what this pair of
   * assertions is really holding: `useRailPlayers` draws the actives and then
   * the disqualified, sliced to five, so a bench player sent off is never
   * reached by the slice — and the step that points at a fouled-out row would
   * point at a row that is not on the screen.
   */
  assert.ok(
    TUTORIAL_STARTERS.includes(TUTORIAL_FOULED_OUT),
    'the disqualified player is not one of the five, so the rail never draws them',
  );
  assert.equal(
    tg.players.filter((p) => p.status === 'active').length,
    TUTORIAL_STARTERS.length - 1,
    'the tour does not tip off with a full floor less the one who is off',
  );
  assert.equal(
    tg.players.filter((p) => p.status === 'out').length,
    1,
    'the fouled-out step has nobody to point at',
  );
  assert.equal(tg.players.find((p) => p.status === 'out')?.id, TUTORIAL_FOULED_OUT);
  assert.ok(tg.players.some((p) => p.status === 'bench'), 'nowhere to substitute from');

  // THE LOG IS EMPTY AND SO IS THE SCOREBOARD. Every number the tour puts on
  // the footer is one the scorer put there, which is the whole of what a
  // walkthrough is for: a figure that started at eighteen cannot be seen to
  // move. It also leaves UNDO nothing of the app's own making to take back.
  assert.deepEqual(tg.events, [], 'the tour starts with something already logged');
  assert.equal(tg.score, TUTORIAL_BOARD.score);
  assert.equal(tg.oppScore, TUTORIAL_BOARD.oppScore);
  assert.equal(tg.possessions, TUTORIAL_BOARD.possessions);
  assert.equal(TUTORIAL_BOARD.score, 0, 'the tour opens on a board somebody has already played');
  assert.equal(TUTORIAL_BOARD.oppScore, 0);
  assert.equal(TUTORIAL_BOARD.possessions, 0);
  assert.equal(tg.running, false, 'the clock step is about a board that is stopped');
  assert.equal(tg.ended, false);

  // IT IS PLAYED UNDER THE SCORER'S OWN RULES, stamped the way `startGame`
  // stamps them, so the period cell says what their own board would say.
  const halves = tutorialGame({ ...DEFAULT_OPTIONS, periods: 2, periodLen: 720 }, 'X');
  assert.equal(halves.periods, 2);
  assert.equal(halves.periodLen, 720);
  assert.ok(halves.period <= halves.periods, 'a two-half board opened on a period it has not got');

  // NOTHING FROM THE ROSTER CROSSES, exactly as `buildPlayers` guarantees for a
  // real tip-off: the tour is built through the same door and no other.
  for (const p of tg.players) {
    assert.ok(!('available' in p), 'availability reached the tour');
    assert.ok(!('position' in p), 'a position reached the tour');
    assert.equal(p.stats.points, 0, 'a tour player started with points on them');
  }
  // and every one of them has their OWN counters — the bug `buildPlayers` is
  // asserted against for a real game, asserted again for this one
  assert.equal(
    new Set(tg.players.map((p) => p.stats)).size,
    tg.players.length,
    'two tour players share one stat line',
  );

  // ITS IDS CANNOT COLLIDE WITH A REAL ROSTER'S. Nothing here is ever written
  // to `rosterStore`, but a tour player wearing `p1` beside a seeded `p1` is
  // the kind of coincidence only ever found the hard way.
  const seeded = new Set(SEED_ROSTER.map((p) => p.id));
  for (const p of TUTORIAL_SQUAD) {
    assert.ok(!seeded.has(p.id), `the tour's ${p.id} collides with the seed roster`);
  }
  for (const id of TUTORIAL_STARTERS) {
    assert.ok(TUTORIAL_SQUAD.some((p) => p.id === id), `${id} starts but is not on the squad`);
  }
  assert.ok(
    TUTORIAL_SQUAD.some((p) => p.id === TUTORIAL_FOULED_OUT),
    'the disqualified player is not on the squad',
  );
  assert.equal(
    new Set(TUTORIAL_SQUAD.map((p) => p.number)).size,
    TUTORIAL_SQUAD.length,
    'two tour players wear one number',
  );
}

/* --------------------------------------------------- when the disk says no ----
 * `lib/fault.ts` decides WHICH kind of no a browser just said, and it latches so
 * a full disk failing a write every two seconds warns once. Both halves are
 * exercised here rather than on a device, which is the whole reason a channel
 * that could have been three lines inside the storage driver is its own module.
 * ---------------------------------------------------------------------------- */
{
  // OUT OF ROOM HAS THREE SPELLINGS and they all mean the same thing to a
  // scorer: the standard name, Chrome's legacy code and Safari's own name.
  assert.equal(classify({ name: 'QuotaExceededError' }), 'full');
  assert.equal(classify({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), 'full');
  assert.equal(classify({ name: 'Whatever', code: 22 }), 'full');
  assert.equal(classify({ name: 'Whatever', code: 1014 }), 'full');

  // everything else is the browser REFUSING storage rather than running out of
  // it, including the shapes a `catch` can actually be handed
  assert.equal(classify({ name: 'InvalidStateError' }), 'blocked');
  assert.equal(classify(new Error('nope')), 'blocked');
  assert.equal(classify(null), 'blocked');
  assert.equal(classify('a string'), 'blocked');

  // BOTH KINDS HAVE A SENTENCE AND IT FITS THE TOAST, which is one line at
  // `fsSm` with `numberOfLines={1}` — a warning that ellipsises says nothing
  for (const kind of ['full', 'blocked'] as const) {
    assert.ok(FAULT_NOTE[kind].length > 0, `${kind} has no sentence`);
    assert.ok(FAULT_NOTE[kind].length <= 48, `${kind}'s sentence will not fit the toast`);
    assert.equal(FAULT_NOTE[kind], FAULT_NOTE[kind].trim());
  }

  // THE LATCH. A full disk fails every write, so the listener hears the EDGE
  // and not the repetition — this is what stops the warning becoming a toast
  // every two seconds for the rest of a game.
  resetFault();
  const heard: (string | null)[] = [];
  const off = onStorageFault((f) => heard.push(f));

  reportFault('full');
  reportFault('full');
  reportFault('full');
  assert.deepEqual(heard, ['full'], 'a repeated fault was published more than once');
  assert.equal(storageFault(), 'full');

  // a DIFFERENT fault is a different edge, and is heard
  reportFault('blocked');
  assert.deepEqual(heard, ['full', 'blocked']);

  // and a write that lands clears it, once
  clearFault();
  clearFault();
  assert.deepEqual(heard, ['full', 'blocked', null]);
  assert.equal(storageFault(), null, 'a landed write did not clear the fault');

  off();
  reportFault('full');
  assert.equal(heard.length, 3, 'a removed listener was still called');
  resetFault();
}

/* ------------------------------------------------------------- the backup ----
 * `lib/backup.ts` is the file a scorer keeps, and the only defence this app has
 * against a browser emptying its own storage. Two things are asserted hardest:
 * that an ENTITLEMENT never travels in one, and that a bad file is refused whole
 * rather than restored in half.
 * ---------------------------------------------------------------------------- */
{
  // WHAT TRAVELS: the club, the roster, the shelf's index, and each saved game.
  assert.ok(travels('hooplog-team'));
  assert.ok(travels('hooplog-roster'));
  assert.ok(travels('hooplog-history'));
  assert.ok(travels(gameKey('g123')));

  // WHAT DOES NOT — and the first is the one that matters: paying is a fact
  // about an account and can never be a fact about a file the scorer wrote
  assert.ok(!travels('hooplog-billing'), 'an entitlement travels in a backup');
  assert.ok(!travels('livestats-game'), 'the live board travels in a backup');
  assert.ok(!travels('hooplog-tutorial'));
  assert.ok(!travels('hooplog-intro'));
  assert.ok(!travels('something-else'));

  const rows: [string, string][] = [
    ['hooplog-team', '{"state":{"profile":{"name":"Bulls"}},"version":1}'],
    ['hooplog-roster', '{"state":{"players":[]},"version":2}'],
    ['hooplog-history', '{"state":{"index":[]}}'],
    [gameKey('g1'), '{"score":10}'],
    [gameKey('g2'), '{"score":20}'],
    ['hooplog-billing', '{"state":{"entitled":true}}'],
    ['livestats-game', '{"state":{"score":4}}'],
  ];

  const made = backupOf(rows, 1_700_000_000_000);
  assert.equal(made.app, 'hooplog');
  assert.equal(made.format, BACKUP_FORMAT);
  assert.equal(made.savedAt, 1_700_000_000_000);
  assert.ok(!('hooplog-billing' in made.rows), 'the entitlement was written into a backup');
  assert.ok(!('livestats-game' in made.rows), 'the live board was written into a backup');
  assert.equal(Object.keys(made.rows).length, 5);

  // ONE ROW PER GAME is a fact about the storage layout, and it is what the
  // confirm counts — rather than parsing a store's persisted envelope, which is
  // the modelling `lib/backup.ts` exists to avoid
  assert.deepEqual(countsOf(made), { games: 2, club: true, roster: true });
  assert.deepEqual(countsOf(backupOf([[gameKey('g9'), '{}']])), {
    games: 1,
    club: false,
    roster: false,
  });

  // THE ROUND TRIP. What is written comes back unchanged: the rows are the
  // stores' own strings and nothing here may reshape one.
  const back = readBackup(JSON.stringify(made));
  assert.ok('backup' in back, 'a backup this file wrote was refused by its own reader');
  assert.deepEqual(back.backup.rows, made.rows);

  // A HAND-EDITED FILE CANNOT SMUGGLE AN ENTITLEMENT IN. The write side drops
  // it and so does the read side, because only one of those is still under our
  // control once the file is sitting on somebody's disk.
  const smuggled = readBackup(
    JSON.stringify({
      app: 'hooplog',
      format: BACKUP_FORMAT,
      savedAt: 1,
      rows: { 'hooplog-billing': '{"state":{"entitled":true}}', 'hooplog-team': '{}' },
    }),
  );
  assert.ok('backup' in smuggled);
  assert.ok(
    !('hooplog-billing' in smuggled.backup.rows),
    'a hand-edited backup restored an entitlement',
  );

  // REFUSED WHOLE, NEVER RESTORED IN HALF — half a season beside a roster that
  // does not match it is a state no migration can straighten out
  const refusals: [string, string][] = [
    ['not json at all', 'notJson'],
    ['null', 'notJson'],
    ['{"app":"something-else","format":1,"rows":{}}', 'notOurs'],
    ['{"app":"hooplog","rows":{}}', 'notOurs'],
    [`{"app":"hooplog","format":${BACKUP_FORMAT + 1},"rows":{}}`, 'tooNew'],
    ['{"app":"hooplog","format":1,"rows":{}}', 'empty'],
    ['{"app":"hooplog","format":1,"rows":{"nothing-we-know":"x"}}', 'empty'],
  ];
  for (const [raw, want] of refusals) {
    const read = readBackup(raw);
    assert.ok('fault' in read, `${raw} was accepted`);
    assert.equal(read.fault, want, `${raw} was refused for the wrong reason`);
    assert.ok(BACKUP_REFUSAL[read.fault].length > 0);
  }

  // AN OLDER FILE STILL OPENS. A backup restores through each store's own
  // migration, so the only version this reader refuses is one from the future.
  const older = readBackup('{"app":"hooplog","format":1,"savedAt":5,"rows":{"hooplog-team":"{}"}}');
  assert.ok('backup' in older, 'a backup from an older format was refused');

  // THE NAME SORTS INTO ORDER IN A FOLDER, which is what big-endian digits are
  // for — and it carries no locale, like every other date this app prints
  const name = backupFileName(Date.UTC(2026, 8, 9, 12));
  assert.match(name, /^hooprec-\d{4}-\d{2}-\d{2}\.json$/, `${name} is not the backup's name`);
  assert.ok(
    backupFileName(Date.UTC(2026, 0, 2, 12)) < backupFileName(Date.UTC(2026, 10, 2, 12)),
    'two backups do not sort by date',
  );
}

/* ---- the club runs teams, and a team is a selection ----------------
 * `lib/squads.ts` is the newest of the plain-rule files and it is the one that
 * overturned a stated decision — TEAM was singular and the switcher it said
 * did not exist now does. These are the assertions that hold the shape it took:
 * a team REFERS to the pool rather than owning it, a player may be on more
 * than one, and a night played before any of this existed still lands
 * somewhere a scorer can find it.
 * ------------------------------------------------------------------ */
{
  const pool: RosterPlayer[] = [
    { id: 'a', number: 4, name: 'A', available: true },
    { id: 'b', number: 5, name: 'B', available: true },
    { id: 'c', number: 6, name: 'C', available: false },
  ];

  // A CLUB THAT HAS NEVER HEARD OF TEAMS HAS ONE, and it holds the whole pool.
  // Nothing on any screen branches on "no teams yet" because of this.
  const derived = squadsIn([], pool);
  assert.equal(derived.length, 1, 'a club with no teams saved reads as one team');
  assert.equal(derived[0].id, FIRST_SQUAD, 'and it is the fixed first id');
  assert.deepEqual(derived[0].playerIds, ['a', 'b', 'c'], 'holding the whole pool');
  assert.equal(squadsIn(derived, []).length, 1, 'a saved list is handed straight back');

  // ...and a saved game from before teams existed is FILED UNDER IT rather than
  // under nothing, which is the same call `summaryKind` makes about a game
  // saved before the two kinds. A row answering "no team" would drop off every
  // screen in the app at once.
  assert.equal(squadIdOf({}), FIRST_SQUAD, 'a row with no team is the first team');
  assert.equal(squadIdOf({ squadId: '' }), FIRST_SQUAD, 'and an empty string is the same row');
  assert.equal(squadIdOf({ squadId: 'x' }), 'x', 'a stamped row keeps its own team');

  // A PLAYER MAY BE ON SEVERAL TEAMS. This is the whole reason membership is a
  // list on the team and not a `squadId` on the player, so it is asserted
  // rather than left to the panel that happens to allow it.
  let squads: Squad[] = [
    { id: 's1', name: 'Team 1', playerIds: ['a', 'b'] },
    { id: 's2', name: 'Team 2', playerIds: [] },
  ];
  squads = toggleDraft(squads, 's2', 'a');
  assert.deepEqual(squads[1].playerIds, ['a'], 'a is drafted up');
  assert.deepEqual(squads[0].playerIds, ['a', 'b'], 'and is STILL on the first team');
  assert.equal(tagsFor(squads, 'a').length, 2, 'so they carry two tags');
  assert.equal(tagsFor(squads, 'c').length, 0, 'and an undrafted player carries none');
  assert.deepEqual(undraftedIn(squads, pool).map((p) => p.id), ['c'], 'who is the pool spare');

  // the same row un-drafts, which is why nothing on the TEAM tab removes
  squads = toggleDraft(squads, 's2', 'a');
  assert.deepEqual(squads[1].playerIds, [], 'the same tap takes them off again');
  assert.deepEqual(squads[0].playerIds, ['a', 'b'], 'and the other team never moved');

  // MEMBERS COME BACK IN POOL ORDER, not in draft order — a sheet that
  // reordered itself by whoever was drafted last would be a second, disagreeing
  // arrangement of the same names.
  const jumbled: Squad[] = [{ id: 's1', name: 'T', playerIds: ['c', 'a'] }];
  assert.deepEqual(
    membersOf(jumbled[0], pool).map((p) => p.id),
    ['a', 'c'],
    'the sheet is read in the order the pool is kept in',
  );
  // ...and an id with no player behind it is simply invisible, which is what
  // makes `migrateSquads` safe to run without the pool in hand
  assert.deepEqual(
    membersOf({ id: 's1', name: 'T', playerIds: ['a', 'ghost'] }, pool).map((p) => p.id),
    ['a'],
    'an id with no pool row behind it is dropped on the way out',
  );

  // THE CAP REFUSES RATHER THAN CLAMPS, exactly as `recordFoul` denies a sixth
  // foul: the list comes back unchanged and the caller is the one that says so.
  const big: Squad[] = [
    { id: 's1', name: 'T', playerIds: Array.from({ length: SQUAD_SIZE }, (_, i) => 'p' + i) },
  ];
  assert.equal(toggleDraft(big, 's1', 'zz')[0].playerIds.length, SQUAD_SIZE, 'a full sheet refuses');
  assert.equal(
    toggleDraft(big, 's1', 'p0')[0].playerIds.length,
    SQUAD_SIZE - 1,
    'but a full sheet still un-drafts',
  );

  // THE POOL HOLDS EVERY TEAM AT FULL STRENGTH. If it did not, a club could
  // reach three teams it has no way to fill, which is a cap that lies.
  assert.ok(SQUAD_CAP * SQUAD_SIZE >= ROSTER_CAP, 'three full sheets can spend the whole pool');
  assert.ok(ROSTER_CAP >= SQUAD_SIZE, 'and one full sheet fits inside it');
  assert.ok(SQUAD_SIZE >= STARTERS, 'a team can put five on the floor');

  // A TEAM WITH GAMES BEHIND IT CANNOT GO, and the last one never can. Its
  // games carry its id and nothing else does, so removing it would strand
  // every one of them where no screen could reach it.
  // the first team wears `FIRST_SQUAD`, because that is the id `squadsIn`
  // mints for it and the one the store carries forward when it materialises —
  // which is exactly what makes the untagged-row guard below bite
  const two: Squad[] = [
    { id: FIRST_SQUAD, name: 'Team 1', playerIds: [] },
    { id: 's2', name: 'Team 2', playerIds: [] },
  ];
  assert.equal(canRemoveSquad(two, 's2', []), true, 'a team that has played nothing can go');
  assert.equal(
    canRemoveSquad(two, 's2', [{ squadId: 's2' }]),
    false,
    'a team with a game on the shelf cannot',
  );
  assert.equal(
    canRemoveSquad(two, FIRST_SQUAD, [{}]),
    false,
    'and an untagged game belongs to the FIRST team, which protects it',
  );
  assert.equal(canRemoveSquad([two[0]], FIRST_SQUAD, []), false, 'the last team standing never goes');

  // the shelf, sliced — the filter every screen applies before its own
  const shelf = [{ squadId: 's1' }, { squadId: 's2' }, {}];
  assert.equal(squadIn(shelf, 's2').length, 1, 'one team worth of games');
  assert.equal(squadIn(shelf, FIRST_SQUAD).length, 1, 'and the untagged row files under the first');

  // A NAME IS NEVER BLANK, and the next one offered is the lowest nobody wears
  assert.equal(nextSquadName([]), 'Team 1');
  assert.equal(nextSquadName([{ id: 'x', name: 'Team 1', playerIds: [] }]), 'Team 2');
  assert.equal(
    nextSquadName([{ id: 'x', name: 'team 1', playerIds: [] }]),
    'Team 2',
    'and case does not make a second Team 1',
  );
  assert.equal(cleanSquadName('  first   team  '), 'first team', 'spacing is folded, case is not');
  assert.equal(cleanSquadName('x'.repeat(99)).length, SQUAD_NAME_MAX, 'and it is capped');

  // WHAT A FILE ON SOMEBODY DISK IS PUT THROUGH. `migrateSquads` runs on
  // rehydrate, when `rosterStore` may not have landed yet — so WITHOUT a pool
  // it must keep every id it is given. Checking them against an empty pool is
  // what would empty every team on the launch that raced.
  const restored = migrateSquads([
    { id: 's1', name: '', playerIds: ['a', 'a', 'ghost'] },
    { id: 's2', name: 'Team 2', playerIds: [] },
    { id: 's3', name: 'Team 3', playerIds: [] },
    { id: 's4', name: 'Team 4', playerIds: [] },
  ]);
  assert.equal(restored.length, SQUAD_CAP, 'no more teams than the cap');
  assert.deepEqual(restored[0].playerIds, ['a', 'ghost'], 'duplicates fold, unknown ids survive');
  assert.equal(restored[0].name, 'Team 1', 'a nameless team is given the next free name');
  assert.deepEqual(migrateSquads(undefined), [], 'and nothing at all reads as no teams');
  // ...but handed a pool it DOES prune, which is the backup path
  assert.deepEqual(
    migrateSquads([{ id: 's1', name: 'T', playerIds: ['a', 'ghost'] }], pool)[0].playerIds,
    ['a'],
    'a pool in hand prunes the ids that have no player',
  );

  // THE TEAMS TRAVEL IN A BACKUP and the entitlement still does not. A team is
  // a list of pool ids, so a file carrying the roster without them would
  // restore a club whose sheets had collapsed back into one.
  assert.equal(travels('hooplog-squads'), true, 'the teams are in the backup');
  assert.equal(travels('hooplog-billing'), false, 'and the entitlement is still not');

  // THE POOL IS NOT THE GAME, and it is still `buildPlayers` that says so —
  // a team is a SELECTION, so what reaches a game is the members, not the club.
  const built = buildPlayers(membersOf(jumbled[0], pool), ['a']);
  assert.equal(built.length, 2, 'only the drafted players are dressed');
  assert.ok(
    built.every((p) => !('available' in p) && !('position' in p)),
    'and the two team-only keys are still left behind',
  );
}

console.log('selfcheck: all assertions passed');

// Player export uses appearances, the supplied newest-first scope, and escaped identity.
{
  const old = game(), latest = game(), dnp = game();
  const id = latest.players[0].id;
  old.players[0].stats.points = 8;
  latest.players[0].stats.points = 12;
  dnp.players[0].starter = false;
  latest.opponent = '<script>opponent</script>';
  const roster = [{ id, number: 99, name: 'Đặng <b>An</b>', available: true }];
  const data = playerReportData([dnp, latest, old], id, roster)!;
  assert.equal(data.latest, latest);
  assert.equal(data.games, 2);
  assert.equal(data.line.stats.points, 20);
  const html = playerReportHtml([dnp, latest, old], id, roster);
  assert.ok(html.includes('&lt;b&gt;An&lt;/b&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<svg'));
  assert.ok(!html.includes('Game log'));
  assert.ok(html.includes('<td>20</td><td>10</td>'));
  assert.equal(playerReportData([], id, roster), null);
  assert.throws(() => playerReportHtml([], id, roster));
  assert.equal(playerReportFileName('Đặng An'), 'HOOPLOG-player-Dang-An.pdf');
}

{
  const latest = game(), old = game();
  A.recordShot(latest, 'p1', { x: 0.25, y: 0.4 }, '2PT', true, null, null);
  A.recordShot(latest, latest.players[1].id, { x: 0.75, y: 0.4 }, '2PT', true, null, null);
  A.recordShot(old, 'p1', { x: 0.8, y: 0.8 }, '3PT', true, null, null);
  const html = playerReportHtml([latest, old], 'p1', []);
  assert.ok(html.includes('cx="198"'));
  assert.ok(!html.includes('cx="594"'));
  assert.ok(!html.includes('cx="633.6"'));
  assert.ok(!html.includes('NaN'));
}

// Subscription access follows only the configured active entitlement.
assert.equal(revenueCatAccess({}, 'pro'), false);
assert.equal(revenueCatAccess({ another: {} }, 'pro'), false);
assert.equal(revenueCatAccess({ pro: {} }, 'pro'), true);
assert.equal(revenueCatAccess({ pro: null }, 'pro'), false);
assert.equal(revenueCatAccess({}, 'toString'), false);
