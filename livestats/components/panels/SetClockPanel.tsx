import { useState } from 'react';
import { Text } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import {
  clockEntry,
  clockReady,
  mmss,
  periodLabel,
  periodName,
  pushClockDigit,
  secondsFromClock,
} from '../../lib/format';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { CancelX, PHead, PRows, PTitleText, Tile } from './shell';

/**
 * The clock keypad, reached from SET on the quarter panel. A `court` panel like
 * the foul menu it is tapped next to, and the same shell throughout: `PHead`
 * with the title and the X, then the 1px seam grid.
 *
 * **Three rows, and the readout lives in the header.** That is the whole layout
 * constraint, not a preference. `courtBox` is the board's full height, not the
 * court's, so the tightest case is a 330×490 phone in portrait: 321×204, which
 * after the header leaves 156px — three tap-sized rows at 52 each, and a fourth
 * would put every one of them at 39. A readout band of its own would take one
 * of the three. So the entry sits beside the title, dimmed while it still shows
 * the live clock and solid once the first digit lands.
 *
 * Twelve cells, 4×3: the familiar 3×3 of digits with the two actions down the
 * right, backspace and enter in a desk numpad's corners.
 *
 * The actions carry a **one- or two-character code with the word as caption**,
 * `<`/DEL and `OK`/SET, and that is a width rule rather than a style: a tile's
 * code is `fs3xl`, which reaches 59 on a 390×844 phone where a quarter of the
 * board is 78px wide. Three capitals at that size are 97px and would ellipsize.
 * Both glyphs are also plain ASCII, so no font can fail to have them.
 *
 * The header is the quarter and nothing else. The panel is opened from the
 * quarter panel and closes back to the board, so naming the action a second
 * time would only cost the row its title.
 *
 * Four slots filled LEFT TO RIGHT, in the order the time is read — see
 * `pushClockDigit`, which refuses a tens-of-seconds digit over 5 so the readout
 * is never a time that SET would not apply. SET stays dark until all four slots
 * are down.
 *
 * The pending entry is local state on purpose. It is a half-typed number that
 * only this panel can read, and it dies with the panel; the ui store carries
 * the in-flight *entry*, not every field a dialog owns.
 */
export function SetClockPanel() {
  const m = useMetrics();
  const t = useTheme();
  const period = useGameStore((s) => s.period);
  const periods = useGameStore((s) => s.periods);
  const remaining = useGameStore((s) => s.remaining);
  const setClock = useGameStore((s) => s.setClock);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);

  const [digits, setDigits] = useState('');

  useAnnounce(`${periodName(period, periods)}, set the clock`);

  const typed = digits.length > 0;

  const apply = () => {
    const seconds = secondsFromClock(digits);
    setClock(seconds);
    reset();
    say(`clock ${mmss(seconds)}`);
  };

  const key = (d: string) => (
    <Tile key={d} code={d} onPress={() => setDigits((s) => pushClockDigit(s, d))} />
  );

  return (
    <>
      <PHead>
        {/* the two-character form, because this header carries the live entry
            beside it and has no room for a word — see `periodLabel` */}
        <PTitleText>{periodLabel(period, periods)}</PTitleText>
        {/* the entry, and the panel's only output. Dimmed it is the LIVE clock
            — the number about to be replaced — and it goes solid on the first
            digit, which is the whole signal that typing has started. */}
        <Text
          numberOfLines={1}
          style={{
            flexGrow: 0, flexShrink: 0,
            ...fNum(700),
            fontSize: m.fsLg,
            color: typed ? t.ink : t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {typed ? clockEntry(digits) : mmss(remaining)}
        </Text>
        <CancelX />
      </PHead>

      <PRows
        rows={[
          [key('1'), key('2'), key('3'),
            <Tile
              key="del"
              code="<"
              caption="Del"
              disabled={!typed}
              onPress={() => setDigits((s) => s.slice(0, -1))}
            />],
          [key('4'), key('5'), key('6'), key('0')],
          [key('7'), key('8'), key('9'),
            // the one key that commits, and the only accent on the pad
            <Tile
              key="set"
              code="OK"
              caption="Set"
              tone="accent"
              disabled={!clockReady(digits)}
              onPress={apply}
            />],
        ]}
      />
    </>
  );
}
