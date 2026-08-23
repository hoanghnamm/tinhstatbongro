import { FOULS } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * `recordFoul` returned 'denied'. Unreachable from the picker, which disables
 * anyone already out — this is what the guard looks like when some other caller
 * reaches it, and it says plainly that nothing was recorded.
 */
export function FoulDeniedPanel({ playerId }: { playerId: string }) {
  const p = usePlayer(playerId);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('already fouled out');
  if (!p) return null;

  return (
    <>
      <PTitle title="Already fouled out" kind={`#${p.number}`} tone="bad" />
      <Note>
        {p.name} is on {FOULS} fouls and off the court, so this foul was not recorded. Pick a
        different player.
      </Note>
      <Row mt>
        <Btn label="Close" variant="solid" onPress={reset} />
      </Row>
    </>
  );
}
