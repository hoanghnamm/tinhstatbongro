import { View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { BoxTable } from './BoxTable';
import { Note } from './parts';
import type { Report, Split } from '../../lib/box';

/**
 * The box score for one game or one quarter of it. The table itself is
 * `BoxTable`, which the season screen renders too — a season line and a game
 * line are the same twenty columns over the same shape, so there is one of
 * them and no second one to drift.
 */
export function PlayersTab({ report, split }: { report: Report; split: Split }) {
  const m = useMetrics();

  return (
    <View>
      <BoxTable lines={report.lines} team={report.team} />

      <View style={{ height: m.s3 }} />

      <Note>
        GS marks the five who started. Plus / minus counts every point either way against the
        five who were on the floor when it went up, so it is a real one and not the ON half the
        board shows mid-game. Efficiency is points, rebounds, assists, steals and blocks, minus
        missed shots, missed free throws and turnovers.
        {split === null
          ? ''
          : ' A quarter is rebuilt from the play log: minutes come from the game clock stamped on each event, so a quarter ended early credits its unplayed tail to whoever was out there.'}
      </Note>
    </View>
  );
}
