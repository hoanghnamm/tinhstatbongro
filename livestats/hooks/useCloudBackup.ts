import { useEffect } from 'react';
import { AppState } from 'react-native';
import { backupNow, cloudChanged, initializeCloud, refreshCloud, useCloudStore } from '../store/cloudStore';
import { useTeamStore } from '../store/teamStore';
import { useRosterStore } from '../store/rosterStore';
import { useSquadStore } from '../store/squadStore';
import { useHistoryStore } from '../store/historyStore';

/** Auto-backup runs only after this device is explicitly associated or restored. */
export function useCloudBackup() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (AppState.currentState !== 'active') return;
      const state = useCloudStore.getState();
      if (state.enabled) void backupNow();
      else if (state.account && !state.pending && !state.busy) void refreshCloud();
    };
    const changed = () => {
      cloudChanged();
      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, 2_000);
    };
    const off = [useTeamStore, useRosterStore, useSquadStore, useHistoryStore].map(store => store.subscribe(changed));
    void initializeCloud().then(attempt);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') attempt(); });
    const retry = setInterval(attempt, 60_000);
    return () => { off.forEach(fn => fn()); foreground.remove(); clearInterval(retry); if (timer) clearTimeout(timer); };
  }, []);
}
