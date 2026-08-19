import { useAnnounce } from '../../hooks/useAnnounce';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PGrid, PHead, PTitleText, StatTile } from './shell';

/**
 * Rebounds off the sidebar: kind first, then who — the foul flow's shell
 * exactly, two tiles wide instead of four. DR leads because a defensive
 * rebound is far more frequent and gets the easier reach. No team toggle: only
 * our roster is tracked, so an opponent board has nowhere to go.
 */
export function RebKindPanel() {
  const what = useUiStore((s) => s.what);
  const setWhat = useUiStore((s) => s.setWhat);
  const open = useUiStore((s) => s.open);

  useAnnounce('rebound');

  const pick = (w: 'dreb' | 'oreb') => () => {
    setWhat(w);
    open({ kind: 'who' });
  };

  return (
    <>
      <PHead>
        <PTitleText>REBOUND</PTitleText>
        <CancelX />
      </PHead>
      <PGrid columns={2}>
        <StatTile short="DR" full="DEFENSIVE" big selected={what === 'dreb'} onPress={pick('dreb')} />
        <StatTile short="OR" full="OFFENSIVE" big selected={what === 'oreb'} onPress={pick('oreb')} />
      </PGrid>
    </>
  );
}
