import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { useGameStore } from '../../store/gameStore';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { Act, Btn, PTitle, Row } from './shell';

/**
 * Quick free throws (`ft: 'quick'`): one made/miss per tap, and the panel stays
 * open for the next attempt — which is how a single scorer actually keeps up.
 * Each tap is its own one-shot trip, so undo steps back one attempt.
 */
export function FTResultPanel() {
  const shooter = useUiStore((s) => s.shooter);
  const p = usePlayer(shooter);
  const recordFreeThrowTrip = useGameStore((s) => s.recordFreeThrowTrip);
  const { back } = useFlow();

  useAnnounce('free throw');
  if (!p || !shooter) return null;

  const shoot = (made: boolean) => () => recordFreeThrowTrip(shooter, [made], false);

  return (
    <>
      <PTitle title="Free throw" kind={`#${p.number} · ${p.stats.ftMade}-${p.stats.ftAttempted}`} />
      <Row>
        <Act code="MADE" caption="+1 POINT" go onPress={shoot(true)} />
        <Act code="MISS" caption="NO POINT" onPress={shoot(false)} />
      </Row>
      <Row mt>
        <Btn label="BACK" onPress={back} />
      </Row>
    </>
  );
}
