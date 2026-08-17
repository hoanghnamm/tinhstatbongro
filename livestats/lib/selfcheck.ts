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

import { FOULS, PERIOD_LEN, seedRoster } from '../constants/game';
import * as A from '../lib/actions';
import { FT_SPOT, shotTypeFor, zoneFor, zoneSide } from './court';
import { clockEntry, clockReady, mmss, ord, pushClockDigit, secondsFromClock } from './format';
import { gridFor } from './grid';
import { litControl, litPlayerId } from './lit';
import { efg, ptsOffSteals, totals, zoneSplits } from './stats';
import type { GameEvent, GameState, Position } from '../types';

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

/* ---- geometry ---------------------------------------------------- */

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
assert.equal(zone(40, 210), 'corner3', 'below the cut-off, distance alone still says three');

// the arc itself: r = 352 out of (396, 76)
assert.equal(zone(396, 76 + 351), 'top2', 'one unit inside the arc is a two');
assert.equal(zone(396, 76 + 353), 'top3', 'one unit outside it is a three');

// behind the backboard flattens onto the baseline, so it is a corner, not a wing
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

  const root = join(process.cwd(), 'components');
  const files = walk(root).map((f) => ({ path: relative(process.cwd(), f), src: readFileSync(f, 'utf8') }));
  assert.ok(files.length > 20, 'the component tree should be found from the project root');

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
