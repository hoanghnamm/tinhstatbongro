import { View } from 'react-native';

import { useGameStore } from '../../store/gameStore';
import { useMetrics } from '../../theme/metrics';
import { SBtn } from './SBtn';

/**
 * The opponent's whole input: +1 / +2 / +3, recorded on the tap with no panel.
 * A three used to be three taps. There is no opponent roster and no opponent
 * shot chart — a scoreboard only needs the total.
 */
export function OppButtons({
  innerRef,
  onLayout,
}: {
  innerRef: React.Ref<View>;
  onLayout(): void;
}) {
  const m = useMetrics();
  const ended = useGameStore((s) => s.ended);
  const recordOppPoint = useGameStore((s) => s.recordOppPoint);

  const add = (n: number) => () => {
    if (!ended) recordOppPoint(n);
  };

  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
      style={
        m.portrait
          ? {
              flex: 1, flexDirection: 'row', alignItems: 'stretch',
              minHeight: m.barh, gap: m.sp,
            }
          : {
              flex: 1, flexDirection: 'column', alignItems: 'stretch',
              gap: m.sp, minHeight: 0,
            }
      }
    >
      <SBtn code="+1" label="OPP" opp onPress={add(1)} accessibilityLabel="add one point to the opponent" />
      <SBtn code="+2" label="OPP" opp onPress={add(2)} accessibilityLabel="add two points to the opponent" />
      <SBtn code="+3" label="OPP" opp onPress={add(3)} accessibilityLabel="add three points to the opponent" />
    </View>
  );
}
