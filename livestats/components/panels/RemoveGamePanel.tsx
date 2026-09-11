import { useAnnounce } from '../../hooks/useAnnounce';
import { dayMonthLabel, outcomeOf, summaryKind } from '../../lib/history';
import { competitionLabel, opponentLabel } from '../../lib/team';
import { useHistoryStore } from '../../store/historyStore';
import { useUiStore } from '../../store/uiStore';
import { Btn, PSubject, PTitle, Row } from './shell';

/**
 * Deleting a saved game, confirmed.
 *
 * The same shape and the same button order as the other two destructive
 * confirms — the safe verb on the left, the one that destroys something on the
 * right in `danger` — because a scorer should not have to read which side is
 * which twice.
 *
 * UNDO does not reach here. It is the game's stack, this is the shelf the game
 * was put on when it ended, and the confirm is the whole of the safety net.
 *
 * **THE ROW IS THE ANSWER TO "WHICH GAME".** This panel used to name the game
 * in a sentence — *the win at 84 — 79, its box score and its play by play are
 * removed for good* — with the scoreline repeated a second time in a filled
 * lozenge beside the title. Two containers and three lines of prose to say what
 * the shelf underneath says in one row. `PSubject` draws THAT row instead: the
 * opponent and the competition, the date and the W/L, and the score with OURS
 * in accent. It is the same object the scorer long-pressed to get here.
 *
 * IT STILL DOES NOT GUESS. `outcomeOf` answers null on equal numbers, so an
 * unscored practice draws no letter rather than being called a win, and the
 * KIND is asked first — a practice is not a result at all.
 */
export function RemoveGamePanel({ gameId }: { gameId: string }) {
  const summary = useHistoryStore((s) => s.index.find((g) => g.id === gameId));
  const removeGame = useHistoryStore((s) => s.removeGame);
  const reset = useUiStore((s) => s.reset);

  useAnnounce('delete this game?');

  if (!summary) {
    // long-pressed on a row that has since gone. Say so and offer the one verb
    // left, rather than offering to delete something that is not there.
    return (
      <>
        <PTitle title="This game is gone" />
        <Row>
          <Btn label="Close" onPress={reset} />
        </Row>
      </>
    );
  }

  const practice = summaryKind(summary) === 'practice';
  const outcome = practice ? null : outcomeOf(summary);

  return (
    <>
      <PTitle title="Delete this game?" />
      <PSubject
        line={practice ? 'Practice' : `vs ${opponentLabel(summary.opponent)}`}
        tail={practice ? dayMonthLabel(summary.endedAt)
          : `${competitionLabel(summary.competition)} · ${dayMonthLabel(summary.endedAt)}`}
        mark={outcome ?? undefined}
        markTone={outcome === 'L' ? 'danger' : 'accent'}
        us={summary.score}
        them={summary.oppScore}
      />
      <Row>
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
