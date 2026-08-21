import { useCallback, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';

import { DARK } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/useTheme';

/**
 * A ROOM DRAWN ON BLACK — the palette and the status bar, together, once.
 *
 * The two always travel together and getting one without the other is a bug
 * you only see on a device: a dark screen under a dark status bar loses the
 * clock and the battery entirely. So they are one wrapper rather than two
 * things to remember, and its callers are the places that are dark —
 * `app/(tabs)/_layout.tsx` for the four rooms, and the two pushed pages that
 * belong with them, `start` and a player's own stats.
 *
 * `ThemeProvider` is what makes it cost nothing: every shared component calls
 * `useTheme()` internally, so `Card`, `Band`, `Btn`, `Crest`, `Seam`, `Seg`,
 * `BoxTable`, `ClubCard` and `CourtSvg` all follow the surface they are placed
 * on with no `dark` prop threaded through any of them. `ClubCard` is the case
 * that proves it — the same card on the dark TEAM tab and on the light board's
 * side of the app.
 *
 * THE STATUS BAR IS FLIPPED ON FOCUS, NOT BY A MOUNTED `<StatusBar>`. That
 * component sets the style when it mounts and the last one mounted wins, and a
 * stack keeps every screen under the top one MOUNTED — so a declarative
 * `light` followed the scorer onto the light board and stayed there. Focus is
 * the fact the navigator actually knows.
 *
 * The cleanup puts the root's `dark` back rather than leaving the last dark
 * room's choice standing. React runs every cleanup in a commit before any
 * effect, so a push from one dark room to another sets `dark` and then `light`
 * in that order and never the other way round — which is why two of these
 * nested or in sequence cannot strand the bar on the wrong ink.
 *
 * It does NOT draw the bloom. That has to be the first child INSIDE the
 * screen's own root view, under its padding — see `components/ui/Bloom.tsx`.
 */
export function DarkRoom({ children }: { children: ReactNode }) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  return <ThemeProvider value={DARK}>{children}</ThemeProvider>;
}
