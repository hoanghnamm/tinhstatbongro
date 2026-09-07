import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
// deep imports on purpose: the package roots re-export every weight and italic,
// which drags ~10MB of unused TTF into the bundle
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import '../global.css';
import { Launch } from '../components/ui/Launch';
import { useClock } from '../hooks/useClock';
import { useIntroStore } from '../store/introStore';
import { themeVars, useTheme } from '../theme/useTheme';

/**
 * The shell every route sits in: the palette and the status bar.
 *
 * The game clock is started HERE rather than on the board, and that is not an
 * oversight. A running clock is a fact about the game, not about which screen
 * is showing — walking off to MY TEAM mid-quarter must not quietly stop
 * crediting minutes, and `useClock` derives elapsed time from a wall stamp, so
 * it only credits what it is mounted for.
 *
 * AND IT MOUNTS THE LAUNCH PAGE, OVER THE NAVIGATOR.
 *
 * `components/ui/Launch.tsx` is the mark on the room's own ground, and it is
 * NOT a route — see the note there for why a splash you can navigate to is a
 * bug. This is the only place in the app that can draw a screen over every
 * screen, so this is where it goes: it sits above the `Stack`, absolutely
 * positioned, and lifts once the app knows which route the scorer should have
 * been on.
 *
 * WHAT IT IS COVERING IS A DECISION, not a load. The fonts are already in
 * before any of this renders (see below). What is still unknown is whether
 * this install has been through the DOOR — `hooplog-intro` off AsyncStorage —
 * and that answer reads `false` before it lands, which is the answer that
 * opens the onboarding. So the lobby mounts underneath, `hooks/useIntro.ts`
 * replaces it with `/intro` if it has to, and the launch page is what the
 * scorer looks at while that happens: nobody sees a lobby they were not meant
 * to be on, and nobody sees the onboarding start up over a season of games.
 *
 * IT IS GATED ON THE INTRO STORE ALONE. Every other persisted store is read by
 * a screen that already draws an empty state for "not yet" — a shelf with no
 * rows, a season with no games. This one is the only one whose answer changes
 * WHICH SCREEN the scorer lands on, so it is the only one worth holding a
 * frame for.
 */
function Root() {
  const t = useTheme();
  useClock();

  // one boolean, and it is not in a store: nothing but this view depends on
  // whether the mark has finished getting out of the way
  const [opened, setOpened] = useState(false);
  const hydrated = useIntroStore((s) => s.hydrated);

  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, themeVars(t)]}>
      {/* one skin, and it is light: dark ink in the status bar, always */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          // transparent, so the shell's fill above is the one background
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      {/* LAST, so it is over the navigator rather than under it. It removes
          itself: once it is gone there is nothing left of it in the tree. */}
      {!opened && <Launch ready={hydrated} onDone={() => setOpened(true)} />}
    </View>
  );
}

export default function RootLayout() {
  /**
   * ANTON ON BOTH, INTER ON ANDROID ONLY. The BODY type is the SYSTEM face —
   * San Francisco on iOS, which needs no loading and cannot be bundled. Inter
   * is what Android draws instead — see `fUi`/`fNum` — so those four are loaded
   * on both platforms rather than behind a branch, because a conditional hook
   * is worse than four unused faces on a phone that has them cached anyway.
   * ANTON is the exception in both directions: it is bundled, and it is drawn
   * on iOS too, because a wordmark that changes shape between two phones is not
   * a wordmark. See `fDisplay`.
   */
  const [ready] = useFonts({
    // the one face that is loaded because it is USED on both platforms: the
    // wordmark and the crest's monogram, and nothing else — see `fDisplay`
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  /**
   * Every orientation stays allowed at the OS level. HOME and MY TEAM are
   * designed for both, and so is the board on a tablet — the one case that is
   * not usable, a portrait PHONE, is gated in JS by `RotateGate` inside
   * `game.tsx`. Locking here would take the tablet's portrait layout with it.
   */
  useEffect(() => {
    // IT IS CAUGHT, AND `void` WAS NOT ENOUGH. On the web this reaches
    // `screen.orientation.unlock()`, which a desktop browser rejects outright
    // with `NotSupportedError` — a monitor has no orientation to release.
    // `void` only silences the FLOATING-PROMISE lint; it does not handle a
    // rejection, so the one call in the app with nothing to do on this
    // platform was the only red line in a browser console. There is nothing
    // to recover from and nothing to tell the scorer: every orientation is
    // already allowed wherever the lock does not exist, which is what this
    // asked for.
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  // holding the first frame until the fonts land avoids a reflow of every
  // number on the board, which is most of it
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
