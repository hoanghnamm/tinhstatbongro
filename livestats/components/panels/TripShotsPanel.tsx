import { Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { useGameStore } from '../../store/gameStore';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fUi } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Btn, PTitle, Row, Stack } from './shell';

/**
 * Batched free throws, step 2. Every attempt toggles and can be re-tapped
 * before SAVE, which is the point of the batched mode: the scorer writes the
 * whole trip once it is over rather than racing each shot.
 */
export function TripShotsPanel() {
  const m = useMetrics();
  const t = useTheme();
  const trip = useUiStore((s) => s.trip);
  const setTrip = useUiStore((s) => s.setTrip);
  const reset = useUiStore((s) => s.reset);
  const recordFreeThrowTrip = useGameStore((s) => s.recordFreeThrowTrip);
  const p = usePlayer(trip?.shooter ?? null);
  const { back } = useFlow();

  useAnnounce('free throws');
  if (!trip || !p) return null;

  const made = trip.shots.filter((r) => r === true).length;
  const done = trip.shots.every((r) => r !== null);

  const set = (i: number, value: boolean) => () => {
    const shots = trip.shots.slice();
    shots[i] = value;
    setTrip({ ...trip, shots });
  };

  // fill and ink are picked together: MADE goes accent-on-accent-ink, MISS goes
  // ink-on-surface, and neither half is ever set without the other
  const tbtn = (label: string, on: boolean, dark: boolean, onPress: () => void) => {
    const fill = on ? (dark ? t.ink : t.accent) : 'transparent';
    const ink = on ? (dark ? t.surface : t.accentInk) : t.ink;
    return (
      <Press
        onPress={onPress}
        accessibilityLabel={label}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minHeight: m.tap,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderRadius: m.rSm,
          borderColor: on ? fill : t.line,
          backgroundColor: fill,
        }}
        pressedStyle={{ opacity: 0.85 }}
      >
        <Text
          numberOfLines={1}
          style={{ ...fUi(600), fontSize: m.fsMd, textAlign: 'center', color: ink }}
        >
          {label}
        </Text>
      </Press>
    );
  };

  return (
    <>
      <PTitle title="Free throws" kind={`#${p.number} · ${made}/${trip.shots.length}`} />
      <Stack>
        {trip.shots.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: m.sp,
              borderWidth: 1,
              borderColor: t.line,
              borderRadius: m.r,
              padding: m.sp,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexGrow: 0, flexShrink: 0,
                ...fUi(600), fontSize: m.fsMd, color: t.ink2,
                minWidth: Math.min(90, Math.max(48, m.win.h * 0.09)),
              }}
            >
              {trip.andOne ? 'And-1' : 'Shot ' + (i + 1)}
            </Text>
            {tbtn('Made', r === true, false, set(i, true))}
            {tbtn('Miss', r === false, true, set(i, false))}
          </View>
        ))}
      </Stack>
      <Row mt>
        <Btn label="Back" onPress={back} />
        <Btn
          label={done ? 'Save' : 'Tap each shot'}
          variant="accent"
          disabled={!done}
          onPress={() => {
            const results = trip.shots.filter((r): r is boolean => r !== null);
            if (results.length !== trip.shots.length) return;
            recordFreeThrowTrip(trip.shooter, results, trip.andOne);
            reset();
          }}
        />
      </Row>
    </>
  );
}
