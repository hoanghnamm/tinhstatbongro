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
 * THE THIRD STEP NO LONGER EXPLAINS THE BOARD — IT OPENS IT. It was a picture
 * of the board with four numbered lines under it, and what replaced it is the
 * WALKTHROUGH: the door pushes the real board with the tour running over it,
 * and the scorer comes back here for the trial when it ends or is skipped. A
 * screenshot with a list beside it is the app describing two taps; the tour is
 * the scorer doing them. `BOARD_STEPS` and the four lines went with it — see
 * the cut list — and the miniature stays as the PICTURE on the invitation,
 * because the board being light is still the one thing a dark onboarding
 * cannot say in words.
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
    title: 'Learn the board in',
    hi: 'two minutes.',
    blurb: 'You keep stats on the real board, on a game that is not real, and nothing is saved.',
  },
  trial: {
    title: 'You have',
    hi: '1 free game.',
    blurb: 'It is spent when a game reaches the shelf, so a warm-up costs nothing.',
  },
};

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
