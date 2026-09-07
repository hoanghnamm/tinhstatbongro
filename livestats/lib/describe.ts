import { FOUL_KINDS } from '../constants/game';
import type { GameEvent, Player } from '../types';

/** One line of play-by-play. Anything reading events must tolerate a null playerId. */
export function describe(ev: GameEvent, byId: (id: string) => Player | undefined): string {
  switch (ev.type) {
    case 'oppPoint':
      return 'Opponent +' + (ev.value || 1);
    case 'foulDrawn':
      return 'Foul drawn';
    case 'shot':
      return (
        ev.shotType +
        (ev.result === 'made' ? ' made' : ' missed') +
        (ev.shotNote ? ' (' + ev.shotNote + ')' : '')
      );
    case 'freeThrow':
      return (ev.andOne ? 'And-1 FT ' : 'FT ') + (ev.result === 'made' ? 'made' : 'missed');
    case 'assist':
      return 'Assist';
    case 'rebound':
      return ev.reboundType === 'offensive' ? 'Off reb' : 'Def reb';
    case 'foul':
      return (FOUL_KINDS[ev.foulKind] ?? FOUL_KINDS.personal).label + ' foul';
    case 'foulOut':
      return 'Fouled out';
    case 'substitution':
      return 'Sub in for #' + (byId(ev.outPlayerId)?.number ?? '?');
    case 'timeout':
      return 'Timeout';
    default:
      // turnover / steal / block — a word, capitalised like every other one
      return ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
  }
}
