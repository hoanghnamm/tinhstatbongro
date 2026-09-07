import type { Options } from './options';
import type { Position, RosterPlayer } from '../types';

/**
 * THE WALKTHROUGH, AS ONE TABLE OF PLAIN DATA.
 *
 * ## WHY IT IS DATA AND NOT EIGHTEEN COMPONENTS
 *
 * The script is the design here, and a script that can only be reordered by
 * editing twenty JSX blocks is one nobody reorders. Every step is a row:
 * which control it points at, what it is called, and what the scorer has to do
 * to finish it. Reordering the tour is moving a row.
 *
 * It is also the reason `lib/tutorial.ts` can be walked by `npm run check`
 * without React, a device or a game: the rules of the tour are pure functions
 * over this table, exactly as `lib/actions.ts` is over a `GameState`.
 *
 * ## AND WHY EVERY STRING IN IT IS HERE
 *
 * The same argument `constants/intro.ts` makes about the door: a walkthrough
 * is the screen nobody re-opens to check. A typo in step eleven is found by a
 * scorer or by a script, and only one of those is cheap.
 *
 * ## THE COPY RULES, WRITTEN DOWN BECAUSE THE SCRIPT ENFORCES THEM
 *
 * A STEP IS A TITLE AND NOTHING ELSE. Second person, present tense, VERB FIRST
 * — *Tap the floor.* It carried a line of meaning under it and an instruction
 * that swapped in after six idle seconds, and both are gone: the ring is
 * already round the control, the finger is already on the spot, and a
 * paragraph beside them is the app explaining a thing the scorer is looking
 * at. What is left has to be readable at a glance from across a card, which is
 * why the title is the biggest type on it.
 *
 * NO TWO STEPS SAY THE SAME THING, and that rule arrived with the cut. While
 * a step carried a line of meaning under it, two cards reading *Tap a player*
 * were told apart by the sentence beneath them; with the sentence gone they
 * are the same card twice, and a scorer who has just been moved on has no way
 * of telling that anything happened. So a title names the control AND what
 * that tap is for — *Tap a player to tally*, *Tap a player to sub* — and a
 * multi-tap flow is SPLIT rather than summarised: the two and the three are a
 * step per tap, because one title over three taps is a title that names none
 * of them. And `npm run check` holds every title in the table apart, the
 * branch pairs included: only one of a pair is ever in a tour, but a pair that
 * is allowed to agree is a pair nobody has to think about.
 *
 * No implementation vocabulary: there are no panels, no states and no function
 * names in a phrase a scorer reads.
 */

/* ---- what a step can point at --------------------------------------- */

/**
 * EVERY TARGET THE TOUR CAN SPOTLIGHT.
 *
 * Four of them — `court`, `sidecol`, `rail`, `footer` — are the boxes the board
 * ALREADY measures for the panel placement, so the tour reads them rather than
 * measuring the same four a second time. The rest are controls that had no
 * reason to report a box until now.
 *
 * `panel` is the OPEN PANEL'S OWN FRAME, and it is the fallback for anything
 * inside one: a named tile that has not laid out yet resolves to the sheet it
 * is on rather than to nothing, so a cut-out never lands on empty floor.
 */
export const TARGETS = [
  /* the four regions, straight off `layoutStore` */
  'court',
  'sidecol',
  'rail',
  'footer',
  /* the board's own controls */
  'pf',
  'ft',
  'rb',
  'opp2',
  'undo',
  'clock',
  'score',
  'quarter',
  /* the fourth footer cell, either half of it — `options.poss` says which of
     the two is on the board, and the tour points at whichever one is */
  'poss',
  'timeout',
  /* the rail: the first row, and whichever row is disqualified */
  'row.first',
  'row.out',
  /* a panel, and the controls inside one the script names out loud */
  'panel',
  'what.made',
  'what.miss',
  'assist.none',
  'player.sub',
] as const;

export type TargetId = (typeof TARGETS)[number];

/**
 * THE TARGETS THAT LIVE ON AN OPEN SHEET RATHER THAN ON THE BOARD.
 *
 * The tour CLOSES whatever is open when it moves to a step that does not need
 * it, and this list is how it knows. That rule is not tidiness — it is the one
 * thing standing between the script's order and a step nobody can finish.
 *
 * Steps whose flow ENDS on a sheet leave one up: the sub step ends on the
 * bench question, the period step on the quarter panel. The next step in each
 * case points at a control on the BOARD, underneath the sheet that is still
 * there — the tour's own cut-out lets the tap through to whatever is topmost,
 * and what is topmost is the sheet. The two sheets that light and close take
 * `LIT_MS` to go, which the tour is already past, so this is what takes those
 * away too rather than waiting on them.
 *
 * So the question the tour asks on the way out of a step is "does the next one
 * still want this open", and the answer is this list plus the step's own `via`.
 */
