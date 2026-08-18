import { View } from 'react-native';

import { RotateGate } from '../components/RotateGate';
import { Toast } from '../components/Toast';
import { Board } from '../components/board/Board';
import { PanelHost } from '../components/panels/PanelHost';

/**
 * The board, unchanged — this route is the old `App.tsx` body and nothing more.
 *
 * `RotateGate` is mounted HERE and not in the root layout: at the root it would
 * cover HOME and MY TEAM, which are meant to work in portrait. The board is the
 * one screen a portrait phone cannot show, so it is the one screen that gates.
 * It renders last and over all three, and the board and its panels stay mounted
 * underneath it, so turning the device back restores the exact state the scorer
 * was in.
 */
export default function GameScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Board />
      <PanelHost />
      <Toast />
      <RotateGate />
    </View>
  );
}
