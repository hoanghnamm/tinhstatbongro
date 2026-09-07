/**
 * THE DOOR'S OWN COPY, IN ONE TABLE.
 *
 * Every string `app/intro.tsx` prints that is not a control's label lives
 * here, for the reason every other table in `constants/` does: it is data
 * about the app rather than a decision the screen makes, and `npm run check`
 * can walk it without React. A step with no title, or a fourth thing on a
 * screen built for three, is caught by the script rather than by opening the
 * app on a phone.
 *
 * THE ORDER OF THE STEPS IS THE ARGUMENT. Who you are, who is on the team,
 * how the board works, what it costs. The first two ask the scorer for
 * something and each one is a thing the app genuinely cannot guess; the last
 * two ask for nothing and are the two that may be walked past.
 *
 * THERE WAS A THIRD ASKING STEP — *Your league, your rules*, the `periods` and
 * `periodLen` pair that is STAMPED on a game at tip-off, with a readout of the
 * four settings that are not. It is CUT. Those two are still the only settings
 * a scorer cannot fix afterwards for a game already played, and they are still
 * asked — on `app/settings.tsx`, which is one tap off the lobby and is not
 * gated, exactly so that this is true. What the door was doing was putting a
 * form in front of a default (4 × 10:00) that is right for most of the people
 * walking through it. Do not put it back without being asked.
 */
export const INTRO_STEPS = ['club', 'roster', 'board', 'trial'] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

export interface StepCopy {
  /** the headline. The second half is LIT where there is one; see `hi`. */
  title: string;
  /** the half of the headline painted with `glowInk`, on its own line */
  hi?: string;
  /** one sentence under it, never two */
  blurb: string;
}

export const INTRO_COPY: Record<IntroStep, StepCopy> = {
  club: {
    title: 'Name your club.',
    blurb: 'Every game you keep is filed under it, and the crest falls back to it.',
  },
  roster: {
    title: "Who's on the team?",
    blurb: 'Numbers and names. You can change either of them at any time.',
  },
  board: {
    title: 'Logging is fast',
    hi: '2 to 3 taps',
    blurb: 'One screen, nothing to scroll, and the floor is where a shot starts.',
  },
  trial: {
    title: 'You have',
    hi: '1 free game.',
    blurb: 'It is spent when a game reaches the shelf, so a warm-up costs nothing.',
  },
};

/**
 * THE FOUR WAYS INTO A STAT, NUMBERED — and the numbers are the whole device:
 * each one is drawn twice, once on the miniature board and once at the head of
 * its own line, so the picture and the list are read as one thing.
 *
 * `taps` is a COUNT and it is printed. It is the claim the headline makes, and
 * a screen that promises two taps without showing where they land is a slogan.
 *
 * ONE OF THE FOUR IS BLUE. The court's badge takes `live` rather than `accent`
 * because the mark it points at is the live tap mark, which is `live` on the
 * real floor for the reason written on that token — a tap not yet resolved is
 * not a made shot. The other three are accent.
 */
export interface BoardStep {
  n: number;
  title: string;
  taps: string;
  blurb: string;
  /** the one that points at the court's own mark; see above */
  live?: boolean;
}

export const BOARD_STEPS: readonly BoardStep[] = [
  {
    n: 1,
    title: 'Tap the floor.',
    taps: '3 TAPS',
    blurb: 'Where it went up, who took it, in or out. The zone decides 2 or 3.',
    live: true,
  },
  {
    n: 2,
    title: 'Tap a player.',
    taps: '2 TAPS',
    blurb: 'Block, steal, turnover, foul drawn — or send them to the bench.',
  },
  {
    n: 3,
    title: 'PF, FT, RB.',
    taps: '3 TAPS',
    blurb: 'The same stats the other way round: what happened, then who.',
  },
  {
    n: 4,
    title: 'The footer runs it.',
    taps: '1 TAP',
    blurb: 'UNDO, the score, the clock, timeouts. Blue runs, red is stopped.',
  },
];

/**
 * WHAT THE ONE FREE GAME ACTUALLY BUYS.
 *
 * Three, like the paywall's `BENEFITS`, and deliberately NOT the same three:
 * that list sells the subscription and this one describes the trial. They sit
 * one tap apart on the last step, so saying the same sentence twice would make
 * it mean less on both — the same argument `Locked` and the paywall's headline
 * settle between them.
 *
 * The glyphs are the tab bar's `MaterialCommunityIcons`, which is the app's
 * one icon set; a second here would read as a screen borrowed from elsewhere.
 */
export interface TrialGift {
  icon: string;
  title: string;
  blurb: string;
}

export const TRIAL_GIVES: readonly TrialGift[] = [
  {
    icon: 'basketball',
    title: 'The board',
    blurb: 'The whole court, the clock and every stat, with nothing held back.',
  },
  {
    icon: 'chart-bar',
    title: 'Line-up',
    blurb: 'Who played, how long, and what the team did while they were on.',
  },
  {
    icon: 'archive-outline',
    title: 'Stored game stats',
    blurb: 'It stays on the shelf when the night is over, and opens again.',
  },
];