export const PANEL_TARGETS: readonly TargetId[] = [
  'panel',
  'what.made',
  'what.miss',
  'assist.none',
  'player.sub',
];

/* ---- what finishes a step ------------------------------------------- */

/**
 * THE COMPLETION RULE, AS DATA.
 *
 * A step ends when the scorer DOES the thing, which means the tour has to
 * recognise the thing having been done. It watches two facts and nothing else:
 * which panel is open, and what the game looked like a moment ago against what
 * it looks like now. That is enough for all twenty and it keeps the rule out
 * of the components — `lib/tutorial.ts` decides, the overlay only asks.
 *
 * `next` is the escape hatch and it is deliberately narrow: three steps have
 * nothing to tap (the opening tour of the four regions, the chart, the last
 * screen), and those three get a button. A fourth would be a step that is
 * teaching nothing.
 */
export type Done =
  /** this panel came up */
  | { on: 'panel'; kind: string }
  /** an event of this type was logged */
  | { on: 'event'; type: string }
  /** any of the four tallies — a block, a steal, a turnover, a foul drawn */
  | { on: 'tally' }
  /**
   * WHATEVER THE BOARD OPENS, opened. One step uses it and it is the step about
   * a fouled-out row: which panel a row opens is `options.tap`'s business, and
   * a step that has to name the panel would be a step that has to branch on a
   * setting it is not about.
   */
  | { on: 'anyPanel' }
  /** a shot was logged, and it went in (or did not) */
  | { on: 'shot'; made: boolean }
  /** the possession count went up */
  | { on: 'poss' }
  /** the timeout count went up */
  | { on: 'timeout' }
  /** the clock was started or stopped */
  | { on: 'clock' }
  /** the log got SHORTER — the only thing that does that is undo */
  | { on: 'undo' }
  /** nothing to tap: the caption carries a Next */
  | { on: 'next' };

/* ---- where on the floor the hand lands ------------------------------ */

/**
 * A COORDINATE, AND ONLY THE THREE STEPS ABOUT THE FLOOR CARRY ONE.
 *
 * Every other target is a CONTROL, and the middle of a control is the only
 * honest place to point at one. The floor is not a control: it is seven zones,
 * and its middle is a two — so the step that says *out past the arc* while a
 * hand hovers over the paint is teaching the opposite of itself. The spot is
 * read as a share of the target's box, which is exactly what a court position
 * is, and `npm run check` asserts each one really is the shot its title names.
 */

/* ---- when a step is even in the tour -------------------------------- */

/**
 * A BRANCH, AND THERE ARE ONLY FOUR OF THEM.
 *
 * The board answers four questions differently depending on a setting the
 * scorer owns: whether a made shot asks for an assist, whether free throws are
 * one tap or a trip, whether a player's row opens their stats or the bench, and
 * whether the fourth footer cell counts possessions as well as timeouts.
 * Teaching the mode they are NOT in is teaching them a board they will never
 * see, so the step that does not apply is not in the tour at all — it is
 * dropped by `visibleSteps`, and the counter renumbers itself.
 *
 * The two rows are otherwise the same step, and they are two rows rather than
 * one that grows a clause because the tour is a title per control and a title
 * cannot say "or, on the other board".
 *
 * EVERY BRANCH DROPS EXACTLY ONE OF A PAIR, which is what keeps the tour the
 * same length whatever the settings say — `npm run check` holds it to that. The
 * footer's pair is the two halves of one cell: a split cell is taught by its
 * POSSESSION half, because a scorer who asked for that half is the only scorer
 * who has to be shown it, and a whole cell is taught as the timeout it is.
 */
export interface When {
  option: 'ft' | 'tap' | 'assist' | 'poss';
  is: string;
}

/* ---- a step ---------------------------------------------------------- */

