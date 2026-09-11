import { useState } from 'react';
import { View } from 'react-native';

import { Btn } from '../panels/shell';
import { Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { BoxTable } from './BoxTable';
import { PlayerSummary } from './PlayerSummary';
import { Card } from './parts';
import type { Report, Split } from '../../lib/box';

/**
 * The players, for one game or one quarter of it.
 *
 * TWO VIEWS OF ONE TABLE, and the compact one opens. `PlayerSummary` is name,
 * number, minutes, points and the five figures that qualify them, laid out so
 * a phone reads it without moving; `BoxTable` is the twenty columns a scorer
 * copies out, and it scrolls sideways because twenty columns always will.
 * Which one you want depends on why you opened the tab, so the tab asks.
 *
 * IT IS A BUTTON AND NOT A THIRD `Seg` STRIP. There are already two strips at
 * the top of this screen — which tab, and which quarter — and both change what
 * the numbers MEAN. This changes how the same numbers are drawn, which is a
 * different kind of question and does not belong in the same furniture. It
 * sits under the table for the same reason the export button does: it is what
 * you reach for after reading, not before.
 *
 * `BoxTable` is shared with the season screen — a season line and a game line
 * are the same twenty columns over the same `Player[]`, which is why there is
 * one of it and no second one to drift.
 */
export function PlayersTab({ report }: { report: Report; split: Split }) {
  const m = useMetrics();
  const [full, setFull] = useState(false);

  return (
    <View>
      {full ? (
        <BoxTable lines={report.lines} team={report.team} />
      ) : (
        <Card>
          <PlayerSummary lines={report.lines} team={report.team} />
        </Card>
      )}

      <Row align="stretch" style={{ marginTop: m.s4 }}>
        <Btn
          label={full ? 'Show the summary' : 'Show the full box score'}
          variant="surface"
          onPress={() => setFull((v) => !v)}
        />
      </Row>
    </View>
  );
}
