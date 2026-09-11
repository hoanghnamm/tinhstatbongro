import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  InputAccessoryView,
  Keyboard,
  Platform,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { PanelHost } from '../../components/panels/PanelHost';
import { ClubCard } from '../../components/team/ClubCard';
import { NUM_DONE, RosterRow } from '../../components/team/RosterRow';
import { SquadStrip } from '../../components/team/SquadStrip';
import { RoomGround } from '../../components/offcourt/RoomGround';
import { EmptyState } from '../../components/offcourt/EmptyState';

import { GlowText } from '../../components/ui/GlowText';
import { Press } from '../../components/ui/Press';
import { Col, Row } from '../../components/ui/Row';
import { useTabInset } from '../../hooks/useTabInset';
import { useTopOnBlur } from '../../hooks/useTopOnBlur';
import { ROSTER_CAP, nextFreeNumber } from '../../lib/roster';
import { SQUAD_SIZE, canRemoveSquad, membersOf } from '../../lib/squads';
import { useActiveSquad } from '../../hooks/useActiveSquad';
import { useHistoryStore } from '../../store/historyStore';
import { useRosterStore } from '../../store/rosterStore';
import { useSquadStore } from '../../store/squadStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { ROOM_WIDTH } from '../../theme/room';
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
 *   the plate  the jersey, 0–99, digits only. It takes a `danger` ring the
 *              moment the number collides with someone else's.
 *   name       free text, capped at NAME_MAX. Blank is ordinary and shows the
 *              placeholder — a row can exist before its name does.
 *   the dot    dressed. `ink3` when they are, `danger` when they are not.
 *
 * AND ALL THREE ARE THE NEW-GAME PICKER'S, because the two team screens ask the
 * same questions an hour apart. `app/start.tsx` is where the shape comes from;
 * see the note over `components/team/RosterRow.tsx` for what that cost
 * the jersey field.
 *
 * A 4px `accent` MARK down the row's left edge and a `×` at its right edge were
 * both built and cut. The mark said what the dot already says, and the row's
 * own 0.45 dim says it a third time at a glance; the `×` put a destructive
 * target a thumb's width from two text fields on the screen a scorer is typing
 * fastest on. NOTHING REMOVES A PLAYER FROM THIS SCREEN NOW — `RemovePlayerPanel`
 * survives with no caller, one press away from being reached again.
 *
 * `available` is still the only fact on this screen that DOES anything, and it
 * still does exactly one thing: `availableIn` filters the starter picker. The
 * dot is that switch under another shape, which is why an unavailable row dims
 * to 0.45 rather than leaving — they are on the team, and turning them back on
 * has to be one tap.
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
 * BUT THE ROW BEING TYPED IN IS LIFTED CLEAR OF IT, which is the other half of
 * letting the keyboard cover the list. Room to scroll is not the same as being
 * scrolled: the tail below only means the last rows CAN be pulled up, and a
 * scorer who taps the twelfth player still had the keyboard land on top of the
 * two fields they were about to read. So focus measures the row against the
 * bottom of the list's own frame and scrolls exactly the overlap away — never
 * a fixed amount, and never at all for a row that is already clear.
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
 * `app/(tabs)/_layout.tsx`. The name field is the case that makes that worth
 * having — it asks for `ink` on nothing at all and gets a near-white on the
 * room's own near-black, with `ink3` under the placeholder, and not one line of
 * this screen had to know. The plate is the counter-case and the reason it is
 * `Jersey` rather than a colour written here: `court` and `courtLine` are the
 * one pair that does NOT invert, so a jersey reads white on both skins and the
 * picker's plate and this one are the same object. `ClubCard` is the same card
 * the picker draws, on the light skin, from the same source.
 */

