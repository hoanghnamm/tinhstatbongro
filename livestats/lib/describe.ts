import { FOUL_KINDS } from '../constants/game';
import type { GameEvent, Player } from '../types';

/** One line of play-by-play. Anything reading events must tolerate a null playerId. */
export function describe(ev: GameEvent, byId: (id: string) => Player | undefined): string {
  switch (ev.type) {
    case 'oppPoint':
      return 'OPPONENT +' + (ev.value || 1);
    case 'foulDrawn':
      return 'FOUL DRAWN';
    case 'shot':
      return (
        ev.shotType +
        (ev.result === 'made' ? ' MADE' : ' MISSED') +
        (ev.shotNote ? ' (' + ev.shotNote + ')' : '')
      );
    case 'freeThrow':
      return (ev.andOne ? 'AND-1 FT ' : 'FT ') + (ev.result === 'made' ? 'MADE' : 'MISSED');
    case 'assist':
      return 'ASSIST';
    case 'rebound':
      return ev.reboundType === 'offensive' ? 'OFF REB' : 'DEF REB';
    case 'foul':
      return (FOUL_KINDS[ev.foulKind] ?? FOUL_KINDS.personal).label + ' FOUL';
    case 'foulOut':
      return 'FOULED OUT';
    case 'substitution':
      return 'SUB IN for #' + (byId(ev.outPlayerId)?.number ?? '?');
    default:
      return ev.type.toUpperCase(); // turnover / steal / block
  }
}
