import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * HOW MUCH OF A ROOM THE TAB BAR IS STANDING ON.
 *
 * The four rooms share one bar and the bar is TWO BARS — see
 * `app/(tabs)/_layout.tsx` — and the two occupy their screen in opposite ways,
 * which is the whole reason this is a hook and not a number written four times:
 *
 *   iOS      the UIKit bar is GLASS, and glass has something behind it: the
 *            scene runs the full height of the window and the bar sits ON TOP
 *            of its last 49 points, plus the home indicator underneath. So the
 *            content owes the bar its height, and `safe.bottom` alone does not
 *            cover it — the provider is at the root of `app/_layout.tsx`, above
 *            the tab controller, so it reports the WINDOW's inset and knows
 *            nothing about a bar nested inside it.
 *   Android  the JS bar is a flex sibling of the scene and reserves the system
 *            navigation inset itself, so the scene already stops above both.
 *            The screen owes it NOTHING — and paying `safe.bottom` there is the
 *            double count that left a dead strip of canvas under the last row.
 *
 * A screen therefore adds THIS plus whatever breathing room it wants, and never
 * `safe.bottom` on its own. It is spent on the SCROLL CONTENT and not on the
 * frame: the list runs to the bar and scrolls out from under it, which is what
 * the glass is for.
 */

/** The standard UIKit tab bar, above the home indicator `safe.bottom` covers. */
const BAR_H = 49;

export function useTabInset(): number {
  const safe = useSafeAreaInsets();
  return Platform.OS === 'ios' ? safe.bottom + BAR_H : 0;
}
