import { View } from 'react-native';

import { mmss, pct } from '../../lib/format';
import { efg, ts } from '../../lib/stats';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { Line, Seam, Section, Tile } from './parts';
import type { Report, Split } from '../../lib/box';

/** Past this the two stacks sit side by side — a tablet, or a phone laid down. */
const TWO_UP = 720;

/**
 * The team's whole line for one slice.
 *
 * Four blocks, in the order a coach reads them: what the shooting was, what
 * the ball did, where the points came from, and what the scoreboard did. They
 * are four cards rather than one long one because the tab is already the
 * scroll — a single 30-row card is a wall, and the point of splitting the
 * screen at all was that nothing should arrive as a wall.
 *
 * The last three rows of SCORING are derived from the LOG'S SHAPE rather than
 * from a tap, and the note under them says so. That is the honest way to ship
 * a stat this board never asks the scorer for: print it, and print what it
 * actually measured.
 */
export function TeamTab({ report, split }: { report: Report; split: Split }) {
  const m = useMetrics();
  const t = useTheme();
  const T = report.team;
  const a = report.advanced;
  const two = m.win.w >= TWO_UP;

  const margin = report.us - report.them;
  const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
  const marginTone = margin > 0 ? t.accent : margin < 0 ? t.danger : undefined;

  const shooting = (
    <Section title="Shooting">
      <Line head label="" value="M-A" sub="Pct" />
      <Line label="Field goals" value={`${T.fgm}-${T.fga}`} sub={pct(T.fgm, T.fga)} />
      <Line label="2 points" value={`${T.twom}-${T.twoa}`} sub={pct(T.twom, T.twoa)} />
      <Line label="3 points" value={`${T.tpm}-${T.tpa}`} sub={pct(T.tpm, T.tpa)} />
      <Line label="Free throws" value={`${T.ftm}-${T.fta}`} sub={pct(T.ftm, T.fta)} />
      <Line label="Effective FG%" value={efg(T)} strong />
      <Line label="True shooting%" value={ts(T)} strong />
    </Section>
  );

  const ball = (
    <Section title="Rebounds and ball">
      <Line head label="" value="Total" sub="" />
      <Line label="Offensive rebounds" value={T.oreb} />
      <Line label="Defensive rebounds" value={T.dreb} />
      <Line label="Total rebounds" value={T.reb} strong />
      <Line label="Assists" value={T.ast} />
      <Line label="Turnovers" value={T.to} />
      <Line label="Steals" value={T.st} />
      <Line label="Blocks" value={T.bs} />
      <Line label="Personal fouls" value={T.pf} sub={T.tf + T.fl ? `${T.tf}T ${T.fl}F` : ''} />
      <Line label="Fouls drawn" value={T.fd} />
      <Line label="Efficiency" value={T.ef} strong />
      <Line label="Plus / minus" value={signed(margin)} tone={marginTone} strong />
    </Section>
  );

  const scoring = (
    <Section title="Where the points came from">
      <Line head label="" value="PTS" sub="Of" />
      <Line label="Points" value={report.us} strong />
      <Line label="Points in the paint" value={a.paint} sub={pct(a.paint, report.us)} />
      <Line label="Second chance points" value={a.secondChance} sub={pct(a.secondChance, report.us)} />
      <Line label="Fast break points" value={a.fastBreak} sub={pct(a.fastBreak, report.us)} />
      <Line label="Points from turnovers" value={a.offTurnovers} sub={pct(a.offTurnovers, report.us)} />
      <Line label="Bench points" value={a.bench} sub={pct(a.bench, report.us)} />
    </Section>
  );

  const board = (
    <Section title="The scoreboard">
      <Line head label="" value="Us" sub="Them" />
      <Line label="Biggest lead" value={a.biggestLead} sub={String(a.oppBiggestLead)} />
      <Line label="Biggest scoring run" value={a.biggestRun} sub={String(a.oppBiggestRun)} />
      <Line label="Lead changes" value={a.leadChanges} />
      <Line label="Times tied" value={a.timesTied} />
      <Line label="Time with the lead" value={mmss(a.timeAhead)} />
      <Line
        label="Points per possession"
        value={a.ppp === null ? '—' : a.ppp.toFixed(2)}
        sub={a.ppp === null ? '' : 'poss'}
        strong
      />
    </Section>
  );

  return (
    <View>
      <View style={{ marginBottom: m.spLg }}>
        <Seam>
          <Tile value={report.us} label="Points" tone={margin > 0 ? t.accent : undefined} />
          <Tile value={pct(T.fgm, T.fga)} label="FG%" />
          <Tile value={pct(T.tpm, T.tpa)} label="3P%" />
          <Tile value={pct(T.ftm, T.fta)} label="FT%" />
        </Seam>
      </View>

      <View style={{ flexDirection: two ? 'row' : 'column', gap: two ? m.spLg : 0 }}>
        <View style={{ flex: two ? 1 : undefined, minWidth: 0 }}>
          {shooting}
          {ball}
        </View>
        <View style={{ flex: two ? 1 : undefined, minWidth: 0 }}>
          {scoring}
          {board}
        </View>
      </View>
    </View>
  );
}
