import { TALLY_TILES } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { useGameStore } from '../../store/gameStore';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PGrid, PHead, PSub, PTitleText, Pts, StatTile } from './shell';
import type { TallyType } from '../../types';

/**
 * The stats with no court position: block, steal, turnover, foul drawn. Each
 * tile tallies and re-renders the same panel, so a scorer logs the block and
 * the steal that followed it in one sequence without reopening anything.
 *
 * This panel does not float in the middle of the board — it takes the court's
 * own footprint, so the action columns and the rail stay readable under the
 * scrim and the four tiles get the whole court to be tapped in.
 *
 * SUBSTITUTE is a full-width inverted bar rather than a fifth tile, because it
 * is the one control here that leaves the panel.
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
  const { openSubOut } = useFlow();

  useAnnounce(p ? `#${p.number} ${p.name}` : '');
  if (!p) return null;

  return (
    <>
      <PHead>
        <PTitleText>{`#${p.number}. ${p.name}`}</PTitleText>
        <Pts>{p.status === 'out' ? 'FOULED OUT' : `${p.stats.points} pts`}</Pts>
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
              // reopening with `bumped` is what marks the tile just tapped
              open({ kind: 'playerActions', playerId, bumped: type });
            }}
          />
        ))}
      </PGrid>
      <PSub label="SUBSTITUTE" onPress={() => openSubOut(playerId)} />
    </>
  );
}