export interface TutorialStep {
  /** stable, and the thing `tutorialLastStep` remembers — never the index */
  id: string;
  /** what the spotlight cuts around; null is a step about the whole board */
  target: TargetId | null;
  /**
   * WHERE THE SPOTLIGHT MOVES AS THE FLOW OPENS PANELS.
   *
   * Some steps are more than one tap — PF is a kind and then a player, RB is
   * the same — and the ring would be lying if it stayed on the key for both.
   * The tour re-resolves the target on every panel change: the first entry
   * whose `panel` is the one now open wins, and the bare `target` is what a
   * step points at with nothing open.
   *
   * IT IS NOT HOW THE SHOTS ARE TAUGHT. A shot is a spot, a result and a
   * shooter, and those are three STEPS rather than one step whose ring moves
   * three times: the card is a title, so a step that walks a scorer through
   * three different taps under one title is a title that names none of them.
   */
  via?: readonly { panel: string; target: TargetId }[];
  /** bold, three or four words, verb first — and the card's whole content */
  title: string;
  done: Done;
  /** where inside the floor the finger lands; the middle of it otherwise */
  spot?: Position;
  when?: When;
}

/**
 * THE SCRIPT.
 *
 * The order is the board's own: the floor first, because it is the primary
 * input and the thing that looks least like anything else on a phone; then the
 * three keys that take the same stats the other way round; then the opponent,
 * the rail, and the footer that runs the game. The last two steps before the
 * end are UNDO and the way out, in that order, because a scorer who has just
 * been told they can undo anything is a scorer willing to leave.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'board',
    target: null,
    title: 'The board has four parts',
    done: { on: 'next' },
  },
  {
    id: 'court',
    target: 'court',
    title: 'Tap the floor for two',
    done: { on: 'panel', kind: 'what' },
    spot: { x: 0.34, y: 0.42 },
  },
  {
    id: 'miss',
    target: 'what.miss',
    title: 'Tap MISS',
    done: { on: 'panel', kind: 'who' },
  },
  {
    id: 'who',
    target: 'panel',
    title: 'Tap the shooter',
    done: { on: 'shot', made: false },
  },
  /**
   * THE THREE IS TAUGHT THE WAY THE TWO WAS: a spot, a result, a shooter, one
   * step each. It was ONE step whose ring walked all three panels, and that
   * stopped working when the card became a title and nothing else — a scorer
   * reading *Now a made three* over a ring on the MADE tile is being told the
   * outcome of a flow rather than the tap in front of them. Three steps say
   * three things, and the second one is the point of the whole detour: the two
   * was a MISS, so MADE is a tile the tour has not asked for yet.
   *
   * THE LAST TAP IS WHERE THE BOARDS DIVERGE, so it is the one that is written
   * twice. On a board that asks for the assist the shot is not recorded until
   * that bar is answered — `pickAssist` is what writes it — so the ring follows
   * onto it and the title says the extra tap out loud. On a board that does
   * not, picking the shooter IS the shot. A scorer is never spotlit at a
   * control their board will never draw — see `When`.
   */
  {
    id: 'three',
    target: 'court',
    title: 'Tap outside the arc',
    done: { on: 'panel', kind: 'what' },
    spot: { x: 0.5, y: 0.86 },
  },
  {
    id: 'three.made',
    target: 'what.made',
    title: 'Tap MADE',
    done: { on: 'panel', kind: 'who' },
  },
  {
    id: 'three.who.ask',
    target: 'panel',
    via: [{ panel: 'assist', target: 'assist.none' }],
    title: 'Tap who scored, then assist',
    done: { on: 'shot', made: true },
    when: { option: 'assist', is: 'ask' },
  },
  {
    id: 'three.who.skip',
    target: 'panel',
    title: 'Tap who scored',
    done: { on: 'shot', made: true },
    when: { option: 'assist', is: 'skip' },
  },
  {
    id: 'chart',
    target: 'court',
    title: 'Every shot leaves a dot',
    done: { on: 'next' },
  },
  {
    id: 'pf',
    target: 'pf',
    via: [
      { panel: 'foulKind', target: 'panel' },
      { panel: 'who', target: 'panel' },
    ],
    title: 'Tap PF for a foul',
    done: { on: 'event', type: 'foul' },
  },
  {
    id: 'ft.quick',
    target: 'ft',
    via: [
      { panel: 'who', target: 'panel' },
      { panel: 'ftResult', target: 'panel' },
    ],
    title: 'Tap FT for 1-pointer',
    done: { on: 'event', type: 'freeThrow' },
    when: { option: 'ft', is: 'quick' },
  },
  {
    id: 'ft.trip',
    target: 'ft',
    via: [
      { panel: 'who', target: 'panel' },
      { panel: 'tripSize', target: 'panel' },
      { panel: 'tripShots', target: 'panel' },
    ],
    title: 'Tap FT for the trip',
    done: { on: 'event', type: 'freeThrow' },
    when: { option: 'ft', is: 'trip' },
  },
  {
    id: 'rb',
    target: 'rb',
    via: [
      { panel: 'rebKind', target: 'panel' },
      { panel: 'who', target: 'panel' },
    ],
    title: 'Tap RB for a rebound',
    done: { on: 'event', type: 'rebound' },
  },
  {
    id: 'opp',
    target: 'opp2',
    title: 'Give the other side two',
    done: { on: 'event', type: 'oppPoint' },
  },
  {
    id: 'row.stats',
    target: 'row.first',
    via: [{ panel: 'playerActions', target: 'panel' }],
    title: 'Tap a player to tally',
    done: { on: 'tally' },
    when: { option: 'tap', is: 'stats' },
  },
  {
    id: 'row.sub',
    target: 'row.first',
    via: [{ panel: 'subOut', target: 'panel' }],
    title: 'Tap a player to sub',
    done: { on: 'panel', kind: 'subOut' },
    when: { option: 'tap', is: 'sub' },
  },
  /**
   * WHAT THIS STEP SAYS IS WHAT THE BOARD DOES, and the board changed under it.
   * A fouled-out row was drafted to open its own "who replaces them" question,
   * then didn't — `FouledOutPanel` was drawn and nothing opened it — and the
   * line was rewritten to say the row simply stayed. It opens now, at the fifth
   * foul and from the dimmed row alike, and while there is anybody on the bench
   * it has to be answered: a player who is out may not be left in the five. So
   * the line says THAT, and the dimmed row a scorer actually meets is the one
   * case the app cannot fix for them — a bench with nobody on it.
   */
  {
    id: 'out',
    target: 'row.out',
    title: 'Tap the row marked OUT',
    done: { on: 'anyPanel' },
  },
  /**
   * THE FOURTH FOOTER CELL, AND WHICH OF THESE IS IN THE TOUR IS THE SETTING'S
   * ANSWER. A split cell is two controls and the tour teaches the half the
   * scorer opted into; a whole cell is the timeout count every board has.
   */
  {
    id: 'poss',
    target: 'poss',
    title: 'Tap Poss to count one',
    done: { on: 'poss' },
    when: { option: 'poss', is: 'on' },
  },
  {
    id: 'timeout',
    target: 'timeout',
    title: 'Tap Timeout when called',
    done: { on: 'timeout' },
    when: { option: 'poss', is: 'off' },
  },
  {
    id: 'clock',
    target: 'clock',
    title: 'Tap the time to start',
    done: { on: 'clock' },
  },
  {
    id: 'score',
    target: 'score',
    title: 'Your score, then theirs',
    done: { on: 'next' },
  },
  {
    id: 'quarter',
    target: 'quarter',
    via: [{ panel: 'endQuarter', target: 'panel' }],
    title: 'Tap the period cell',
    done: { on: 'panel', kind: 'endQuarter' },
  },
  {
    id: 'undo',
    target: 'undo',
    title: 'Undo takes it back',
    done: { on: 'undo' },
  },
  {
    id: 'done',
    target: null,
    title: 'That is the board',
    done: { on: 'next' },
  },
];

