import { useRef, useState } from 'react';
import { Keyboard, Platform, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Dot } from '../ui/Dot';
import { Jersey, plateFs, plateInk } from '../ui/Jersey';
import { Press } from '../ui/Press';
import { NAME_MAX, numberHolder, validNumber } from '../../lib/roster';
import { useRosterStore } from '../../store/rosterStore';
import { useMetrics } from '../../theme/metrics';
import { LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { RosterPlayer } from '../../types';

/**
 * ONE DONE BAR FOR EVERY JERSEY FIELD IN THE APP.
 *
 * `number-pad` is the one keyboard with no return key, so iOS needs an
 * accessory bar to dismiss it. It is ONE `InputAccessoryView` shared by every
 * row on whichever screen is up — the id is what ties a field to it — and the
 * screens that draw rows mount the bar itself. Android's numeric pad has a
 * dismiss key and neither the bar nor this id is used there.
 */
export const NUM_DONE = 'hooplog-jersey-done';

/**
 * THE ROW BOTH TEAM SCREENS WEAR, AND NOW THE DOOR AS WELL.
 *
 * It lived inside `app/(tabs)/team.tsx` while that screen was its only caller.
 * `app/intro.tsx` asks the same question on the first night — who is on this
 * team — and a second copy of a row carrying two committed-as-typed fields and
 * a duplicate-number rule is the copy that answers one of them differently.
 * The three screens now draw one row; only the chrome around it differs.
 *
 * THE ROW IS THE NEW-GAME PICKER'S ROW, and it is still the editor.
 *
 * The two team screens ask the same questions an hour apart, so they are drawn
 * the same way: a PLATE, a NAME and a DOT on a ruled line. `app/start.tsx` is
 * where that shape comes from — three bordered boxes in a row said "form" where
 * a jersey plate says "player", and a scorer moving between the two screens
 * should not have to re-read either of them.
 *
 * WHAT DID NOT CHANGE IS THAT BOTH FIELDS ARE STILL TYPED HERE. The picker taps
 * a keypad open because two digits at courtside are faster off big targets; at
 * a table before tip-off a scorer is working down all fifteen rows, so this
 * screen keeps its keyboard and its commit-as-you-type. The difference is the
 * CHROME and nothing else.
 *
 *   the plate  the jersey, 0–99, digits only. It is a `blank` `Jersey` with the
 *              input laid OVER it — see below — and it takes a 2px `danger`
 *              ring the moment the number collides with someone else's.
 *   the name   free text to `NAME_MAX`, on no box at all. Blank is ordinary and
 *              shows `Player N`.
 *   the dot    availability: `ink3` when dressed, `danger` when not.
 *
 * THE INPUT IS AN OVERLAY, NOT A CHILD OF THE PLATE, and that is a tap-target
 * decision. The plate is `tap × 0.72` — about 35 points — which is the size it
 * has to be for the row to read as the picker's, and a `TextInput` that small
 * is under the floor nothing interactive may compute below. So the cell is a
 * full `m.tap`, the plate is centred in it as the SURFACE, and the field sits
 * across the whole cell on top: the number is drawn at the plate's own size and
 * in the plate's own ink (`plateFs` / `plateInk`, exported for exactly this),
 * and the thing a thumb has to hit is 48 tall.
 *
 * The ✓/— slot that used to close this row is gone with the boxes. `Dot` is
 * what both screens draw now, and it says the same two things: available is a
 * quiet `ink3`, unavailable is `danger`, and the row's own 0.45 says it again.
 */
export function RosterRow({
  player,
  index,
  onFocusRow,
  enhanced = false,
  onEditingChange,
}: {
  player: RosterPlayer;
  index: number;
  /**
   * Hands this row's node up so the list can lift it off the keyboard.
   *
   * OPTIONAL, because only one caller has a list to lift. The TEAM tab is a
   * `FlatList` under a keyboard that covers it; the door's five rows sit in a
   * short page inside a `KeyboardAvoidingView`, which moves the whole column
   * and has nothing to measure.
   */
  onFocusRow?: (node: View | null) => void;
  /** Team-only focus and availability cues; onboarding retains its original row. */
  enhanced?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const m = useMetrics();
  const t = useTheme();

  // the node the screen measures, and it is the ROW rather than either field:
  // the two are one thing to read, and lifting the name clear while the plate
  // beside it stays under the keyboard would be half a fix.
  const rowRef = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const onFocus = () => { setFocused(true); onEditingChange?.(true); onFocusRow?.(rowRef.current); };
  const onBlur = () => { setFocused(false); onEditingChange?.(false); };

  const roster = useRosterStore((s) => s.players);
  const update = useRosterStore((s) => s.update);

  // the text is local; see the header note. The list keys rows by id, so a row
  // never inherits the state of whoever used to sit at its index.
  const [numText, setNumText] = useState(String(player.number));
  const [name, setName] = useState(player.name);

  const num = Number(numText);
  const numOk = numText.length > 0 && validNumber(num);
  const holder = numOk ? numberHolder(roster, num, player.id) : null;
  const numBad = !numOk || !!holder;

  const who = player.name || `Player ${index + 1}`;

  // the picker's plate, to the point: same ratio, same rounding
  const jh = Math.round(m.tap * 0.72);
  const jw = Math.round(jh * 1.15);

  const onNum = (v: string) => {
    const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
    setNumText(digits);
    const n = Number(digits);
    // a colliding or half-typed number is SHOWN but not written: the roster
    // never holds two of the same shirt, not even for one keystroke
    if (digits.length > 0 && validNumber(n) && !numberHolder(roster, n, player.id)) {
      update(player.id, { number: n });
    }
  };

  const onName = (v: string) => {
    setName(v);
    update(player.id, { name: v });
  };

  const fs = plateFs(jw, jh);

  return (
    <View
      ref={rowRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.s2,
        borderBottomWidth: 1,
        borderBottomColor: enhanced && focused ? t.accent : t.rule,
        // dimmed, not hidden — they are still on the team, and the dot beside
        // them is still the way to say they turned up after all
        opacity: player.available || enhanced ? 1 : 0.45,
      }}
    >
      {/* THE PLATE, WITH THE FIELD OVER IT — see the note above for why the
          two are not one view. */}
      <View
        style={{
          flexGrow: 0,
          flexShrink: 0,
          minHeight: m.tap,
          paddingHorizontal: m.s2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            // the one error a row can show, and it needs no words: the number
            // it collides with is a few rows above or below it. The ring is
            // OUTSIDE the plate, so it cannot eat the accent edge down its left.
            borderRadius: m.rSm + 2,
            borderWidth: 2,
            borderColor: numBad ? t.danger : 'transparent',
          }}
        >
          <Jersey number={player.number} w={jw} h={jh} blank />
        </View>

        <TextInput
          value={numText}
          onChangeText={onNum}
          onFocus={onFocus}
          onBlur={() => { setNumText(String(player.number)); onBlur(); }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          placeholder="#"
          placeholderTextColor={t.courtLine}
          inputAccessoryViewID={Platform.OS === 'ios' ? NUM_DONE : undefined}
          accessibilityLabel={`jersey number for ${who}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            padding: 0,
            textAlign: 'center',
            textAlignVertical: 'center',
            includeFontPadding: false,
            ...fNum(700),
            fontSize: fs,
            letterSpacing: ls(fs, LS_TIGHT),
            color: plateInk(t),
            fontVariant: ['tabular-nums'],
          }}
        />
      </View>

      {/* the name, on no box — the picker prints it as plain text and this is
          the same line with a caret in it */}
      <TextInput
        value={name}
        onChangeText={onName}
        onFocus={onFocus}
        onBlur={() => { setName(player.name); onBlur(); }}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        placeholder={`Player ${index + 1}`}
        placeholderTextColor={enhanced ? t.ink2 : t.ink3}
        accessibilityLabel={`name for ${who}`}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: m.tap,
          padding: 0,
          paddingHorizontal: m.s1,
          color: t.ink,
          ...fUi(600),
          fontSize: m.fsMd,
        }}
      />

      {/* and the state, which is the same toggle the picker draws */}
      <Press
        onPress={() => update(player.id, { available: !player.available })}
        accessibilityLabel={
          player.available
            ? `${who} is dressed, tap to sit them out`
            : `${who} is out, tap to dress them`
        }
        style={{
          flexGrow: 0,
          flexShrink: 0,
          width: m.tap,
          minHeight: m.tap,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: m.rSm,
        }}
        pressedStyle={{ backgroundColor: t.surface2 }}
      >
        {enhanced && !player.available ?
          <MaterialCommunityIcons name="minus-circle-outline" size={m.fsMd} color={t.danger} /> :
          <Dot on={player.available} />}
      </Press>
    </View>
  );
}
