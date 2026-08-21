import { useEffect, useState } from 'react';
import {
  FlatList,
  InputAccessoryView,
  Keyboard,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../../components/panels/PanelHost';
import { ClubCard } from '../../components/team/ClubCard';
import { Bloom } from '../../components/ui/Bloom';
import { Press } from '../../components/ui/Press';
import { Row } from '../../components/ui/Row';
import { useTabInset } from '../../hooks/useTabInset';
import { NAME_MAX, ROSTER_CAP, nextFreeNumber, numberHolder, validNumber } from '../../lib/roster';
import { useRosterStore } from '../../store/rosterStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { RosterPlayer } from '../../types';

/**
 * THE TEAM, AND THE ROW IS THE EDITOR.
 *
 * There is no form behind this list any more. A jersey and a name are two short
 * fields, and putting them behind a modal meant three taps and a round trip to
 * change one digit — on the one screen where a scorer changes twelve of them in
 * a row, at a table, before anything has tipped off. So the row carries them
 * inline and the store is written as they are typed.
 *
 * THREE PARTS, LEFT TO RIGHT, and each is its own target:
 *
 *   #          the jersey, 0–99, digits only. Its border goes `danger` the
 *              moment the number collides with someone else's.
 *   name       free text, capped at NAME_MAX. Blank is ordinary and shows the
 *              placeholder — a row can exist before its name does.
 *   the slot   dressed. `accent` and a tick when they are, an outline and a
 *              `danger` dash when they are not.
 *
 * A 4px `accent` MARK down the row's left edge and a `×` at its right edge were
 * both built and cut. The mark said what the slot already says, and the row's
 * own 0.45 dim says it a third time at a glance; the `×` put a destructive
 * target a thumb's width from two text fields on the screen a scorer is typing
 * fastest on. NOTHING REMOVES A PLAYER FROM THIS SCREEN NOW — `RemovePlayerPanel`
 * survives with no caller, one press away from being reached again.
 *
 * `available` is still the only fact on this screen that DOES anything, and it
 * still does exactly one thing: `availableIn` filters the starter picker. The
 * ✓/— slot is that switch under another shape, which is why an unavailable row
 * dims to 0.45 rather than leaving — they are on the team, and turning them
 * back on has to be one tap.
 *
 * WHAT IS DELIBERATELY NOT HERE is a captain, a starting five and a position.
 * The first two are facts about a GAME, and `app/start.tsx` already asks them at
 * the door — a starting five chosen on Monday is a starting five that is wrong
 * by Saturday. `position` survives in the type and in `migrateRoster` so
 * persisted data is not thrown away, but nothing writes it any more; it was a
 * label nothing ever read.
 *
 * THERE IS NO `KeyboardAvoidingView` HERE, AND THAT IS THE POINT. This screen is
 * a LIST, not a form: padding the bottom by the keyboard's height shrank the
 * viewport to a handful of rows at the exact moment the scorer was working
 * through all fifteen of them. The keyboard is allowed to sit OVER the list
 * instead, and the list is what moves — `keyboardDismissMode="on-drag"`, so a
 * scroll both reaches the next row and puts the keyboard away.
 *
 * AND THE NUMBER PAD GETS A DONE BAR, because on iOS it is the one keyboard
 * with no return key at all: two digits go in and there is no way off it.
 * `InputAccessoryView` is shared by every row — one bar, `Keyboard.dismiss()`,
 * which blurs whichever field is focused and lets `onBlur` re-seed it. Android
 * needs none of this and gets none: its numeric pad has a dismiss key, and the
 * component is a no-op there anyway.
 *
 * EVERY FIELD IS COMMITTED AS IT IS TYPED, WITH THE TEXT HELD LOCALLY. That
 * split is not decoration: `rosterStore.update` runs `cleanName`, which trims,
 * so a store round trip on every keystroke would eat a space the moment it was
 * typed. The local copy is what is displayed; blur re-seeds it from the store,
 * which is also what reverts a bad number and normalises `07` to `7`.
 *
 * IT IS DRAWN ON BLACK with the other three rooms, and nothing below says so
 * except the `<Bloom />`: the palette belongs to the group and is declared in
 * `app/(tabs)/_layout.tsx`. The fields are the case that makes that worth
 * having — a `TextInput` here asks for `surface` under `ink` and gets a
 * translucent white under a near-white, with the same `rule` around it and the
 * same `danger` on a collision, and not one line of this screen had to know.
 * `ClubCard` is the same card the new-game picker draws, on the light skin,
 * from the same source.
 */

/** One DONE bar for every jersey field on the screen; see the note above. */
const NUM_DONE = 'hooplog-jersey-done';

/** Two columns start here — the same line `RotateGate` and `start.tsx` draw. */
const TWO_UP = 700;
/** …and past it the count is computed, so a 1180pt iPad gets three, not two. */
const COL_W = 380;

function PlayerRow({ player, index }: { player: RosterPlayer; index: number }) {
  const m = useMetrics();
  const t = useTheme();

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

  const field = {
    minHeight: m.tap,
    paddingHorizontal: m.s2,
    borderRadius: m.r,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
    color: t.ink,
    fontSize: m.fsMd,
  };

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.s2,
        marginBottom: m.s2,
        // dimmed, not hidden — they are still on the team, and the slot beside
        // them is still the way to say they turned up after all
        opacity: player.available ? 1 : 0.45,
      }}
    >
      <TextInput
        value={numText}
        onChangeText={onNum}
        onBlur={() => setNumText(String(player.number))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={2}
        placeholder="#"
        placeholderTextColor={t.ink3}
        inputAccessoryViewID={Platform.OS === 'ios' ? NUM_DONE : undefined}
        accessibilityLabel={`jersey number for ${who}`}
        style={[
          field,
          {
            flexGrow: 0,
            flexShrink: 0,
            width: Math.max(m.tap, Math.round(m.fsMd * 3.2)),
            textAlign: 'center',
            fontFamily: fNum(700),
            fontVariant: ['tabular-nums'],
            // the one error a row can show, and it needs no words: the number
            // it collides with is a few rows above or below it
            borderWidth: numBad ? 2 : 1,
            borderColor: numBad ? t.danger : t.rule,
          },
        ]}
      />

      <TextInput
        value={name}
        onChangeText={onName}
        onBlur={() => setName(player.name)}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        placeholder={`Player ${index + 1}`}
        placeholderTextColor={t.ink3}
        accessibilityLabel={`name for ${who}`}
        style={[field, { flex: 1, minWidth: 0, fontFamily: fUi(600) }]}
      />

      {/* THE SLOT. Filled is on, exactly as the mockup has it — and the OFF
          state keeps `danger` for its dash, because absence is the half of this
          fact that is worth a colour everywhere else in the app too. */}
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
          borderRadius: m.r,
          borderWidth: 1,
          borderColor: player.available ? t.accent : t.rule,
          backgroundColor: player.available ? t.accent : t.surface,
        }}
        pressedStyle={{ opacity: 0.7 }}
      >
        {player.available ? (
          <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
            <Path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke={t.accentInk}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        ) : (
          <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
            <Path
              d="M6 12h12"
              stroke={t.danger}
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        )}
      </Press>
    </View>
  );
}

