import { useEffect } from 'react';

import { FAULT_NOTE, onStorageFault, storageFault } from '../lib/fault';
import { useUiStore } from '../store/uiStore';

/**
 * THE ONE READER OF `lib/fault.ts`, and it turns a failed write into the toast.
 *
 * Mounted once, by `app/_layout.tsx`, for the same reason the game clock is:
 * the disk does not stop being full because a scorer walked off to the TEAM
 * tab, and a warning that only exists on the board is a warning the person
 * editing their roster never sees.
 *
 * `say(..., true)` is the `danger` toast, which is the loudest thing this app
 * has and still not very loud — one line, 2.6 seconds. That is deliberate and
 * it is not the whole answer: the toast is the INTERRUPTION and the settings
 * page carries the standing statement, because a fault that persists needs
 * somewhere a scorer can go back and look at it with a button beside it. See
 * `components/settings/Backup.tsx`.
 *
 * It fires on the EDGE only — the latch is in `lib/fault.ts` — so a full disk
 * failing a write every two seconds says this once rather than for ever.
 */
export function useStorageFault(): void {
  const say = useUiStore((s) => s.say);

  useEffect(() => {
    // a fault raised before this mounted is still the truth, and the first
    // write of a session is the rehydrate — which happens before any screen
    const now = storageFault();
    if (now) say(FAULT_NOTE[now], true);

    return onStorageFault((fault) => {
      if (fault) say(FAULT_NOTE[fault], true);
    });
  }, [say]);
}
