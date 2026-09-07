import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Bloom } from './Bloom';
import { Wordmark } from './Wordmark';
import { Col } from './Row';
import { useMetrics } from '../../theme/metrics';
import { DARK } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/useTheme';

/**
 * THE LAUNCH PAGE — the mark, on the room's own ground, before there is a
 * screen to be on.
 *
 * ## IT IS NOT A ROUTE, AND THAT IS THE POINT
 *
 * Every other screen in this app is a file under `app/`. This one is not, and
 * the reason is what a launch screen IS: a place you are shown, never a place
 * you go. A route can be pushed onto, backed into and deep-linked at, and all
 * three are wrong here — a scorer who lands back on a splash from the lobby is
 * looking at a bug. It is mounted by `app/_layout.tsx` OVER the navigator, so
 * it covers whatever the first route happens to be while the app decides which
 * route that should have been. The tab group's own index route is `/`, so
 * there is no `app/index.tsx` slot for it to take even if it wanted one.
 *
 * ## WHAT IT IS ACTUALLY WAITING FOR
 *
 * `hooplog-intro` off AsyncStorage. `seen` reads `false` before that lands,
 * and `false` is the answer that sends a scorer through the door — so acting
 * on it early would restart the onboarding on the hundredth launch. The wait
 * is real work and this is the screen that covers it; see `hooks/useIntro.ts`.
 *
 * `MIN_MS` is the other half. The read usually resolves in a few frames, and a
 * mark that appears and vanishes inside 80ms reads as a flicker rather than as
 * a brand. It is a FLOOR and not a delay: the two run together, and the screen
 * lifts on whichever finishes last.
 *
 * ## IT FADES, IT DOES NOT CUT
 *
 * The screen under it is the same near-black with the same bloom in the same
 * corner, so a cut would look like a repaint. `Animated` rather than
 * Reanimated: one opacity on one view, driven natively, for which the worklet
 * runtime is a dependency this file would be borrowing for nothing.
 *
 * IT DECLARES ITS OWN PALETTE. The root sits on the light one — it is the
 * board's, and the board is what the root is a shell for — so the mark would
 * otherwise be drawn dark-on-dark. `DARK` here rather than `DarkRoom` because
 * that one flips the status bar ON FOCUS and this is not a focusable screen:
 * the bar is the root's own `dark` for the ~700ms this is up, which is the
 * SAME ink the four rooms behind it will ask for a moment later.
 */

/** The floor, in milliseconds — see above. Long enough to read, short enough
 *  that nobody waits for it. */
const MIN_MS = 700;

/** How long the mark takes to get out of the way once both are satisfied. */
const FADE_MS = 260;

export function Launch({ ready, onDone }: { ready: boolean; onDone(): void }) {
  const m = useMetrics();

  // the FLOOR, tracked separately from `ready` so the two can be waited on
  // together rather than one after the other
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHeld(true), MIN_MS);
    return () => clearTimeout(id);
  }, []);

  const fade = useRef(new Animated.Value(1)).current;
  // `onDone` is called from the animation's completion, and the ref is what
  // keeps the effect from restarting the fade every time the parent re-renders
  // with a fresh closure
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!ready || !held) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => done.current());
  }, [ready, held, fade]);

  return (
    <ThemeProvider value={DARK}>
      <Animated.View
        // it covers the navigator and everything on it, and it must not be
        // tappable through — nothing under it is meant to be reachable yet
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: DARK.bg,
          opacity: fade,
        }}
      >
        <Bloom />

        {/* THE MARK SITS ABOVE CENTRE, not on it. A lockup centred in a tall
            box reads as floating; a third of the way down is where a title
            page puts one, and it is also where the lobby's own header lands,
            so the mark barely moves when this lifts. */}
        <Col
          align="flex-start"
          justify="center"
          style={{
            flex: 1,
            paddingHorizontal: m.s6,
            paddingBottom: m.win.h * 0.18,
          }}
        >
          <Wordmark size={m.fs3xl} />
        </Col>
      </Animated.View>
    </ThemeProvider>
  );
}
