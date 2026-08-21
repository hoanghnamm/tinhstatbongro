import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
// deep imports on purpose: the package roots re-export every weight and italic,
// which drags ~10MB of unused TTF into the bundle
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import '../global.css';
import { useClock } from '../hooks/useClock';
import { themeVars, useTheme } from '../theme/useTheme';

/**
 * The shell every route sits in: the palette and the status bar.
 *
 * The game clock is started HERE rather than on the board, and that is not an
 * oversight. A running clock is a fact about the game, not about which screen
 * is showing — walking off to MY TEAM mid-quarter must not quietly stop
 * crediting minutes, and `useClock` derives elapsed time from a wall stamp, so
 * it only credits what it is mounted for.
 */
function Root() {
  const t = useTheme();
  useClock();

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
    </View>
  );
}

export default function RootLayout() {
  /**
   * INTER ONLY, AND ON iOS IT IS NOT EVEN USED. The type is Helvetica Neue,
   * which is an Apple system face: it needs no loading and cannot be bundled.
   * Inter is what Android draws instead — see `fUi`/`fNum` — so these four are
   * loaded on both platforms rather than behind a branch, because a
   * conditional hook is worse than four unused faces on a phone that has them
   * cached anyway.
   */
  const [ready] = useFonts({
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
    void ScreenOrientation.unlockAsync();
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
