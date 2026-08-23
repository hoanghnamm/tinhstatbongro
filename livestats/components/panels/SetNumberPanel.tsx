import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { numberHolder, validNumber } from '../../lib/roster';
import { useRosterStore } from '../../store/rosterStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fUi } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn, PRows, PTitle, Row, Tile } from './shell';

/**
 * THE JERSEY KEYPAD — the one thing about a player the new-game picker may
 * change.
 *
 * A number is the fact that goes stale between games: a squad turns up with a
 * different set of shirts and the scorer has thirty seconds to say so. A name
 * does not change at the door, which is why the picker edits this and nothing
 * else, and why the full form stays where it always was — on the TEAM tab.
 *
 * It is a PAD, not a field, and that is the same call `SetClockPanel` makes:
 * two digits at courtside are faster off a grid of big targets than off a
 * keyboard that covers half the screen on its way in. It also keeps this panel
 * out of the KeyboardAvoidingView business the two forms have to do.
 *
 * It writes to `rosterStore`, so the change is durable — a new number is true
 * of the player, not of tonight. The duplicate check is the roster's own and
 * the error NAMES THE HOLDER, exactly as the TEAM tab's own number field does: OK stays dark
 * until the entry is a number nobody else on the team is wearing.
 */
export function SetNumberPanel({ playerId }: { playerId: string }) {
  const m = useMetrics();
  const t = useTheme();

  const roster = useRosterStore((s) => s.players);
  const update = useRosterStore((s) => s.update);
  const reset = useUiStore((s) => s.reset);

  const player = roster.find((p) => p.id === playerId) ?? null;
  const [digits, setDigits] = useState('');

  useAnnounce(player ? `jersey number for ${player.name}` : 'jersey number');

  if (!player) {
    // removed from the team while the panel was open. Say so rather than
    // calling reset() from a render — a store write during a render is how a
    // panel closes something that is still painting.
    return (
      <>
        <PTitle title="Player is gone" />
        <Row>
          <Btn label="Close" onPress={reset} />
        </Row>
      </>
    );
  }

  const typed = digits.length > 0;
  const num = Number(digits);
  const numOk = typed && validNumber(num);
  const holder = numOk ? numberHolder(roster, num, playerId) : null;
  const ok = numOk && !holder;

  const save = () => {
    if (!ok) return;
    update(playerId, { number: num });
    reset();
  };

  // past two digits a tap is IGNORED rather than shifting the entry along —
  // the same call `pushClockDigit` makes, and DEL is one cell away
  const key = (d: string) => (
    <Tile key={d} code={d} onPress={() => setDigits((s) => (s.length >= 2 ? s : s + d))} />
  );

  // a pad row must clear the tap floor whatever the window does, and a tile's
  // code is `fs3xl`, so the type is what sizes it on anything taller
  const rowH = Math.max(m.tap, Math.round(m.fs3xl * 1.35));

  return (
    <>
      {/* the entry is the pill, dimmed to the number being replaced until the
          first digit lands — the whole signal that typing has started */}
      <PTitle title="Jersey number" kind={'#' + (typed ? digits : player.number)} />

      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ marginTop: -m.sp, marginBottom: m.sp, ...fUi(600), fontSize: m.fsMd, color: t.ink2 }}
      >
        {player.name}
      </Text>

      <View style={{ height: rowH * 4 + 3, flexGrow: 0, flexShrink: 0 }}>
        <PRows
          rows={[
            [key('1'), key('2'), key('3')],
            [key('4'), key('5'), key('6')],
            [key('7'), key('8'), key('9')],
            [
              <Tile
                key="del"
                code="<"
                caption="Del"
                disabled={!typed}
                onPress={() => setDigits((s) => s.slice(0, -1))}
              />,
              key('0'),
              // the one key that commits, and the only accent on the pad
              <Tile key="ok" code="OK" caption="Set" tone="accent" disabled={!ok} onPress={save} />,
            ],
          ]}
        />
      </View>

      {/* the one error the pad can show, and it says who to go and ask */}
      <Text
        accessibilityLiveRegion="polite"
        style={{
          marginTop: m.s2,
          minHeight: m.fsSm * 1.5,
          ...fUi(600),
          fontSize: m.fsSm,
          lineHeight: m.fsSm * 1.5,
          color: t.danger,
        }}
      >
        {holder ? `#${holder.number} is taken by ${holder.name}` : ''}
      </Text>

      <Row>
        <Btn label="Cancel" onPress={reset} />
      </Row>
    </>
  );
}
