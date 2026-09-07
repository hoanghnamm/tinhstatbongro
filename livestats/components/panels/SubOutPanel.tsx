import { useAnnounce } from '../../hooks/useAnnounce';
import { useCourtBox } from '../../hooks/usePanelBox';
import { useGameStore } from '../../store/gameStore';
import { useFouledOut, useOnBench, usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { Btn, CancelX, Chip, Empty, PEmpty, PHead, PlayerGrid } from './shell';

/**
 * Substitution, step 2: the foul and rebound shell exactly, listing the bench
 * where those two list the floor. The player coming off was chosen by the panel
 * that opened this one, so the only question here is who comes on.
 *
 * Anyone who has fouled out is listed after the bench and disabled — a dimmed
 * tile says why, and `substitute()` refuses them underneath it, so the tile is
 * a courtesy rather than the rule.
 */
export function SubOutPanel({ outId }: { outId: string }) {
  const box = useCourtBox();
  const out = usePlayer(outId);
  const bench = useOnBench();
  const dq = useFouledOut();
  const substitute = useGameStore((s) => s.substitute);
  const reset = useUiStore((s) => s.reset);

  useAnnounce(out ? `off number ${out.number}` : '');
  if (!out) return null;

  const pool = bench.concat(dq);

  return (
    <>
      <PHead>
        <Chip label={`Off #${out.number} ${out.name}`} />
        <CancelX />
      </PHead>
      {bench.length ? (
        <PlayerGrid
          players={pool}
          box={box}
          onPick={(inId) => {
            substitute(outId, inId);
            reset();
          }}
        />
      ) : (
        <PEmpty>
          <Empty>Nobody on the bench — the whole roster is already on the court.</Empty>
          <Btn label="Close" variant="solid" onPress={reset} />
        </PEmpty>
      )}
    </>
  );
}
