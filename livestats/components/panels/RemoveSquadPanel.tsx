import { Text } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { membersOf, squadsIn } from '../../lib/squads';
import { useRosterStore } from '../../store/rosterStore';
import { useSquadStore } from '../../store/squadStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn, PTitle, Row } from './shell';

/**
 * REMOVE A TEAM — the third confirm off the board, and it wears the same shell
 * the other two do.
 *
 * IT NAMES THE TEAM RATHER THAN DESCRIBING THE ACT. The two game confirms draw
 * their game with `PSubject`, and this one deliberately does not: `PSubject` is
 * a MATCH — a line, a tail and a scoreline — and a team has no score to put in
 * it. Faking one, or leaving the figures at nought, would be a row that reads
 * as a game nobody won. So the name rides in `PTitle`'s pill where the period
 * and the jersey number ride, with the sheet's size on the line under it, and
 * that is the whole block. No prose, no second container.
 *
 * WHAT IT DOES NOT TOUCH IS THE POINT, and it is why there is no warning to
 * write. A team is a NAME AND A SELECTION over the pool: removing one drops
 * some pointers. Every player stays in the pool with their jersey, their name
 * and their availability, and every game they played stays on the shelf — the
 * caller has already established through `canRemoveSquad` that this team
 * played none, which is the one condition under which nothing can be stranded.
 * That check lives in `lib/squads.ts` rather than here, because it needs the
 * shelf and a panel has no business reading one.
 */
export function RemoveSquadPanel({ squadId }: { squadId: string }) {
  // EVERY HOOK BEFORE THE EARLY RETURN. The "team is gone" branch below is a
  // real state — the strip can remove one while this is open — and a hook
  // called after it would be a hook called conditionally.
  const m = useMetrics();
  const t = useTheme();

  const roster = useRosterStore((s) => s.players);
  const saved = useSquadStore((s) => s.squads);
  const remove = useSquadStore((s) => s.remove);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);

  const squads = squadsIn(saved, roster);
  const squad = squads.find((s) => s.id === squadId) ?? null;

  useAnnounce(squad ? `remove ${squad.name}?` : 'remove team');

  if (!squad) {
    // gone while the panel was open. Say so rather than calling reset() from a
    // render — the same call `SetNumberPanel` makes about a deleted player.
    return (
      <>
        <PTitle title="Team is gone" />
        <Row>
          <Btn label="Close" onPress={reset} />
        </Row>
      </>
    );
  }

  const n = membersOf(squad, roster).length;

  const go = () => {
    const name = squad.name;
    remove(squad.id);
    // whichever team the strip lands on now — `remove` clears the active id
    // when it was this one, and `activeIn` falls back to the first
    reset();
    say(`${name} removed`);
  };

  return (
    <>
      <PTitle title="Remove this team?" kind={squad.name} tone="bad" />

      {/* the one line, and it is the SIZE OF THE SHEET rather than a sentence
          about what removal does — nobody is deleted, and the count is the only
          fact about this team that is about to stop being true */}
      <Text
        style={{
          marginBottom: m.spLg,
          ...fUi(500),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink2,
        }}
      >
        {n === 1 ? '1 player, who stays in the pool' : `${n} players, who stay in the pool`}
      </Text>

      <Row>
        <Btn label="Cancel" onPress={reset} />
        <Btn label="Remove" variant="danger" onPress={go} />
      </Row>
    </>
  );
}
