/**
 * HOW WIDE A FIGURE IS, MEASURED — the one thing a fixed-width numeric cell
 * needs to know and the one thing every one of them used to guess.
 *
 * A column that holds a number is sized here in EM of its own type size, and
 * for a long time each of those multipliers was somebody's eye. That works
 * until a glyph is not the width it looks: **Inter's percent sign is a full
 * em**, half again as wide as one of its digits, so `100%` is nearly three em
 * where `12.5` is two and a third. Every percentage cell in the stats screens
 * was sized as if the two were the same, and a perfect quarter from the corner
 * printed `100…` on every phone this app runs on.
 *
 * So the advances are read out of the face instead. The numbers below are
 * Inter's own `hmtx`, in em, at the four weights the app sets — and Inter is
 * the right face to size against even on iOS, where the body face is San
 * Francisco: SF is the narrower of the two at every glyph here, so a cell that
 * holds its string in Inter holds it in SF as well. One table, both platforms,
 * and the wider one wins.
 *
 * `tab` is the TABULAR digit, which is what these cells are set in — every
 * numeral in the app that can change carries `fontVariant: ['tabular-nums']`,
 * so all ten are one width and a figure's width is a count of its characters
 * rather than a sum over which digits happen to be in it today.
 *
 * IT IMPORTS NOTHING. `lib/selfcheck.ts` holds the columns to these widths
 * under plain node, exactly as it does the court's geometry, which it cannot
 * do through a module that reaches for react-native.
 */

export type FigWeight = 400 | 500 | 600 | 700;

/**
 * The glyphs a figure is made of.
 *
 * `p`, `t` and `s` are in it because `pts` is the ONE word a figure carries —
 * the comparison table's Change cell, where a percentage row has to say which
 * of two quantities its number is. Anything else falls back to `%`, the widest
 * of them: a cell that over-estimates a string it was not built for sets it a
 * step small, and a cell that under-estimates one clips it.
 */
const ADVANCE: Record<FigWeight, Record<string, number>> = {
  400: { tab: 0.646, '.': 0.2881, ',': 0.2881, '-': 0.46, '–': 0.5, '—': 1, '+': 0.6616, '%': 0.9819, '/': 0.3604, ':': 0.2881, ' ': 0.2813, 'p': 0.6123, 't': 0.3271, 's': 0.5278, '(': 0.3647, ')': 0.3647 },
  500: { tab: 0.6563, '.': 0.3032, ',': 0.3032, '-': 0.4624, '–': 0.5, '—': 1, '+': 0.6675, '%': 0.9932, '/': 0.3696, ':': 0.3032, ' ': 0.2666, 'p': 0.6182, 't': 0.3403, 's': 0.5386, '(': 0.3687, ')': 0.3687 },
  600: { tab: 0.666, '.': 0.3188, ',': 0.3188, '-': 0.4653, '–': 0.5, '—': 1, '+': 0.6729, '%': 1.0044, '/': 0.3789, ':': 0.3188, ' ': 0.252, 'p': 0.624, 't': 0.353, 's': 0.5493, '(': 0.373, ')': 0.373 },
  700: { tab: 0.6763, '.': 0.334, ',': 0.334, '-': 0.4678, '–': 0.5, '—': 1, '+': 0.6787, '%': 1.0156, '/': 0.3882, ':': 0.334, ' ': 0.2368, 'p': 0.6304, 't': 0.3662, 's': 0.5601, '(': 0.377, ')': 0.377 },
};

/**
 * A figure's width in EM of its own font size, tracking included.
 *
 * The tracking term is `n − 1` and not `n`: the platforms disagree about
 * whether the last character carries its letter-spacing, and every step on the
 * ramp a number is set at is NEGATIVE, so counting one gap fewer is the answer
 * that is never short.
 */
export function figEm(text: string, weight: FigWeight = 700, lsEm = 0): number {
  const a = ADVANCE[weight];
  const chars = [...text];
  let w = 0;
  for (const c of chars) w += c >= '0' && c <= '9' ? a.tab : (a[c] ?? a['%']);
  return w + Math.max(0, chars.length - 1) * lsEm;
}

/**
 * The first size on `steps` that holds `text` in `avail` PIXELS — the biggest
 * one, since the ramp is handed down — and the smallest step when none of them
 * does, because a figure set two points small is read and a figure with an
 * ellipsis in it is not.
 *
 * `avail` of zero or less means nothing has been measured yet, which is the
 * first paint of a cell that sizes itself: the ideal step is what it draws,
 * so a value that was always going to fit never flickers.
 */
export function figFit(text: string, avail: number, steps: number[], weight: FigWeight = 700, lsEm = 0): number {
  if (avail <= 0) return steps[0];
  const em = figEm(text, weight, lsEm);
  return steps.find((fs) => em * fs <= avail) ?? steps[steps.length - 1];
}
