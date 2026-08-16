import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFonts } from 'expo-font';
// deep imports on purpose: the package roots re-export every weight and italic,
// which drags ~10MB of unused TTF into the bundle
import { ChakraPetch_500Medium } from '@expo-google-fonts/chakra-petch/500Medium';
import { ChakraPetch_600SemiBold } from '@expo-google-fonts/chakra-petch/600SemiBold';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import './global.css';
import { Toast } from './components/Toast';
import { Board } from './components/board/Board';
import { PanelHost } from './components/panels/PanelHost';
import { useClock } from './hooks/useClock';
import { themeVars, useTheme } from './theme/useTheme';

function Root() {
  const t = useTheme();
  useClock();

  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, themeVars(t)]}>
      {/* the frosted skins need something behind the blur to show */}
      {t.bgWash && (
        <LinearGradient
          colors={[t.bgWash[0], t.bgWash[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
      )}
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Board />
      <PanelHost />
      <Toast />
    </View>
  );
}

export default function App() {
  const [ready] = useFonts({
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // both orientations are supported layouts, not error states
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
