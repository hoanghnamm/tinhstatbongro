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

import { FOULS, PERIOD_LEN, SEED_ROSTER, seedRoster } from '../constants/game';
import * as A from '../lib/actions';
import { FT_SPOT, shotTypeFor, zoneFor, zoneSide } from './court';
import { clockEntry, clockReady, mmss, ord, pushClockDigit, secondsFromClock } from './format';
import { gridFor } from './grid';
import { litControl, litPlayerId } from './lit';
import { ROSTER_CAP, STARTERS, buildPlayers, cleanName, numberHolder, validNumber } from './roster';
import { efg, ptsOffSteals, totals, zoneSplits } from './stats';
import type { GameEvent, GameState, Position, RosterPlayer } from '../types';

const game = (): GameState => ({
  team: { name: 'T' },
  score: 0,
  oppScore: 0,
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
    { id: 'a', number: 12, name: 'bd' },
    { id: 'b', number: 7, name: 'a.n' },
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
  assert.equal(litControl({ kind: 'totals' }, null), 'score');

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

/* ---- the fill ends on a drawn line ---------------------------------
 * `CourtSvg.tsx` carries this file's partition a second time, as eleven closed
 * paths, and nothing in the type system ties the two together. So: rasterise
 * the real `d` strings out of the component and assert all 412,632 cells of
 * the viewBox resolve to exactly the zone `zoneFor` names — no gap, no
 * overlap, no drift. Move one vertex and it names the first cell to disagree.
 *
 * It samples at (px + 0.31, py + 0.27) rather than at the pixel centre. Every
 * boundary here is integer, y = 203.7, or a line of slope 123/245, and a
 * centre lands EXACTLY on one of them often enough to matter — an exact tie is
 * decided by `<=` on one side and by the scanline's edge rule on the other,
 * which is noise, not drift. No sample at this offset can sit on a boundary.
 * -------------------------------------------------------------------- */
{
  const W = 792, H = 521, BX = 396, BY = 76, R = 352;
  const svg = readFileSync(join(process.cwd(), 'components', 'board', 'CourtSvg.tsx'), 'utf8');

  const paths = [...svg.matchAll(/\{ zone: '(\w+)', side: '(\w)', d: '([^']+)' \}/g)];
  assert.equal(paths.length, 11, 'CourtSvg should carry one closed path per zone');

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
  // painted. These are the strings zoneFor's constants were read off.
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
    assert.ok(svg.includes(`d="${d}"`), `the court no longer draws ${d} — a zone edge lost its line`);
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
    files.some((f) => f.path === join('app', 'index.tsx')),
    'and the routes with it',
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
  const NO_TEXT_INSIDE = [join('components', 'board', 'Court.tsx')]; // the live mark is a dot
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
