import { View } from 'react-native';

import { BoxTable } from './BoxTable';
import type { Report, Split } from '../../lib/box';

/**
 * The box score for one game or one quarter of it. The table itself is
 * `BoxTable`, which the season screen renders too — a season line and a game
 * line are the same twenty columns over the same shape, so there is one of
 * them and no second one to drift.
 */
export function PlayersTab({ report }: { report: Report; split: Split }) {
  return (
    <View>
      <BoxTable lines={report.lines} team={report.team} />
    </View>
  );
}
