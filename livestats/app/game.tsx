import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { RotateGate } from '../components/RotateGate';
import { Toast } from '../components/Toast';
import { Board } from '../components/board/Board';
import { PanelHost } from '../components/panels/PanelHost';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { DarkRoom } from '../components/ui/DarkRoom';
import { useGameStore } from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useTheme } from '../theme/useTheme';

/**
 * The board — this route is the old `App.tsx` body and almost nothing more.
 *
 * `RotateGate` is mounted HERE and not in the root layout: at the root it would
 * cover HOME and MY TEAM, which are meant to work in portrait. The board is the
 * one screen a portrait phone cannot show, so it is the one screen that gates.
 * It renders last and over all three, and the board and its panels stay mounted
 * underneath it, so turning the device back restores the exact state the scorer
 * was in.
 *
 * THE ONE THING THAT IS NEW IS THE SKIN, AND IT IS A SETTING. `options.board`
 * says white or the lobby's near-black, and `dark` is the same `DarkRoom` the
 * four rooms and the six pushed pages wear — the same palette and the same
 * status-bar flip, not a third one invented for this screen. White is still the
 * default and still the argument: the board is read at arm's length in gym
 * lighting, and walking onto it is meant to feel like the lights coming up.
 *
 * WHAT IT DOES NOT TAKE IS THE BLOOM. The lobby draws a photograph with a warm
 * corner over it, and this is still the screen with contrast to spend on the
 * marks rather than on the ground. A dark board is a dark board, not a lobby
 * with a court on it. (`RotateGate` draws the bloom, and still may: it is
 * mounted on this route but it is not the board.)
 */
function GameBody() {
  const t = useTheme();

  /**
   * The board used to paint nothing and let the root's canvas show through the
   * Stack's transparent content. It cannot any more: the root paints the LIGHT
   * `bg` whatever this route decides, so the ground has to be painted here, in
   * the palette this subtree is actually drawn in.
   */
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Board />
      <PanelHost />
      {/* THE WALKTHROUGH SITS BETWEEN THE PANEL AND THE TOAST, and the order is
          stated by `zIndex` rather than by this list — 40, 50, 60. Above the
          panel so a step can point at a control ON one; below the toast because
          the toast is the evidence a step is teaching about. It renders nothing
          at all unless a tour is running. */}
      <TutorialOverlay />
      <Toast />
      <RotateGate />
    </View>
  );
}

export default function GameScreen() {
  const dark = useGameStore((s) => s.options.board) === 'dark';

  // Back gestures and browser navigation can leave without calling leaveTour.
  // Restore the real board and resume saving on blur or unmount, even when the
  // stack keeps this screen mounted. Read the session at exit, not at mount.
  // Keep this on the route so changing the board palette cannot end a tour.
  useFocusEffect(
    useCallback(() => () => useTutorialStore.getState().finish(false), []),
  );

  // the wrapper is what carries the palette and the status bar, so a light
  // board mounts no provider at all and is exactly what it always was
  return dark ? (
    <DarkRoom>
      <GameBody />
    </DarkRoom>
  ) : (
    <GameBody />
  );
}
