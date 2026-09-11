import { useMemo } from 'react';

import { activeIn, squadsIn } from '../lib/squads';
import { useRosterStore } from '../store/rosterStore';
import { useSquadStore } from '../store/squadStore';
import type { RosterPlayer, Squad } from '../types';

/**
 * WHICH TEAM OF THE CLUB EVERY SCREEN IS ABOUT, and it is one hook so that
 * question has one answer.
 *
 * Seven screens follow the strip on the TEAM tab — the lobby's two cards, the
 * shelf, the season, one competition, the comparison and the picker — and each
 * of them needs the same two lines: supply the derived first team for a club
 * that has never split into teams, then pick the saved one out of it. Written
 * out seven times, the first screen to forget `squadsIn` would show an empty
 * strip and a shelf with nothing on it.
 *
 * It reads the POOL as well as the teams, because the derived first team IS
 * the pool. That is the one place a component is allowed to know it.
 */
export function useActiveSquad(): { squad: Squad; squads: Squad[]; roster: RosterPlayer[] } {
  const roster = useRosterStore((s) => s.players);
  const saved = useSquadStore((s) => s.squads);
  const activeId = useSquadStore((s) => s.activeId);

  return useMemo(() => {
    const squads = squadsIn(saved, roster);
    return { squad: activeIn(squads, activeId), squads, roster };
  }, [saved, roster, activeId]);
}
