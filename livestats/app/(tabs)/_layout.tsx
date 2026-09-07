import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Label, NativeTabs, VectorIcon } from '../../components/nav/nativeTabs';
import { DarkRoom } from '../../components/ui/DarkRoom';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';

/**
 * The four rooms the app has when it is not scoring: LOBBY, MATCHES, STATS,
 * TEAM.
 *
 * MATCHES is the shelf of finished games, and the word is the scorer's, not the
 * model's: `GameState` is still a game, `historyStore` still saves games, and a
 * MATCH is one of those once it is over and on a shelf.
 *
 * **The board is deliberately NOT in this group.** `/game` sits beside it in the
 * root stack, because a tab bar under the board would steal a strip of height
 * the court cannot spare and would put navigation controls in the same row as
 * UNDO and POSS. Leaving the group is how the board gets the whole window, and
 * it is why `router.replace('/game')` out of the picker still lands on a full
 * screen. **That is unchanged by the native bar below** — the bar belongs to
 * this group, and `/game` is not in it, so there is nothing to hide on the one
 * screen that must not have it.
 *
 * TEAM is singular. There is one team, and a plural label would promise a
 * switcher that does not exist and is not coming.
 *
 * `accent` is spent here on exactly one thing — the active tab — which is one
 * of the four jobs the palette still lets it do. The inactive tint is `ink2`.
 *
 * ## NEITHER BAR CARRIES A WORD
 *
 * Four glyphs, no labels, on both platforms. A tab bar is the one strip a
 * scorer learns in a single night, and the word under each icon was a second
 * row of type in the heaviest object on screens made of quiet ones. What says
 * WHICH tab is the tint on the glyph — plus, on Android, the pill behind it.
 *
 * **The two bars take the word away differently, and neither is an omission.**
 * The glass bar's trigger falls back to the ROUTE'S OWN TITLE when it has no
 * `<Label>`, so leaving it out prints `index` under the first icon; `<Label
 * hidden />` is the one that actually hides it. The JS bar has a flag,
 * `tabBarShowLabel: false`.
 *
 * ## THE FOUR ROOMS ARE DARK, AND THIS IS WHERE THEY SAY SO
 *
 * `DarkRoom` hands `DARK` to the whole group and flips the status bar with it,
 * so every shared piece drawn inside — `Card`, `Band`, `Btn`, `Crest`, `Seam`,
 * `BoxTable`, `ClubCard` — follows the surface it is standing on without a
 * single `dark` prop threaded anywhere and without a second copy of any of
 * them. See that file for why the status bar cannot be a mounted `<StatusBar>`.
 *
 * IT IS DECLARED ONCE, HERE, rather than four times in four screens. The lobby
 * used to declare its own and the other three inherited the light palette from
 * the root, which is how the app came to wear two skins in the space of one
 * tap. A group is the right grain for this: the four rooms are one place, and
 * the board — which is NOT in this group — is deliberately still light.
 *
 * TWO PUSHED PAGES WEAR THE SAME WRAPPER for the same reason and are not in
 * this group because they are not rooms: `app/start.tsx`, which is the door
 * into a game, and `app/player/[id].tsx`, which is a player's own season. Both
 * are reached FROM here and read like it. What stays light is everything about
 * a game that is over or on — the board, a saved game, a competition.
 *
 * ## Two bars, and the split is by PLATFORM
 *
 * **iOS gets the real UIKit tab bar, which on iOS 26 is Liquid Glass.** Android
 * keeps the JS `<Tabs>` it has always had. Glass is a UIKit material and there
 * is no honest Android equivalent — a translucent fill with a blur behind it is
 * a different thing that reads as a bug beside the real one, so Android is not
 * asked to imitate it.
 *
 * **The glass is what you get by NOT ASKING for a background.** `backgroundColor`
 * and `blurEffect` are both left unset on purpose: either one replaces the
 * system appearance with a flat fill or a pre-26 `UIBlurEffect`, and the glass
 * goes with it. So the tint is the one colour this bar sets — there is no label
 * ink left to set — and the surface is UIKit's.
 *
 * **`minimizeBehavior` is `never`, against the iOS 26 default of `automatic`.**
 * A bar that shrinks away on scroll is a navigation control that is not where it
 * was a moment ago, and every screen in this group is read by someone who is
 * also holding a clipboard. The JS bar has never moved; this one does not
 * either.
 *
 * **The icons are the same MaterialCommunityIcons on both**, through
 * `VectorIcon`, rather than SF Symbols on one side and glyphs on the other.
 * Swapping the set is a separate decision from putting glass under it.
 *
 * Nothing of the type ramp crosses either bar any more, `letterSpacing`
 * included: with the labels gone there is no string on either one to set.
 */
const ICON = {
  index: 'home-variant',
  matches: 'calendar-blank',
  season: 'chart-bar',
  team: 'account-group',
} as const;

type Route = keyof typeof ICON;

/** The route table both bars are built from, so the two cannot drift. */
const TABS: { name: Route}[] = [
  { name: 'index' },
  { name: 'matches' },
  { name: 'season' },
  { name: 'team' },
];