export default function TeamScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const bar = useTabInset();

  // HOW FAR UP THE LIST CAN BE PULLED, and the keyboard is half of it. The
  // keyboard sits OVER this list rather than shortening it — see the header
  // note — so without a tail the last rows have nothing to scroll into and
  // cannot be lifted clear of it. Paying it on the CONTENT is not the
  // `KeyboardAvoidingView` that was refused: the viewport keeps its full
  // height, and all that changes is how much there is to scroll.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const up = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (e) => setKb(e.endCoordinates.height),
    );
    const down = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKb(0),
    );
    return () => {
      up.remove();
      down.remove();
    };
  }, []);

  const players = useRosterStore((s) => s.players);
  const add = useRosterStore((s) => s.add);

  const full = players.length >= ROSTER_CAP;

  // the keyboard covers the bar as well, so the two do not stack — whichever
  // is standing on the list at the time is what the tail owes, plus the room
  // to pull the last row clear of it
  const tail = Math.max(bar, kb) + m.s6;

  const usable = m.win.w - safe.left - safe.right - 2 * m.s4;
  const columns = usable >= TWO_UP ? Math.max(2, Math.floor(usable / COL_W)) : 1;

  // a short last row would otherwise stretch its one item across the grid
  const pad = columns > 1 ? (columns - (players.length % columns)) % columns : 0;
  const data: (RosterPlayer | null)[] = [...players, ...Array<null>(pad).fill(null)];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* outside the padded view below, so it runs under the safe-area inset */}
      <Bloom />

      <View
        style={{
          flex: 1,
          paddingTop: safe.top + m.s2,
          // NO BOTTOM PAD ON THE FRAME, and that is what makes this one sheet:
          // padding here would clip the list short of the bar and leave a dead
          // strip of canvas under the last row. The list runs all the way to the
          // bar instead, and its CONTENT carries the inset — see the
          // `contentContainerStyle` below, which is the half that has to know
          // how tall the bar is.
          paddingBottom: 0,
          paddingLeft: safe.left + m.s4,
          paddingRight: safe.right + m.s4,
        }}
      >
        {/* no back button: this is a tab root, and the tab bar is the way out */}
        <FlatList
          // THE CLUB CARD AND THE BAND ARE THE LIST HEADER, not a fixed block
          // above it: this screen is one sheet, and a header pinned over a
          // scrolling list is a second surface that has to be justified. It is
          // an ELEMENT rather than a component so React keeps the same instances
          // across renders and the fields hold their text.
          ListHeaderComponent={
            <>
              <ClubCard />

              <Row gap={m.s2} style={{ minHeight: m.tap, marginTop: m.s3 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontFamily: fNum(700),
                    fontSize: m.fsMd,
                    letterSpacing: ls(m.fsMd, LS_LABEL),
                    color: t.ink2,
                  }}
                >
                  PLAYERS
                </Text>

                {/* the count is what says why + ADD PLAYER is gone at the cap, so the
                    count is the thing that has to change colour when it gets there */}
                <Text
                  style={{
                    marginLeft: 'auto',
                    flexGrow: 0,
                    flexShrink: 0,
                    fontFamily: fNum(500),
                    fontSize: m.fsMd,
                    color: full ? t.danger : t.ink2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {players.length}/{ROSTER_CAP}
                </Text>
              </Row>
            </>
          }
          // numColumns cannot change on a live list, so the count keys it
          key={'cols' + columns}
          data={data}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: m.s3 } : undefined}
          keyExtractor={(p, i) => p?.id ?? 'pad' + i}
          renderItem={({ item, index }) =>
            item ? <PlayerRow player={item} index={index} /> : <View style={{ flex: 1 }} />
          }
          style={{ flex: 1 }}
          // AND THIS IS THE ONE PLACE THE BAR AND THE KEYBOARD ARE PAID FOR.
          // It was `m.s3` flat — twelve points against a glass bar four times
          // that — so + ADD PLAYER and the last row sat BEHIND the bar with
          // nothing left to scroll: on the screen, and out of reach. `tail` is
          // whichever of the two is standing on the list, plus the room to pull
          // the row above it.
          contentContainerStyle={
            players.length ? { paddingBottom: tail } : { flexGrow: 1, paddingBottom: tail }
          }
          showsVerticalScrollIndicator={false}
          // a field is nearly always focused on this screen, so the first tap on
          // the slot beside it has to LAND rather than merely dismiss a keyboard
          keyboardShouldPersistTaps="handled"
          // …and a DRAG is the other way off it: the keyboard sits over the list
          // rather than shortening it, so reaching the next row puts it away
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: fNum(500),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: t.ink3,
                }}
              >
                NO PLAYERS YET
              </Text>
            </View>
          }
          // AT THE CAP IT IS GONE, not disabled. A dark button on a full roster
          // is a control still asking to be pressed; the 15/15 above says why.
          ListFooterComponent={
            full ? null : (
              <Press
                onPress={() => add({ number: nextFreeNumber(players), name: '' })}
                accessibilityLabel="add a player to the team"
                style={{
                  minHeight: m.tap,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: m.r,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: t.rule,
                }}
                pressedStyle={{ backgroundColor: t.surface2, borderColor: t.accent }}
              >
                <Text
                  style={{
                    fontFamily: fNum(700),
                    fontSize: m.fsMd,
                    letterSpacing: ls(m.fsMd, LS_LABEL),
                    color: t.accent,
                  }}
                >
                  + ADD PLAYER
                </Text>
              </Press>
            )
          }
        />
      </View>

      {/* one bar for the whole screen — the number pad's only way out on iOS */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NUM_DONE}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingHorizontal: m.s3,
              // `bg` and not `surface2`: the two are the same value on the
              // light skin, and this one is OPAQUE on the dark one. An
              // accessory bar sits over the keyboard with nothing of its own
              // behind it, so a translucent fill here is a bar you can see the
              // list through.
              backgroundColor: t.bg,
              borderTopWidth: 1,
              borderTopColor: t.rule,
            }}
          >
            <Press
              onPress={() => Keyboard.dismiss()}
              accessibilityLabel="close the keypad"
              style={{
                minHeight: m.tap,
                paddingHorizontal: m.s3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              pressedStyle={{ opacity: 0.6 }}
            >
              <Text
                style={{
                  fontFamily: fNum(700),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: t.accent,
                }}
              >
                DONE
              </Text>
            </Press>
          </View>
        </InputAccessoryView>
      )}

      <PanelHost />
    </View>
  );
}
