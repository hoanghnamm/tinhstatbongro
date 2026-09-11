import { useMemo } from 'react';
import { View } from 'react-native';

import { BREAK_WINDOW } from '../../lib/box';
import { mmss, pct } from '../../lib/format';
import { standouts } from '../../lib/observe';
import { efg, ts } from '../../lib/stats';
import { useMetrics } from '../../theme/metrics';
import { useTheme } from '../../theme/useTheme';
import { GameFlow } from './GameFlow';
import { Standouts } from './Standouts';
import { Line, Seam, Section, Tile } from './parts';
import type { Report, Split } from '../../lib/box';
import type { GameState } from '../../types';

/** Past this the two stacks sit side by side — a tablet, or a phone laid down. */
const TWO_UP = 720;

/**
 * The team's whole line for one slice.
 *
 * THE ORDER IS THE READING ORDER, and it was rebuilt to be: the four measures
 * that decide most basketball games, then when the lead moved, then the two
 * things worth saying out loud, and only then the tables. A scorer looking at
 * this in a timeout has about ten seconds, and the ten seconds should be spent
 * on shooting, turnovers, offensive rebounds and free throws rather than on
 * hunting for them among thirty rows.
 *
 *   THE FOUR TILES ARE THE FOUR FACTORS — eFG%, turnovers, offensive rebounds
 *   and the free-throw line. They are categories, not targets: no league
 *   average is printed beside them and no weighting is applied, because the
 *   published weights come off competitions this app has never seen.
 *
 *   THE SCORE IS NOT ONE OF THEM. It is at the top of the screen, once, where
 *   the opponent's name is; a `Points` tile here was the same number a second
 *   time and it cost the strip a quarter of its width. What the SLICE scored
 *   is the `Points` row of the third block and the quarter table's own row.
 *
 *   TWO BY TWO ON A PHONE. `Off. rebounds` and `Free throws` are words, and a
 *   quarter of a 320dp screen is not enough for a word — the strip folds
 *   rather than the captions being abbreviated into a code nobody reads.
 *
 * The four tables that follow are the order a coach reads them in: what the
 * shooting was, what the ball did, where the points came from, and what the
 * scoreboard did. Four cards rather than one long one, because the tab is
 * already the scroll and a single 30-row card is a wall.
 *
 * THE THREE DERIVED ROWS SAY WHAT THEY MEASURED IN THEIR OWN LABELS. Second
 * chance, fast break and points off turnovers are not tapped — they are read
 * out of the shape of the log, and each one measures something narrower than
 * its usual name. `Points off our steals` is the honest name for a figure that
 * can only open on the opponent turnovers this one-team board hears about, and
 * putting that in the label is what makes it printable at all. It used to be a
 * footnote; a footnote is a thing under a table, and the number is read in the
 * table.
 */
export function TeamTab({
  game,
  report,
  split,
  onSplit,
}: {
  game: GameState;
  report: Report;
  split: Split;
  /** moving the quarter filter — how an observation leads to its own rows */
  onSplit?(split: Split): void;
}) {
  const m = useMetrics();
  const t = useTheme();
  const T = report.team;
  const a = report.advanced;
  const two = m.win.w >= TWO_UP;

  // THE GAME'S, NOT THE SLICE'S. Every rule in `observe` counts across periods
  // — where the turnovers came, which quarter the run was in — so asking it
  // about one quarter is asking a question it has already answered. Which is
  // also why the block stays put when the filter moves: an observation names
  // its own period, and following one must not delete it.
  const obs = useMemo(() => standouts(game), [game]);

  const margin = report.us - report.them;
  const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
  const marginTone = margin > 0 ? t.accent : margin < 0 ? t.danger : undefined;

  const tiles = [
    <Tile key="efg" value={efg(T)} label="eFG%" />,
    <Tile key="to" value={T.to} label="Turnovers" />,
    <Tile key="or" value={T.oreb} label="Off. rebounds" />,
    <Tile key="ft" value={`${T.ftm}-${T.fta}`} label="Free throws" />,
  ];

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
      <Line
        label="After our offensive rebounds"
        value={a.secondChance}
        sub={pct(a.secondChance, report.us)}
      />
      <Line
        // the number in the label is the CONSTANT, so the sentence and the
        // window it describes cannot drift apart
        label={`Fast break, within ${BREAK_WINDOW}s`}
        value={a.fastBreak}
        sub={pct(a.fastBreak, report.us)}
      />
      <Line
        label="Points off our steals"
        value={a.offTurnovers}
        sub={pct(a.offTurnovers, report.us)}
      />
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
        // WHOLE GAME ONLY, and the label says which count it divided by: the
        // possession tally is a scalar with no event behind it, so a quarter
        // has no share of it to take. See `advancedFor`.
        label="Points per possession, whole game"
        value={a.ppp === null ? '—' : a.ppp.toFixed(2)}
        sub={a.ppp === null ? '' : 'poss'}
        strong
      />
    </Section>
  );

  return (
    <View>
      <View style={{ marginBottom: m.spLg }}>
        {two ? (
          <Seam>{tiles}</Seam>
        ) : (
          /* the 1px gap IS the grid, so the rows are seamed together the same
             way the cells inside them are */
          <View style={{ gap: 1, backgroundColor: t.rule }}>
            <Seam>{tiles.slice(0, 2)}</Seam>
            <Seam>{tiles.slice(2)}</Seam>
          </View>
        )}
      </View>

      <GameFlow game={game} split={split} />

      {obs.length > 0 && (
        <Section title="What stands out">
          <Standouts items={obs} split={split} onSplit={onSplit} />
        </Section>
      )}

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
