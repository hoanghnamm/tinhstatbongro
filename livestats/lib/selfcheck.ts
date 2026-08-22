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

import { FOULS, FOUL_KINDS, FOUL_MENU, PERIOD_LEN, REG_PERIODS, SEED_ROSTER, TALLY_TILES, seedRoster, zeroStats } from '../constants/game';
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
import { gridFor } from './grid';
import { advancedFor, linesFor, periodsOf, report, scoreline, shotsIn } from './box';
import { gameReportHtml, periodScores, reportFileName, reportTitle } from './pdf';
import { tileWords } from './labels';
import { DARK, DOT_HUES, DOT_LABEL, PALETTE, dotColor } from '../theme/tokens';
import { litControl, litPlayerId } from './lit';
import {
  HISTORY_CAP,
  competitionsIn,
  pushSummary,
  resultOf,
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
import { efficiency, efg, plusMinus, ptsOffSteals, totals, zoneSplits } from './stats';
import type { GameEvent, GameState, Position, RosterPlayer } from '../types';

const game = (): GameState => ({
  team: { name: 'T' },
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
  players: seedRoster(),
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

  A.substitute(g, p.id, g.players[5].id);
  assert.equal(p.status, 'out', 'substituting a fouled-out player does not bench them');
  assert.equal(g.players[5].status, 'active', 'but the replacement comes on');
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
  assert.equal(periodName(1, 4), '1ST QUARTER');
  assert.equal(periodName(1, 2), '1ST HALF', 'a halves game is not playing a quarter');
  assert.equal(periodName(5, 4), 'OVERTIME', 'and period 5 is not a 5TH QUARTER');
  assert.equal(periodName(7, 4), 'OVERTIME 3');
  assert.equal(periodWord(2, 4), 'QUARTER');
  assert.equal(periodWord(2, 2), 'HALF');
  assert.equal(periodWord(3, 2), 'OVERTIME');
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
      players: seedRoster(),
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
  assert.equal(dotColor('teal', PALETTE), PALETTE.live);
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
  for (const hue of DOT_HUES) assert.ok(DOT_LABEL[hue], `${hue} has a name to print`);
}

/* ---- possessions --------------------------------------------------- */
{
  const g = game();
  A.addPossession(g);
  A.addPossession(g);
  assert.equal(g.possessions, 2, 'the footer cell is a plain counter');
  assert.equal(g.events.length, 0, 'and it leaves NO event — a possession has no player');
  assert.equal(g.players[0].stats.points, 0, 'and touches no player stat');

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

  const roster: RosterPlayer[] = SEED_ROSTER.map((p) => ({ ...p }));
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

  assert.equal(g.players[2].name, SEED_ROSTER[2].name, 'a roster edit does not rename a player');
  assert.equal(g.players[2].number, SEED_ROSTER[2].number, 'nor renumber one');
  assert.equal(g.players.length, SEED_ROSTER.length, 'nor take one off the floor');
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
  assert.equal(initials('MY TEAM'), 'MT');
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

  assert.equal(opponentLabel('Hanoi Rockets'), 'HANOI ROCKETS');
  assert.equal(opponentLabel(''), 'OPPONENT', 'a game started in a hurry still says something');
  assert.equal(opponentLabel('   '), 'OPPONENT');
  assert.equal(opponentLabel(undefined), 'OPPONENT', 'a summary from before opponents existed');

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
  assert.equal(competitionLabel('vba 2026'), 'VBA 2026');
  assert.equal(competitionLabel(''), 'UNFILED', 'an official game saved before competitions');
  assert.equal(competitionLabel(undefined), 'UNFILED');
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

/* ---- what a stat is CALLED -----------------------------------------
 * One rule for the three panels that name one, so a foul kind and a tally can
 * never end up reading differently on the same board.
 * ------------------------------------------------------------------ */
{
  assert.equal(DEFAULT_OPTIONS.labels, 'full', 'a fresh install spells the word out');

  assert.deepEqual(
    tileWords('full', 'DF', 'DEFENSIVE'),
    { code: 'DEFENSIVE', word: true },
    'the word takes the big slot, and says so — a word cannot wear DF’s type size',
  );
  assert.deepEqual(
    tileWords('short', 'DF', 'DEFENSIVE'),
    { code: 'DF', word: false },
    'the abbreviation alone, with nothing under it',
  );
  assert.deepEqual(
    tileWords('both', 'DF', 'DEFENSIVE'),
    { code: 'DF', caption: 'DEFENSIVE', word: false },
    'and BOTH is the tile the board has always drawn',
  );

  // every pair the three panels pass, through every mode: the full word is
  // always reachable, and no mode can leave a tile with nothing on it
  const pairs: [string, string][] = [
    ...FOUL_MENU.map((k) => [FOUL_KINDS[k].short, FOUL_KINDS[k].label] as [string, string]),
    ...TALLY_TILES.map(([, abbr, word]) => [abbr, word] as [string, string]),
    ['DR', 'DEFENSIVE'],
    ['OR', 'OFFENSIVE'],
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
  assert.equal(litPlayerId({ kind: 'fouledOut', playerId: 'p5' }), 'p5');
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
  assert.equal(reportTitle({ ...g, kind: 'practice' }), 'PRACTICE', 'a practice is filed as one');

  // the numbers are the screen's, not a second derivation
  const rep = report(g, null);
  assert.ok(html.includes(`>${rep.us}</span>`), 'the headline score is the report’s own');
  assert.ok(html.includes('PAINT'), 'every zone is named in the table');
  assert.ok(html.includes('TOP 3'), 'the empty ones included — 0/0 is a fact');
  assert.ok(html.includes('DNP'), 'a player who never took the floor says so');
  // THE SHEET DRAWS NO FLOOR AND CARRIES NO PLAY LOG. Both were on it: two
  // courts and every play in the order it happened. They are things you READ,
  // and the screen is where you read them; the sheet is the scorebook. So the
  // page is asserted EMPTY of both — a chart that creeps back onto paper is a
  // second floor to keep in step with `lib/court.ts`, which is the whole
  // reason that file owns the strings.
  assert.ok(!html.includes('<svg'), 'the sheet draws no floor');
  assert.ok(!html.includes('<path'), 'and no line work with it');
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
    join('components', 'ui', 'Slug.tsx'), // the lobby's accent rule: a ground, not a mark
    join('app', 'player', '[id].tsx'), // shot dots on court
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
}

console.log('selfcheck: all assertions passed');
