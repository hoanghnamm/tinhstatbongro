import { useAnnounce } from '../../hooks/useAnnounce';
import { useFlow } from '../../hooks/useFlow';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { Act, Btn, PTitle, Row } from './shell';

/**
 * Batched free throws (`ft: 'trip'`), step 1: how many shots. The whole trip is
 * one `recordFreeThrowTrip` call, so one undo reverses all of it while the
 * play-by-play still gets one line per attempt.
 */
export function TripSizePanel() {
  const shooter = useUiStore((s) => s.shooter);
  const setTrip = useUiStore((s) => s.setTrip);
  const open = useUiStore((s) => s.open);
  const p = usePlayer(shooter);
  const { back } = useFlow();

  useAnnounce('how many shots');
  if (!p || !shooter) return null;

  const start = (n: number, andOne: boolean) => () => {
    setTrip({ shooter, andOne, shots: Array<boolean | null>(n).fill(null) });
    open({ kind: 'tripShots' });
  };

  return (
    <>
      <PTitle title="How many shots?" kind={`#${p.number} at the line`} />
      <Row>
        <Act code="1" caption="One shot" onPress={start(1, false)} />
        <Act code="2" caption="Two shots" onPress={start(2, false)} />
        <Act code="3" caption="Three shots" onPress={start(3, false)} />
        <Act code="+1" caption="And-1" onPress={start(1, true)} />
      </Row>
      <Row mt>
        <Btn label="Back" onPress={back} />
      </Row>
    </>
  );
}