function GlassTabs() {
  const t = useTheme();

  return (
    <NativeTabs
      // NO `backgroundColor` AND NO `blurEffect`. Setting either is what turns
      // the glass off; see the note above.
      minimizeBehavior="never"
      tintColor={t.accent}
      iconColor={{ default: t.ink2, selected: t.accent }}
    >
      {TABS.map(({ name }) => (
        <NativeTabs.Trigger key={name} name={name}>
          {/* THE LABEL IS HIDDEN, NOT ABSENT. A trigger with no `<Label>` falls
              back to the route's own title, so `index` would print under the
              first glyph. `hidden` is what actually takes the word away. */}
          <Label hidden />
          <Icon src={<VectorIcon family={MaterialCommunityIcons} name={ICON[name]} />} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

/**
 * THE ANDROID BAR'S OWN THREE NUMBERS, and they are platform metrics rather
 * than steps on the sizing ramp — the same kind of number `useTabInset`'s
 * `BAR_H` is, and written here for the same reason: a tab bar is a fixed strip
 * of chrome, not a block that scales with the window the way the board's do.
 *
 * IT CAME DOWN, AND ONLY A LITTLE. React Navigation's default row plus its own
 * label padding renders around 60 points before the system inset, which is a
 * tenth of a short phone spent on navigation — enough that the bar read as the
 * heaviest object on a screen of quiet type. 54 is what is left, and it STAYS
 * 54 now that the label has gone: what the row holds is the pill and the air
 * around it, and the rest of it is the TAP TARGET — the four rooms are reached
 * from here dozens of times a night, and shrinking the bar to the height of the
 * only thing drawn in it would be buying back points at the thumb's expense.
 */
const BAR_ROW = 54;
const PILL_H = 28;
const ICON_SZ = 22;

function JsTabs() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  /**
   * THE ACTIVE STATE IS A PILL, and on Android that is the honest version of
   * what the iOS bar gets for free. UIKit's glass picks the selected item out
   * with a material; there is no material here, so the selection is a `surface2`
   * capsule behind the glyph — the same 9% white every other raised cell in
   * these rooms is made of, and NOT a second thing the accent means. The tint
   * on the glyph is still what says WHICH tab — and with the label gone it is
   * the only word-free half of that job left, which is the second reason the
   * pill is here; it gives the lit glyph somewhere to sit.
   *
   * `size` is deliberately not taken from the caller: the bar hands down its
   * own default, and the glyph is sized against `PILL_H` here instead.
   */
  const icon =
    (name: Route) =>
    ({ focused, color }: { focused: boolean; color: ColorValue }) => (
      <View
        style={{
          height: PILL_H,
          minWidth: PILL_H * 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: PILL_H / 2,
          backgroundColor: focused ? t.surface2 : 'transparent',
        }}
      >
        <MaterialCommunityIcons name={ICON[name]} size={ICON_SZ} color={color} />
      </View>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.ink2,
        // NO LABELS ON EITHER BAR. Four glyphs a scorer learns in one night,
        // and the word under each was a second row of type in the heaviest
        // strip on a screen of quiet ones. The tint and the pill say which tab.
        tabBarShowLabel: false,
        // THE BAR IS THE CANVAS over a 1px `rule`, and `bg` rather than
        // `surface` is the point: this palette's surfaces are TRANSLUCENT, and
        // a bar is not a card sitting on the screen above it — it is a strip of
        // the same near-black ground, with the seam every card is drawn with
        // along its top edge. A 5% white here would have sampled the root's
        // light canvas behind the navigator and come out grey.
        //
        // THE HEIGHT IS STATED, AND THE SYSTEM INSET IS ADDED TO IT RATHER
        // THAN LEFT TO THE DEFAULT. `height` on this bar is the WHOLE strip,
        // padding included, so the gesture bar's inset has to be both inside
        // the height and paid again as `paddingBottom` — miss the second and
        // the labels sit under the system navigation; miss the first and the
        // bar grows by the inset instead of containing it. Everything above
        // the inset is the row: `s1`, the pill, its label, `s1`.
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopWidth: 1,
          borderTopColor: t.rule,
          height: BAR_ROW + safe.bottom,
          paddingTop: m.s1,
          paddingBottom: safe.bottom + m.s1,
        },
        // the icon carries its own pill and its own centring, so the margins
        // React Navigation would otherwise add around it are given back
        tabBarIconStyle: { height: PILL_H, marginBottom: 0 },
        // THE SCENE IS PAINTED HERE NOW, and it has to be: the shell in
        // `app/_layout.tsx` paints the LIGHT canvas, which is right for the
        // board and for every page outside this group and is the wrong thing to
        // see for a frame behind a room that is drawn on black. Each screen
        // paints its own `bg` as well; this is what is under them mid-swap.
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map(({ name }) => (
        <Tabs.Screen key={name} name={name} options={{tabBarIcon: icon(name) }} />
      ))}
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <DarkRoom>{Platform.OS === 'ios' ? <GlassTabs /> : <JsTabs />}</DarkRoom>
  );
}
