import { Text } from 'react-native';

import { PERIOD_LEN } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { mmss, ord } from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn, PTitle, Row, Stack } from './shell';

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Also the clock panel. Once the time itself became the run/stop control it
 * stopped being an entrance to anything, so the period label carries both jobs:
 * ending the quarter and correcting a wrong clock.
 *
 * END QUARTER stays a confirm rather than a direct action, because a mis-tap
 * there throws away whatever time is still on the board.
 */
export function EndQuarterPanel() {
  const m = useMetrics();
  const t = useTheme();
  const period = useGameStore((s) => s.period);
  const remaining = useGameStore((s) => s.remaining);
  const adjustClock = useGameStore((s) => s.adjustClock);
  const resetClock = useGameStore((s) => s.resetClock);
  const nextQuarter = useGameStore((s) => s.nextQuarter);
  const reset = useUiStore((s) => s.reset);

  useAnnounce(`${ord(period)} quarter`);

  return (
    <>
      <PTitle title={`${ord(period)} quarter`} kind={`${mmss(remaining)} LEFT`} tone="ink" />
      <Text
        style={{
          fontFamily: fNum(700),
          fontSize: clamp(44, 0.11 * m.win.h, 120),
          textAlign: 'center',
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {mmss(remaining)}
      </Text>
      <Text
        style={{
          fontFamily: fNum(600), fontSize: m.fsMd, textAlign: 'center',
          color: t.ink2, marginTop: m.s1,
        }}
      >
        {ord(period)} Quarter
      </Text>
      <Stack>
        <Row mt>
          <Btn label="MINUS 1:00" onPress={() => adjustClock(-60)} />
          <Btn label="PLUS 1:00" onPress={() => adjustClock(60)} />
        </Row>
        <Row>
          <Btn label={`RESET ${mmss(PERIOD_LEN)}`} onPress={resetClock} />
        </Row>
        <Row>
          <Btn
            label="END QUARTER"
            variant="made"
            onPress={() => {
              nextQuarter();
              reset();
            }}
          />
        </Row>
        <Row>
          <Btn label="CLOSE" variant="solid" onPress={reset} />
        </Row>
      </Stack>
    </>
  );
}
