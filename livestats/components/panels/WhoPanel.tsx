import { FOUL_KINDS, REB } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useCourtBox } from '../../hooks/usePanelBox';
import { useFlow } from '../../hooks/useFlow';
import { useWhoList } from '../../store/selectors';
import { useUiStore, type What } from '../../store/uiStore';
import { CancelX, Chip, PHead, PlayerGrid } from './shell';
import type { ShotType } from '../../types';

const WHAT_LABEL: Record<What, string> = {
  made: 'Made',
  miss: 'Miss',
  oreb: 'Offensive rebound',
  dreb: 'Defensive rebound',
  ft: 'Free throws',
  foul: 'Foul',
  turnover: 'Turnover',
  steal: 'Steal',
  block: 'Block',
  foulDrawn: 'Foul drawn',
};

export function whoLabel(what: What | null, shotType: ShotType | null, foulKind: string | null): string {
  if (!what) return '';
  if (what === 'foul' && foulKind)
    return FOUL_KINDS[foulKind as keyof typeof FOUL_KINDS].label + ' foul';
  const shot = what === 'made' || what === 'miss' ? shotType + ' ' : '';
  return shot + WHAT_LABEL[what];
}

/**
 * Step 2 for every flow. The grid auto-fits, so a sixth or a twelfth player on
 * the floor changes the shape rather than the tile size. Players who have
 * fouled out are listed after the five on the floor, disabled and dimmed, so an
 * invalid record is impossible rather than merely discouraged.
 *
 * Only the rebound flow gets a tappable back chip: DR/OR is the one previous
 * choice worth returning to.
 */
export function WhoPanel() {
  const box = useCourtBox();
  const list = useWhoList();
  const { pickWho, back } = useFlow();

  const what = useUiStore((s) => s.what);
  const shotType = useUiStore((s) => s.shotType);
  const foulKind = useUiStore((s) => s.foulKind);

  const label = whoLabel(what, shotType, foulKind);
  const canBack = !!what && (REB as readonly string[]).includes(what);
  useAnnounce(label);

  return (
    <>
      <PHead>
        <Chip label={label} onPress={canBack ? back : undefined} />
        <CancelX />
      </PHead>
      <PlayerGrid players={list} box={box} onPick={pickWho} />
    </>
  );
}
