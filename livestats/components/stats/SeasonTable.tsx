import { View } from 'react-native';

import { BoxTable } from './BoxTable';
import type { Season, SeasonMode } from '../../lib/season';

/**
 * The season's box score: the same table, over every saved game added up.
 *
 * G is the player's own count of games, and it is on the row rather than in the
 * note because it is the denominator of every other number in PER GAME — an
 * average without the number of things averaged is a number you cannot argue
 * with.
 */
export function SeasonTable({
  season,
  onPlayerPress,
}: {
  season: Season;
  mode: SeasonMode;
  onPlayerPress?: (playerId: string) => void;
}) {
  const games = new Map(season.lines.map((l) => [l.id, l.games]));

  return (
    <View>
      <BoxTable
        lines={season.lines}
        team={season.team}
        gamesFor={(p) => games.get(p.id) ?? 0}
        onRowPress={onPlayerPress}
      />
    </View>
  );
}

