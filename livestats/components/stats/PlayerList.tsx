import { Text, View } from 'react-native';

import { Press } from '../ui/Press';
import { Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { Season, SeasonLine } from '../../lib/season';

/**
 * THE SEASON'S PLAYERS — a name and three numbers, and nothing scrolls sideways.
 *
 * IT REPLACED THE TWENTY-COLUMN BOX SCORE ON THIS TAB, and the argument is
 * what the tab is FOR. `BoxTable` is the scorebook: twenty columns that do not
 * fit a phone and never will, so it scrolls sideways — which is right on a
 * saved game, where a scorer has come to look something up, and wrong on the
 * screen they land on, where the question is "who is having a season". Three
 * numbers answer that. The other seventeen are one tap away on the player's
 * own page, together with their splits, their shot chart and their game log,
 * which is more than the wide table could show anyway.
 *
 * `BoxTable` IS UNTOUCHED AND STILL HAS ITS CALLERS — a saved game and a
 * competition's page — so nothing was deleted to make this: the wide table is
 * where a wide table belongs and this is what heads the room.
 *
 * IT IS PER GAME AND THERE IS NO OTHER READING. The TOTALS / PER GAME strip
 * that used to sit over it is gone: a season's totals are a number with
 * nothing to be compared against, and a control whose two positions a scorer
 * has to try in order to find out which one they wanted is a question the
 * screen should have answered itself. The column header SAYS `Per game`, which
 * is the half of the strip that was carrying information.
 *
 * G IS ON THE ROW because of that, not in spite of it. An average without the
 * number of things averaged is a number you cannot argue with — and here the
 * denominator is not the season's game count but the player's own, since PER
 * GAME divides by the games they APPEARED in.
 *
 * NO FILL, NO EDGE, NO CHEVRON, and the press is a faint wash. Twenty rows
 * each inside a ruled box read as a stack of boxes before they read as a team;
 * what separates a row from the next is a hairline and the air around it, and
 * what separates a COLUMN is that every figure in it is the same width,
 * tabular and right-aligned to one edge.
 */

/** The three stat columns and the games column, as multiples of the row size. */
const W_NUM = 2.4;
const W_G = 2.2;
const W_STAT = 3.2;

/** Whole numbers stay whole; a per-game average keeps its one decimal. */
const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * A column's caption. `w` IS A PIXEL WIDTH, not a multiplier, and that is the
 * whole point: the caption row is set a step smaller than the rows under it,
 * so a width computed from each row's OWN font size would put every heading a
 * few points off the column it names.
 */
function HeadCell({ label, w, fs }: { label: string; w: number; fs: number }) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        width: w,
        flexGrow: 0,
        flexShrink: 0,
        textAlign: 'right',
        ...fUi(500),
        fontSize: fs,
        letterSpacing: ls(fs, LS_CAPS),
        color: t.ink3,
      }}
    >
      {label}
    </Text>
  );
}

function StatCell({
  value,
  fs,
  strong = false,
}: {
  value: string;
  fs: number;
  strong?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        width: fs * W_STAT,
        flexGrow: 0,
        flexShrink: 0,
        textAlign: 'right',
        // POINTS carries the weight and the full ink; the other two are the
        // same figure a step quieter, so the column a reader scans first is
        // the one they came for
        ...(strong ? fNum(700) : fNum(500)),
        fontSize: fs,
        letterSpacing: ls(fs, LS_TIGHT),
        color: strong ? t.ink : t.ink2,
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
    </Text>
  );
}

function PlayerRow({ line, onPress }: { line: SeasonLine; onPress?: () => void }) {
  const m = useMetrics();
  const t = useTheme();
  const fs = m.fsSm;
  const s = line.stats;

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${line.name || `Player ${line.number}`}, number ${line.number}`}
      style={{
        borderTopWidth: 1,
        borderTopColor: t.rule,
        paddingVertical: m.s3,
        minHeight: m.tap,
        justifyContent: 'center',
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Row gap={m.s2}>
        {/* the jersey is a plain figure here and not a `Jersey` plate: a plate
            is a CONTROL that says which shirt somebody is wearing, and twenty
            of them stacked down a list is twenty small orange-edged blocks
            fighting the names beside them */}
        <Text
          numberOfLines={1}
          style={{
            width: fs * W_NUM,
            flexGrow: 0,
            flexShrink: 0,
            textAlign: 'right',
            ...fNum(500),
            fontSize: fs,
            letterSpacing: ls(fs, LS_TIGHT),
            color: t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {line.number}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            ...fUi(500),
            fontSize: fs,
            letterSpacing: ls(fs, LS_LABEL),
            color: t.ink,
          }}
        >
          {line.name || `Player ${line.number}`}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            width: fs * W_G,
            flexGrow: 0,
            flexShrink: 0,
            textAlign: 'right',
            ...fNum(500),
            fontSize: fs * 0.9,
            color: t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {line.games}
        </Text>

        <StatCell value={num(s.points)} fs={fs} strong />
        <StatCell value={num(s.offensiveRebounds + s.defensiveRebounds)} fs={fs} />
        <StatCell value={num(s.assists)} fs={fs} />
      </Row>
    </Press>
  );
}

export function PlayerList({
  season,
  onPlayerPress,
}: {
  /**
   * The season, ALREADY DIVIDED — the caller asks `season()` for `perGame` and
   * this draws what it is handed. Nothing here re-derives a reading; a second
   * copy of that rule is how a caption and its column start disagreeing.
   */
  season: Season;
  onPlayerPress?: (playerId: string) => void;
}) {
  const m = useMetrics();
  const t = useTheme();
  // the caption's own size, and the size the ROWS are set at — the columns are
  // measured off the second so both rows agree on where a column is
  const fs = m.fsXs;
  const row = m.fsSm;

  if (season.lines.length === 0) {
    return (
      <Text
        style={{
          paddingVertical: m.s5,
          textAlign: 'center',
          ...fUi(500),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink3,
        }}
      >
        Nobody has a line yet
      </Text>
    );
  }

  return (
    <View>
      <Row gap={m.s2} style={{ paddingBottom: m.s2 }}>
        <View style={{ width: row * W_NUM, flexGrow: 0, flexShrink: 0 }} />
        {/* WHAT THESE NUMBERS ARE, said in the one place they are read. With
            the strip gone this is the only thing on the screen that says the
            column is an average rather than a total, and a column of `18.4`s
            and a column of `294`s look the same from a distance. */}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            ...fUi(500),
            fontSize: fs,
            letterSpacing: ls(fs, LS_MICRO),
            color: t.ink3,
          }}
        >
          Per game
        </Text>
        <HeadCell label="G" w={row * W_G} fs={fs} />
        <HeadCell label="PTS" w={row * W_STAT} fs={fs} />
        <HeadCell label="REB" w={row * W_STAT} fs={fs} />
        <HeadCell label="AST" w={row * W_STAT} fs={fs} />
      </Row>

      {season.lines.map((line) => (
        <PlayerRow
          key={line.id}
          line={line}
          onPress={onPlayerPress ? () => onPlayerPress(line.id) : undefined}
        />
      ))}
    </View>
  );
}
