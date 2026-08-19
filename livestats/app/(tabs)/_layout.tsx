import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

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
 * screen.
 *
 * TEAM is singular. There is one team, and a plural label would promise a
 * switcher that does not exist and is not coming.
 *
 * `accent` is spent here on exactly one thing — the active tab — which is one
 * of the four jobs the palette still lets it do. The inactive tint is `ink2`
 * and the bar is `surface` over a 1px `rule`, the same seam every card on
 * every screen is drawn with.
 */
const ICON = {
  index: 'home-variant',
  matches: 'calendar-blank',
  season: 'chart-bar',
  team: 'account-group',
} as const;

type Route = keyof typeof ICON;

export default function TabsLayout() {
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
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.rule,
        },
        tabBarLabelStyle: {
          fontFamily: fNum(600),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
        },
        // the shell in `_layout` already paints the canvas; a second fill here
        // would be the one that wins on a rotation mid-transition
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'LOBBY', tabBarIcon: icon('index') }} />
      <Tabs.Screen name="matches" options={{ title: 'MATCHES', tabBarIcon: icon('matches') }} />
      <Tabs.Screen name="season" options={{ title: 'STATS', tabBarIcon: icon('season') }} />
      <Tabs.Screen name="team" options={{ title: 'TEAM', tabBarIcon: icon('team') }} />
    </Tabs>
  );
}