/** Two columns start here — the same line `RotateGate` and `start.tsx` draw. */
const TWO_UP = 700;

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
  const [editing, setEditing] = useState(false);
  // …and the same height as a ref, because `lift` is called from a listener and
  // from a layout callback, neither of which is holding this render's copy.
  const kbRef = useRef(0);
  useEffect(() => {
    const up = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
      (e) => {
        kbRef.current = e.endCoordinates.height;
        setKb(e.endCoordinates.height);
      },
    );
    const down = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        kbRef.current = 0;
        setKb(0);
      },
    );
    return () => {
      up.remove();
      down.remove();
    };
  }, []);

  /**
   * LIFTING THE FOCUSED ROW OFF THE KEYBOARD.
   *
   * The tail below is what makes this POSSIBLE and this is what makes it
   * HAPPEN: a scorer tapping the twelfth player's name had the keyboard land
   * over the two fields they were about to read, with the room to scroll sitting
   * unused underneath. So the row is measured against the bottom of the list's
   * own frame and the OVERLAP is scrolled away — nothing moves for a row that is
   * already clear, and a row half-covered moves half a row.
   *
   * THE FRAME IS MEASURED RATHER THAN THE WINDOW, because the two platforms lose
   * the height at different ends. iOS lays the keyboard OVER the frame, so its
   * bottom is still the window's and the keyboard's own height has to come off;
   * Android RESIZES the window under it, so the frame has already lost exactly
   * that much and taking it off again would scroll a whole keyboard too far.
   */
  const listRef = useRef<FlatList<RosterPlayer | null>>(null);
  const frameRef = useRef<View>(null);
  const focusedRow = useRef<View | null>(null);
  const offset = useRef(0);

  // A TAB IS A ROOM, AND IT IS ENTERED AT THE TOP OF IT — see the hook. The
  // offset is reset with it: `lift` scrolls BY an overlap off this copy, and a
  // programmatic scroll is not guaranteed to come back through `onScroll`.
  useTopOnBlur(listRef, useCallback(() => { offset.current = 0; }, []));

  const lift = useCallback(() => {
    const node = focusedRow.current;
    const frame = frameRef.current;
    if (!node || !frame) return;

    frame.measureInWindow((_fx, fy, _fw, fh) => {
      const limit = fy + fh - (Platform.OS === 'ios' ? kbRef.current : 0) - m.s3;
      node.measureInWindow((_x, y, _w, h) => {
        const over = y + h - limit;
        // a point or two is measurement noise, not a covered row
        if (over > 1) {
          listRef.current?.scrollToOffset({ offset: offset.current + over, animated: true });
        }
      });
    });
  }, [m.s3]);

  // ON THE COMMIT, NOT IN THE LISTENER: the keyboard's height is also what the
  // tail is paid out of, and scrolling before that padding exists would clamp
  // against a content height that has not grown yet.
  useEffect(() => {
    if (kb > 0) lift();
  }, [kb, lift]);

  const onFocusRow = useCallback(
    (node: View | null) => {
      focusedRow.current = node;
      // the keyboard is already up when focus moves from one row to the next,
      // so there is no event coming and this is the only call that will happen
      lift();
    },
    [lift],
  );

  const pool = useRosterStore((s) => s.players);
  const add = useRosterStore((s) => s.add);
  const draft = useSquadStore((s) => s.draft);
  const index = useHistoryStore((s) => s.index);
  const open = useUiStore((s) => s.open);

  // THE LIST IS ONE TEAM'S SHEET, NOT THE POOL, and that is the whole shape of
  // this screen now. The pool is a club-level list of up to `ROSTER_CAP`
  // names that nobody scrolls through to find tonight's twelve; the sheet is
  // the twelve. The pool is still reachable and is still where a player is
  // created — it is behind the DRAFT button, which is the one control that
  // writes membership.
  const { squad, squads } = useActiveSquad();
  const players = membersOf(squad, pool);

  const full = players.length >= SQUAD_SIZE;
  const poolFull = pool.length >= ROSTER_CAP;
  // GONE, NOT DISABLED, and only when nothing on the shelf was played by it —
  // see `canRemoveSquad` for why a team with games behind it cannot go.
  const removable = canRemoveSquad(squads, squad?.id ?? '', index);

  // the keyboard covers the bar as well, so the two do not stack — whichever
  // is standing on the list at the time is what the tail owes, plus the room
  // to pull the last row clear of it
  const tail = Math.max(bar, kb) + m.s6;

  const usable = m.win.w - safe.left - safe.right - 2 * m.s4;
  const columns = usable >= TWO_UP ? 2 : 1;

  // a short last row would otherwise stretch its one item across the grid
  const pad = columns > 1 ? (columns - (players.length % columns)) % columns : 0;
  const data: (RosterPlayer | null)[] = [...players, ...Array<null>(pad).fill(null)];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* outside the padded view below, so it runs under the safe-area inset */}
      <RoomGround />

      <View
        ref={frameRef}
        // ANDROID RESIZES THE WINDOW UNDER THE KEYBOARD, and that arrives as a
        // layout rather than as a taller keyboard: this is the frame losing the
        // height, so it is the frame that says when to lift again. On iOS it
        // fires on rotation and on nothing else, which is also worth re-lifting
        // for. `lift` is a no-op with no focused row or no keyboard.
        onLayout={() => {
          if (kbRef.current > 0) lift();
        }}
        style={{
          flex: 1,
          width: '100%',
          maxWidth: ROOM_WIDTH + safe.left + safe.right + m.s4 * 2,
          alignSelf: 'center',
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
          ref={listRef}
          // THE CLUB CARD AND THE BAND ARE THE LIST HEADER, not a fixed block
          // above it: this screen is one sheet, and a header pinned over a
          // scrolling list is a second surface that has to be justified. It is
          // an ELEMENT rather than a component so React keeps the same instances
          // across renders and the fields hold their text.
          ListHeaderComponent={
            <>
              <ClubCard onEditingChange={setEditing} />

              {/* THE SWITCHER, DIRECTLY UNDER THE CLUB, because that is the
                  order the two facts nest in: this club, then which of its
                  teams. Everything below the strip — and every other screen in
                  the app — is about the chip that is lit. */}
              <SquadStrip onEditingChange={setEditing} />

              <Row gap={m.s2} style={{ minHeight: m.tap, marginTop: m.s3 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    ...fUi(600),
                    fontSize: m.fsMd,
                    letterSpacing: ls(m.fsMd, LS_LABEL),
                    color: t.ink2,
                  }}
                >
                  Players
                </Text>


                {/* the count is what says why + ADD PLAYER is gone at the cap, so the
                    count is the thing that has to change colour when it gets there */}
                <Text
                  style={{
                    marginLeft: 'auto',
                    flexGrow: 0,
                    flexShrink: 0,
                    ...fNum(500),
                    fontSize: m.fsMd,
                    color: full ? t.danger : t.ink2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {players.length}/{SQUAD_SIZE}
                </Text>

                {/* REMOVE THE TEAM, and it is a glyph in the row that names
                    the team's size rather than a button of its own: it is
                    reachable a handful of times ever, and a full-width
                    destructive control under a list of names would be the one
                    loud thing on this screen. Gone entirely once the team has
                    played — see `canRemoveSquad`. */}
                {removable && (
                  <Press
                    onPress={() => squad && open({ kind: 'removeSquad', squadId: squad.id })}
                    accessibilityLabel={`remove ${squad?.name ?? 'this team'} from the club`}
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
                    <MaterialCommunityIcons name="trash-can-outline" size={m.fsMd} color={t.ink3} />
                  </Press>
                )}
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
            item ? (
              <RosterRow player={item} index={index} onFocusRow={onFocusRow} enhanced onEditingChange={setEditing} />
            ) : (
              <View style={{ flex: 1 }} />
            )
          }
          style={{ flex: 1 }}
          // where the list is standing, so the lift can scroll BY the overlap
          // rather than to an absolute offset it would have to reconstruct
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
            <EmptyState title="Nobody on this team yet" />
          }
          // AT THE CAP IT IS GONE, not disabled. A dark button on a full roster
          // is a control still asking to be pressed; the 20/20 above says why.
          // TWO VERBS, AND THEY ARE NOT THE SAME ONE.
          //
          //   + ADD PLAYER  makes a NEW person, in the club's pool, and puts
          //                 them straight on this sheet. That second half is
          //                 the whole reason it is not just the pool's button:
          //                 a scorer adding a name while looking at Team 2
          //                 means that name is on Team 2, and asking them to
          //                 go and draft somebody they just typed would be the
          //                 app being pedantic about its own data model.
          //   DRAFT         opens the pool, where the club's other players
          //                 already are. It is the only place membership is
          //                 written in both directions.
          //
          // The first is GONE at either cap, the second never is — un-drafting
          // is how a full sheet gets back under it, and the panel is where
          // that happens.
          ListFooterComponent={
            <Col gap={m.s2} style={{ marginTop: m.s3 }}>
              {!full && !poolFull && (
                <Press
                  onPress={() => {
                    // the pool decides the jersey, not the sheet: a number is
                    // unique across the club, so a fresh row cannot take one
                    // that another team is already wearing
                    const id = add({ number: nextFreeNumber(pool), name: '' });
                    // …and onto this sheet, which is what the scorer meant.
                    // `add` hands back the id it minted; see `rosterStore`.
                    if (id && squad) draft(squad.id, id);
                  }}
                  accessibilityLabel="add a new player to this team"
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
                  <GlowText
                    style={{
                      ...fUi(600),
                      fontSize: m.fsMd,
                      letterSpacing: ls(m.fsMd, LS_LABEL),
                      color: t.accent,
                    }}
                  >
                    + Add player
                  </GlowText>
                </Press>
              )}

              <Press
                onPress={() => open({ kind: 'draft' })}
                accessibilityLabel="draft players from the club pool"
                style={{
                  minHeight: m.tap,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: m.r,
                  borderWidth: 1,
                  borderColor: t.rule,
                }}
                pressedStyle={{ backgroundColor: t.surface2 }}
              >
                <Text
                  style={{
                    ...fUi(600),
                    fontSize: m.fsMd,
                    letterSpacing: ls(m.fsMd, LS_LABEL),
                    color: t.ink2,
                  }}
                >
                  Draft from pool · {pool.length}
                </Text>
              </Press>
            </Col>
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
              <GlowText
                style={{
                  ...fUi(600),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: t.accent,
                }}
              >
                Done
              </GlowText>
            </Press>
          </View>
        </InputAccessoryView>
      )}

      <PanelHost />
    </View>
  );
}
