import { View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { BoxTable } from './BoxTable';
import { Note } from './parts';
import type { Season, SeasonMode } from '../../lib/season';

/**
 * The season's box score: the same table, over every saved game added up.
 *
 * G is the player's own count of games, and it is on the row rather than in the
 * note because it is the denominator of every other number in PER GAME — an
 * average without the number of things averaged is a number you cannot argue
 * with.
 */
export function SeasonTable({ season, mode }: { season: Season; mode: SeasonMode }) {
  const m = useMetrics();
  const games = new Map(season.lines.map((l) => [l.id, l.games]));

  return (
    <View>
      <BoxTable
        lines={season.lines}
        team={season.team}
        gamesFor={(p) => games.get(p.id) ?? 0}
      />

      <View style={{ height: m.s3 }} />

      <Note>
        {mode === 'perGame'
          ? 'Every number is divided by G — the games that player actually appeared in, not the games the team played. A player is counted as having appeared if they started, played a second, or have anything at all on their line.'
          : 'Totals across every saved game. G is the games that player appeared in.'}
        {' '}
        A player is matched between games by their roster id, so a change of name or number since
        does not split their line in two — and the name shown is the one the team holds now.
        Deleting a game removes it from these totals; deleting a player from the team does not,
        because the games they played still happened.
      </Note>
    </View>
  );
}
