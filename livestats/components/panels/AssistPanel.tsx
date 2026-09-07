import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { useCourtBox } from '../../hooks/usePanelBox';
import { useOnCourt, usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PEmpty, PHead, PSub, PTitleText, Pts, PlayerGrid } from './shell';

/**
 * Step 3, made shots only — and a picker, so it looks like every other picker:
 * the court shell, one CANCEL, the same auto-fitting tile grid, and NO ASSIST
 * as the foot bar where SUBSTITUTE sits, because it is the one button there
 * that skips the pick. The made shot it belongs to is plain header text, never
 * a button.
 */
export function AssistPanel() {
  const box = useCourtBox();
  const { pickAssist } = useFlow();
  const shooter = useUiStore((s) => s.shooter);
  const shotType = useUiStore((s) => s.shotType);
  const p = usePlayer(shooter);
  const mates = useOnCourt().filter((x) => x.id !== shooter);

  useAnnounce('assist');

  return (
    <>
      <PHead>
        <PTitleText>Assist</PTitleText>
        <Pts>{`#${p?.number ?? ''} ${shotType} made`}</Pts>
        <CancelX />
      </PHead>
      {mates.length ? (
        <PlayerGrid players={mates} box={box} onPick={(id) => pickAssist(id)} />
      ) : (
        <PEmpty />
      )}
      {/* the walkthrough spotlights this bar by name: it is the way OUT of a
          question the board only asks because a setting says to */}
      <PSub label="No assist" targetId="assist.none" onPress={() => pickAssist(null)} />
    </>
  );
}
