/**
 * Colours resolve through CSS variables, not literals: the root view writes the
 * live palette with `vars()` (theme/useTheme.ts), so a class follows the skin
 * without tailwind knowing the skin exists. `global.css` holds the light values
 * as the fallback.
 *
 * Sizes are deliberately absent. Every one of them is a `clamp()` off the
 * window height (theme/metrics.ts), which a static class cannot express.
 */
const color = (name) => `var(--color-${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  /**
   * Not a styling choice — nothing here uses a `dark:` variant, because the
   * palette is swapped wholesale by `useTheme()` and pushed down as CSS
   * variables. It is `class` because the preset's `media` default crashes the
   * web runtime: react-native-css-interop reads the darkMode flag from a
   * MutationObserver on <head>, then calls `colorScheme.set()` with it — and
   * `set()` throws when the mode is `media`. `class` makes that call legal.
   */
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: color('ink'),
        'ink-2': color('ink-2'),
        'ink-3': color('ink-3'),
        bg: color('bg'),
        surface: color('surface'),
        'surface-2': color('surface-2'),
        press: color('press'),
        rule: color('rule'),
        line: color('line'),
        accent: color('accent'),
        'accent-2': color('accent-2'),
        'accent-ink': color('accent-ink'),
        danger: color('danger'),
        'danger-ink': color('danger-ink'),
        court: color('court'),
        'court-line': color('court-line'),
        mark: color('mark'),
        'mark-miss': color('mark-miss'),
        'live-fill': color('live-fill'),
        'clock-ink': color('clock-ink'),
      },
    },
  },
  plugins: [],
};
