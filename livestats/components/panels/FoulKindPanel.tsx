import { FOUL_KINDS, FOUL_MENU } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useUiStore } from '../../store/uiStore';
import { CancelX, PGrid, PHead, PTitleText, Tile } from './shell';

/**
 * Fouls, step 1. A 2×2 grid rather than a row: FLAGRANT ran off the end of a
 * single line at every phone width, and shrinking the type to fit is not a fix
 * on a board tapped at arm's length.
 *
 * There is no team toggle and no opponent foul — only our roster is tracked.
 */
export function FoulKindPanel() {
  const foulKind = useUiStore((s) => s.foulKind);
  const setFoulKind = useUiStore((s) => s.setFoulKind);
  const setWhat = useUiStore((s) => s.setWhat);
  const open = useUiStore((s) => s.open);

  useAnnounce('personal foul');

  return (
    <>
      <PHead>
        <PTitleText>PERSONAL FOUL</PTitleText>
        <CancelX />
      </PHead>
      <PGrid columns={2}>
        {FOUL_MENU.map((k) => (
          <Tile
            key={k}
            code={FOUL_KINDS[k].short}
            caption={FOUL_KINDS[k].label}
            selected={foulKind === k}
            onPress={() => {
              setFoulKind(k);
              setWhat('foul');
              open({ kind: 'who' });
            }}
          />
        ))}
      </PGrid>
    </>
  );
}
