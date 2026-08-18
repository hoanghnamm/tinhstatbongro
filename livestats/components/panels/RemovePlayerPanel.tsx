import { useAnnounce } from '../../hooks/useAnnounce';
import { useRosterStore } from '../../store/rosterStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * Delete confirms, because a row's delete affordance sits a thumb's width from
 * the row's own edit tap and the roster is not undoable — `undo()` covers the
 * game, not the team.
 *
 * It names the player rather than saying "this player": the confirm has to be
 * readable as a sentence by someone who already stopped looking at the list.
 */
export function RemovePlayerPanel({ playerId }: { playerId: string }) {
  const player = useRosterStore((s) => s.players.find((p) => p.id === playerId));
  const remove = useRosterStore((s) => s.remove);
  const reset = useUiStore((s) => s.reset);

  const title = player ? `REMOVE #${player.number} ${player.name}?` : 'REMOVE PLAYER?';
  useAnnounce(title);

  return (
    <>
      <PTitle title={title} />
      <Note>A game already in progress keeps them. This only changes the team.</Note>
      <Row mt>
        <Btn label="CANCEL" onPress={reset} />
        <Btn
          label="REMOVE"
          variant="danger"
          onPress={() => {
            remove(playerId);
            reset();
          }}
        />
      </Row>
    </>
  );
}
