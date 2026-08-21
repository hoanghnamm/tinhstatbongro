import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';

import { Icon, Label, NativeTabs, VectorIcon } from '../../components/nav/nativeTabs';
import { DarkRoom } from '../../components/ui/DarkRoom';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, ls } from '../../theme/tokens';
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
 * goes with it. So the two colours this bar sets are the two it is allowed to —
 * the tint and the label ink — and the surface is UIKit's.
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
 * The one thing that does not cross: `letterSpacing`. `NativeTabsLabelStyle`
 * has no such key — a UIKit bar item is not a `Text` — so `LS_LABEL` is spent
 * on the Android bar only.
 */
const ICON = {
  index: 'home-variant',
  matches: 'calendar-blank',
  season: 'chart-bar',
  team: 'account-group',
} as const;

type Route = keyof typeof ICON;

/** The route table both bars are built from, so the two cannot drift. */
const TABS: { name: Route; title: string }[] = [
  { name: 'index', title: 'LOBBY' },
  { name: 'matches', title: 'MATCHES' },
  { name: 'season', title: 'STATS' },
  { name: 'team', title: 'TEAM' },
];

function GlassTabs() {
  const m = useMetrics();
  const t = useTheme();

  const label = { fontFamily: fNum(600), fontSize: m.fsXs };

  return (
    <NativeTabs
      // NO `backgroundColor` AND NO `blurEffect`. Setting either is what turns
      // the glass off; see the note above.
      minimizeBehavior="never"
      tintColor={t.accent}
      iconColor={{ default: t.ink2, selected: t.accent }}
      labelStyle={{
        default: { ...label, color: t.ink2 },
        selected: { ...label, color: t.accent },
      }}
    >
      {TABS.map(({ name, title }) => (
        <NativeTabs.Trigger key={name} name={name}>
          <Label>{title}</Label>
          <Icon src={<VectorIcon family={MaterialCommunityIcons} name={ICON[name]} />} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function JsTabs() {
  const m = useMetrics();
  const t = useTheme();

  const icon =
    (name: Route) =>
    ({ color, size }: { color: string; size: number }) => (
      <MaterialCommunityIcons name={ICON[name]} size={size} color={color} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.ink2,
        // THE BAR IS THE CANVAS over a 1px `rule`, and `bg` rather than
        // `surface` is the point: this palette's surfaces are TRANSLUCENT, and
        // a bar is not a card sitting on the screen above it — it is a strip of
        // the same near-black ground, with the seam every card is drawn with
        // along its top edge. A 5% white here would have sampled the root's
        // light canvas behind the navigator and come out grey.
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopWidth: 1,
          borderTopColor: t.rule,
        },
        tabBarLabelStyle: {
          fontFamily: fNum(600),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
        },
        // THE SCENE IS PAINTED HERE NOW, and it has to be: the shell in
        // `app/_layout.tsx` paints the LIGHT canvas, which is right for the
        // board and for every page outside this group and is the wrong thing to
        // see for a frame behind a room that is drawn on black. Each screen
        // paints its own `bg` as well; this is what is under them mid-swap.
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map(({ name, title }) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: icon(name) }} />
      ))}
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <DarkRoom>{Platform.OS === 'ios' ? <GlassTabs /> : <JsTabs />}</DarkRoom>
  );
}
