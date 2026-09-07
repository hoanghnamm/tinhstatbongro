import { TALLY_TILES } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { useLitClose } from '../../hooks/useLitClose';
import { useGameStore } from '../../store/gameStore';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PGrid, PHead, PSub, PTitleText, Pts, StatTile } from './shell';
import type { TallyType } from '../../types';

/**
 * The stats with no court position: block, steal, turnover, foul drawn. A tile
 * tallies, LIGHTS, and the panel goes — the same shape as every court flow,
 * with `say()` carrying the confirmation off the sheet that is closing.
 *
 * It used to reopen itself after every tally so a block and the steal that
 * followed it were one sequence. That is the rarer half of the trade: a scorer
 * tapping one stat had to dismiss a sheet they were finished with, every time,
 * and a run of two is two taps on the row rather than one.
 *
 * This panel does not float in the middle of the board — it takes the court's
 * own footprint, so the action columns and the rail stay readable under the
 * scrim and the four tiles get the whole court to be tapped in.
 *
 * SUBSTITUTE is a full-width inverted bar rather than a fifth tile, because it
 * is the one control here that leaves the panel by ASKING something else.
 */
export function PlayerActionsPanel({
  playerId,
  bumped,
}: {
  playerId: string;
  bumped: TallyType | null;
}) {
  const p = usePlayer(playerId);
  const recordTally = useGameStore((s) => s.recordTally);
  const open = useUiStore((s) => s.open);
  const litClose = useLitClose('playerActions');
  const { openSubOut } = useFlow();

  useAnnounce(p ? `#${p.number} ${p.name}` : '');
  if (!p) return null;

  return (
    <>
      <PHead>
        <PTitleText>{`#${p.number}. ${p.name}`}</PTitleText>
        <Pts>{p.status === 'out' ? 'Fouled out' : `${p.stats.points} pts`}</Pts>
        <CancelX />
      </PHead>
      <PGrid columns={2}>
        {TALLY_TILES.map(([type, abbr, word, key]) => (
          <StatTile
            key={type}
            short={abbr}
            full={word}
            badge={p.stats[key]}
            selected={bumped === type}
            accessibilityLabel={`${word}, ${p.stats[key]} so far`}
            onPress={() => {
              recordTally(playerId, null, type);
              // reopening with `bumped` is what marks the tile just tapped —
              // the tally is already in, so this draws the ring and the badge
              // it moved, and `litClose` takes the sheet away behind them
              open({ kind: 'playerActions', playerId, bumped: type });
              litClose(`${word} · #${p.number} ${p.name}`);
            }}
          />
        ))}
      </PGrid>
      {/* the one control on this panel that asks something ELSE rather than
          writing an entry, which is the whole of what the walkthrough says
          about it */}
      <PSub label="Substitute" targetId="player.sub" onPress={() => openSubOut(playerId)} />
    </>
  );
}