/* ---- the chrome, and the confirm ------------------------------------ */

/**
 * EVERY OTHER STRING THE TOUR PRINTS.
 *
 * The four region labels are step one's whole content — the only step that
 * writes on the board rather than beside it — and they are here for the same
 * reason the captions are.
 */
export const TUTORIAL_COPY = {
  /** the lobby's permanent way in. Not a card, not dismissible. */
  entry: 'How the board works',
  skip: 'Skip',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  /** printed as `4 / 18` — the two halves are joined by the overlay */
  counterSep: '/',
  /**
   * THE RESUME QUESTION, and it is asked only after a SKIP: a tour walked to the
   * end clears what it remembered, because there is nothing to pick up.
   */
  resumeTitle: 'Pick up where you left off?',
  resumeLine:
    'You stopped part way through last time. Carry on from there, or start again from the top.',
  resumeKeep: 'Carry on',
  resumeRestart: 'Start again',
  confirmTitle: 'Skip the tutorial?',
  confirmLine: 'You can restart it anytime from the lobby.',
  confirmSkip: 'Skip',
  confirmStay: 'Keep going',
  /** the one-time toast on the way out, pointing at the row that starts it */
  outro: 'Run it again from the lobby, anytime',
  /** the row is dark while a game is on, and this says why */
  busy: 'Finish or end your game first',
  /**
   * END GAME is one tap off the period panel, which the tour opens. Nothing is
   * filed while the tour is running, and a scorer who pressed it is owed the
   * reason rather than a screen that simply did not change.
   */
  notNow: 'Nothing is saved during the tutorial',
  regions: {
    court: 'The floor',
    sidecol: 'Fouls, free throws, rebounds',
    rail: 'Your five',
    footer: 'Undo, score, clock, timeouts',
  },
} as const;

