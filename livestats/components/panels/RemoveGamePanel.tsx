import { useAnnounce } from '../../hooks/useAnnounce';
import { resultOf } from '../../lib/history';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, Note, PTitle, Row } from './shell';

/**
 * Deleting a saved game, confirmed.
 *
 * The same shape and the same button order as the other two destructive
 * confirms — the safe verb on the left, the one that destroys something on the
 * right in `danger` — because a scorer should not have to read which side is
 * which twice.
 *
 * UNDO does not reach here. It is the game's stack, this is the shelf the game
 * was put on when it ended, and the confirm is the whole of the safety net —
 * which the note says out loud rather than leaving to be discovered.
 */
export function RemoveGamePanel({ gameId }: { gameId: string }) {
  const summary = useHistoryStore((s) => s.index.find((g) => g.id === gameId));
  const removeGame = useHistoryStore((s) => s.removeGame);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('delete this game?');

  const score = summary ? `${summary.score} — ${summary.oppScore}` : '';

  return (
    <>
      <PTitle title="Delete this game?" kind={score || undefined} tone="ink" />
      <Note>
        {summary
          ? `The ${resultOf(summary) === 'W' ? 'win' : 'loss'} at ${score}, its box score and its play by play are removed for good. Undo does not reach saved games, and the season totals drop it too.`
          : 'This game is no longer on the shelf.'}
      </Note>
      <Row mt>
        <Btn label="Keep it" onPress={reset} />
        <Btn
          label="Delete"
          variant="danger"
          onPress={() => {
            removeGame(gameId);
            reset();
          }}
        />
      </Row>
    </>
  );
}
