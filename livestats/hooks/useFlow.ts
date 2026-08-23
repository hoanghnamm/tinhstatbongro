import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

import { FOUL_KINDS, REB, TALLY } from '../constants/game';
import { useGameStore } from '../store/gameStore';
import { useUiStore } from '../store/uiStore';
import type { TallyType } from '../types';

const tap = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * The one place a flow decides what a pick meant. The web build had a single
 * delegated click listener that read `data-*`; this is the same funnel with a
 * discriminated union in front of it, so a panel stays a panel and the rules
 * stay in one file.
 */
export function useFlow() {
  const ui = useUiStore;
  const game = useGameStore;

  /**
   * Step 2 landed. Every branch either opens the next step or records and
   * resets — nothing falls through, because a flow that closes silently with
   * nothing written is the one bug a scorer cannot see.
   */
  const pickWho = useCallback((playerId: string) => {
    const u = ui.getState();
    const g = game.getState();
    const pos = u.mark;

    if (u.what === 'ft') {
      u.setShooter(playerId);
      u.open({ kind: g.options.ft === 'trip' ? 'tripSize' : 'ftResult' });
      return;
    }

    if (u.what === 'made') {
      u.setShooter(playerId);
      if (g.options.assist === 'ask') {
        u.open({ kind: 'assist' });
        return;
      }
      if (pos && u.shotType) g.recordShot(playerId, pos, u.shotType, true, null, u.note);
      tap();
      u.reset();
      return;
    }

    if (u.what === 'foul' && u.foulKind) {
      const kind = FOUL_KINDS[u.foulKind];
      const outcome = g.recordFoul(playerId, pos, u.foulKind);
      // unreachable from the grid, which disables anyone already out — it stays
      // as the guard for every other caller of recordFoul
      if (outcome === 'denied') {
        u.clear();
        u.open({ kind: 'foulDenied', playerId });
        return;
      }
      const p = game.getState().players.find((x) => x.id === playerId);
      const who = `#${p?.number} ${p?.name}`;
      u.say(
        outcome === 'out' ? `${kind.short} foul · ${who} · fouled out` : `${kind.short} foul · ${who}`,
        outcome === 'out',
      );
      void Haptics.notificationAsync(
        outcome === 'out'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
      u.reset();
      return;
    }

    if (u.what === 'miss' && pos && u.shotType) {
      g.recordShot(playerId, pos, u.shotType, false, null, u.note);
    } else if (u.what === 'oreb') {
      g.recordRebound(playerId, pos, 'offensive');
    } else if (u.what === 'dreb') {
      g.recordRebound(playerId, pos, 'defensive');
    } else if (u.what && u.what in TALLY) {
      g.recordTally(playerId, pos, u.what as TallyType);
    }
    tap();
    u.reset();
  }, [game, ui]);

  /** `null` is NO ASSIST — the made shot is recorded either way. */
  const pickAssist = useCallback((assistId: string | null) => {
    const u = ui.getState();
    if (u.shooter && u.mark && u.shotType) {
      game.getState().recordShot(u.shooter, u.mark, u.shotType, true, assistId, u.note);
    }
    tap();
    u.reset();
  }, [game, ui]);

  /**
   * Back, in order: mid free-throw trip → the trip size; a shooter chosen in an
   * FT flow → step 2; a rebound kind → step 1 with the tile still selected;
   * otherwise a full reset.
   */
  const back = useCallback(() => {
    const u = ui.getState();
    if (u.trip) {
      u.setTrip(null);
      u.open({ kind: 'tripSize' });
      return;
    }
    if (u.shooter && u.what === 'ft') {
      u.setShooter(null);
      u.open({ kind: 'who' });
      return;
    }
    // ui.what is left alone so step 1 reopens with the tile still selected
    if (u.what && (REB as readonly string[]).includes(u.what)) {
      u.open({ kind: 'rebKind' });
      return;
    }
    u.reset();
  }, [ui]);

  /**
   * A fouled-out player cannot be sent to the bench, so asking who replaces
   * them is a different question from asking who comes on for them.
   */
  const openSubOut = useCallback((outId: string) => {
    const p = game.getState().players.find((x) => x.id === outId);
    ui.getState().open(
      p?.status === 'out' ? { kind: 'fouledOut', playerId: outId } : { kind: 'subOut', outId },
    );
  }, [game, ui]);

  return { pickWho, pickAssist, back, openSubOut };
}
