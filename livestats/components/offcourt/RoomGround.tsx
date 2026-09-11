import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bloom } from '../ui/Bloom';
import { useMetrics } from '../../theme/metrics';
import { BLOOM_HEIGHT, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** The three refreshed rooms feather the bloom's lower edge without changing it elsewhere. */
export function RoomGround() {
  const m = useMetrics();
  const t = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      <Bloom />
      <LinearGradient
        colors={[withAlpha(t.bg, 0), withAlpha(t.bg, 0), t.bg]}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: m.win.h * BLOOM_HEIGHT }}
      />
    </View>
  );
}