/* ---- the throwaway game --------------------------------------------- */

/**
 * THE TEAM THE TOUR IS PLAYED WITH, AND IT IS NOT THE SCORER'S.
 *
 * Eight shirts: five who tip off, three on the bench so a substitution has
 * somewhere to go, and ONE OF THE FIVE ALREADY DISQUALIFIED — which leaves four
 * on the floor and the fifth row showing OUT.
 *
 * THE DISQUALIFIED ONE HAS TO BE A STARTER, and that is not a detail. The rail
 * draws `useRailPlayers`: the active five, THEN the disqualified, sliced to
 * five. A bench player sent off is never reached by that slice, so the step
 * about a fouled-out row would point at a row that is not on screen. Taking one
 * of the five off is also the honest state — somebody has fouled out and has
 * not been replaced yet, which is exactly the board a scorer is looking at when
 * the question matters.
 *
 * Seeding them OUT rather than on four fouls is deliberate too: coupling this
 * to whether the scorer actually tapped PF eight steps earlier is a tour that
 * breaks depending on how it was walked.
 *
 * THE IDS ARE PREFIXED `t`, so nothing here can collide with a real roster's
 * `p${number}` or with `newRosterId`'s `r…`. They are never written to a
 * roster and never saved; see `store/tutorialStore.ts` for what happens to the
 * game they build.
 *
 * The names are ORDINARY and short. Numbered blanks would make the rail read as
 * a placeholder, and a placeholder is the one thing the tour cannot afford: the
 * whole argument for running on the real board is that nothing on it is mimed.
 */
export const TUTORIAL_SQUAD: readonly RosterPlayer[] = [
  { id: 't1', number: 4, name: 'Minh', available: true },
  { id: 't2', number: 7, name: 'Khoa', available: true },
  { id: 't3', number: 9, name: 'Duy', available: true },
  { id: 't4', number: 12, name: 'Nam', available: true },
  { id: 't5', number: 15, name: 'Bảo', available: true },
  { id: 't6', number: 21, name: 'Long', available: true },
  { id: 't7', number: 23, name: 'Hải', available: true },
  { id: 't8', number: 30, name: 'Sơn', available: true },
];

/** The five who tip off. The rest sit, and one of them is sent off below. */
export const TUTORIAL_STARTERS: readonly string[] = ['t1', 't2', 't3', 't4', 't5'];

/**
 * Already disqualified when the tour opens, and ONE OF THE FIVE — see the note
 * on the squad for why a bench player would never reach the rail.
 */
export const TUTORIAL_FOULED_OUT = 't5';

/**
 * A BOARD THAT OPENS AT ZERO.
 *
 * Score, opponent's score and the possession count all start at nothing, so
 * every number the tour puts on the footer is a number the SCORER put there.
 * It carried a running scoreboard once — 18-21 off nine possessions, on the
 * argument that a readout of something reads better than three zeros — and the
 * trade was the wrong way round: a scorer three steps in cannot tell which of
 * those figures moved when they tapped, and the first thing a walkthrough owes
 * them is cause and effect. The log was always empty for the same reason.
 */
export const TUTORIAL_BOARD = {
  score: 0,
  oppScore: 0,
  possessions: 0,
  timeouts: 0,
  /** part way into the second period, stopped, which is the honest base state */
  period: 2,
} as const;

/** Whether a step applies, given the settings the scorer actually has. */
export const stepApplies = (step: TutorialStep, o: Options): boolean =>
  !step.when || String(o[step.when.option]) === step.when.is;
