import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Col, Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { mmss } from '../../lib/format';
import {
  deltaLabel,
  figure,
  netLabel,
  ratioLabel,
  type CompareRow,
  type Highlight,
  type ImpactRow,
  type TimeoutRun,
} from '../../lib/analysis';

/**
 * THE GAME, THE BASELINE, AND WHAT MOVED — three columns and no grid.
 *
 * There is ONE of this and it is drawn many times: once per group on the
 * comparison page, and once on a player's card. Every one of them is the same
 * three columns over rows `lib/analysis.ts` built, which is exactly why that
 * file builds the team's and the player's as the same `CompareRow` — a second
 * table for the player would be a second answer to "which way is up".
 *
 * IT IS TYPE ON THE ROOM'S OWN GROUND, not a card. The shelf's rows already
 * make this argument and it holds harder here: this table is drawn INSIDE a
 * section that is already inside a scroll view, and a filled, ruled, rounded
 * box around six rows of numbers is a card sitting on a card. What separates
 * one row from the next is a 1px `rule` and the space either side of it, and
 * what separates one COLUMN from the next is alignment — every figure in a
 * column is the same width, tabular, and right-aligned to the same edge.
 *
 * THE COLUMNS ARE FIXED WIDTHS OFF THE TYPE SIZE and the label takes the
 * slack. A column that sizes to its own contents moves as the season goes on,
 * and a table that moves is a table you have to read twice.
 */

/**
 * The four columns, as multiples of the row's own font size.
 *
 * LAST is the widest of the four and not because its numbers are longer: it is
 * the one cell set a STEP UP from the row it sits in, so a width measured in
 * the row's own size would clip `100%` at the size it is actually drawn — the
 * factor between `fsMd` and `fsSm` reaches 1.28 in the middle of the ramp, and
 * that is what `W_LAST` carries over the others.
 *
 * EVERY ONE OF THE FOUR IS MEASURED NOW, NOT JUDGED BY EYE, against the widest
 * string its column can hold — `100%`, `-100.0`, `+100 pts`, `+999%` — in the
 * face that sets them (Inter, whose `%` is a full em, wider than SF's). They
 * were all short by a tenth to a quarter of their contents, and `npm run check`
 * holds them to it now. The label takes the slack, as it always has.
 */
const W_LAST = 3.9;
const W_AVG = 3.5;
const W_DELTA = 4.55;
const W_RATIO = 3.25;
/** and how wide one of the players table's five stacked cells is. */
const W_CELL = 3.2;

function HeadCell({ label, w, fs }: { label: string; w: number; fs: number }) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        width: fs * w,
        flexGrow: 0,
        flexShrink: 0,
        textAlign: 'right',
        ...fUi(500),
        fontSize: fs * 0.82,
        letterSpacing: ls(fs * 0.82, LS_MICRO),
        color: t.ink3,
      }}
    >
      {label}
    </Text>
  );
}

/**
 * ONE ROW.
 *
 * The CHANGE is two cells rather than one string, for the same reason the
 * shelf's dash is its own cell: `+3.6` and `+29%` are two readings of one move
 * and they have to line up down the table independently, or a row whose
 * average was zero — no percentage at all — would pull its delta out of the
 * column every other row shares.
 *
 * THE COLOUR IS ON THE CHANGE AND NOWHERE ELSE. The last game's figure and the
 * average are facts and are printed as facts; only the move between them has a
 * direction, and only the direction has a hue. `good` and `danger` are a PAIR
 * here and are chosen by `row.better`, which already knows that a turnover
 * going up is not the same news as a rebound going up.
 */
function CompareLine({ row, first }: { row: CompareRow; first: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const fs = m.fsSm;

  const tone = row.better === null ? t.ink3 : row.better ? t.good : t.danger;

  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s3,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.rule,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          ...fUi(500),
          fontSize: fs,
          letterSpacing: ls(fs, LS_LABEL),
          color: t.ink2,
        }}
      >
        {row.label}
      </Text>

      {/* the SUBJECT is what the table is about, so it is the one figure set
          at full ink and the heavier step */}
      <Text
        numberOfLines={1}
        style={{
          width: fs * W_LAST,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(700),
          fontSize: m.fsMd,
          letterSpacing: ls(m.fsMd, LS_TIGHT),
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {figure(row, row.subject)}
      </Text>

      <Text
        numberOfLines={1}
        style={{
          width: fs * W_AVG,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(500),
          fontSize: fs,
          color: t.ink3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {figure(row, row.base)}
      </Text>

      <Text
        numberOfLines={1}
        style={{
          width: fs * W_DELTA,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(600),
          fontSize: fs,
          color: tone,
          fontVariant: ['tabular-nums'],
        }}
      >
        {deltaLabel(row)}
      </Text>

      <Text
        numberOfLines={1}
        style={{
          width: fs * W_RATIO,
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(500),
          fontSize: fs * 0.86,
          color: tone,
          fontVariant: ['tabular-nums'],
        }}
      >
        {ratioLabel(row)}
      </Text>
    </Row>
  );
}

/**
 * ONE GROUP'S TABLE — a caption row, its rows, and the note when there is one.
 *
 * IT DRAWS ROWS AND NOT A `Comparison`, because the comparison page draws
 * EIGHT of these and a player's card draws one. What the table is about is the
 * two column heads: the subject is always `Game`, and the baseline names
 * itself — `Avg` when it is every other official game, a date when it is one
 * of them.
 *
 * THE NOTE IS NOT DECORATION and must not be dropped where it belongs: the
 * baseline is pooled on every rate row and meaned on every count, and a reader
 * who assumes one rule for the whole column will read half the table wrong. It
 * is the same argument as the stats screen's note under POINTS FROM TURNOVERS.
 * It is passed in rather than built here because it is printed ONCE on a page
 * of eight tables — under the shooting block, which is where pooling is the
 * difference between two different numbers.
 */
export function CompareTable({
  rows,
  base,
  note,
}: {
  rows: CompareRow[];
  /** the baseline column's head — `Avg`, or the date of one game */
  base: string;
  note?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const fs = m.fsSm;

  return (
    <Col>
      <Row gap={m.s2} style={{ paddingBottom: m.s2 }}>
        <View style={{ flex: 1, minWidth: 0 }} />
        <HeadCell label="Game" w={W_LAST} fs={fs} />
        <HeadCell label={base} w={W_AVG} fs={fs} />
        <HeadCell label="Change" w={W_DELTA} fs={fs} />
        <View style={{ width: fs * W_RATIO, flexGrow: 0, flexShrink: 0 }} />
      </Row>

      {rows.map((row, i) => (
        <CompareLine key={row.key} row={row} first={i === 0} />
      ))}

      {/* `fsXs` and not the step under it: the small step is for strings that
          are not read at arm's length, and this one is the sentence that keeps
          the column above it honest. */}
      {!!note && (
        <Text
          style={{
            paddingTop: m.s3,
            ...fUi(400),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            lineHeight: m.fsXs * 1.45,
            color: t.ink3,
          }}
        >
          {note}
        </Text>
      )}
    </Col>
  );
}

/**
 * WHO PLAYED ABOVE OR BELOW THEIR OWN NORMAL — five figures per name, each
 * with the move under it.
 *
 * IT IS NOT THE TABLE ABOVE, and it could not be: that one is one stat read
 * three ways down a column, and this is five stats read for ten people. So the
 * two readings are STACKED inside the cell instead of set side by side — the
 * figure at full ink over its own change, two weights apart, which is the same
 * value-over-caption pair the stats screen's tiles use. It is the only way
 * fifty numbers fit across a phone without a horizontal scroll.
 *
 * THE COLOUR IS ON THE CHANGE AND NOWHERE ELSE, exactly as it is in
 * `CompareLine`. A player who has played no other game gets dashes rather than
 * no row: `lib/analysis.ts` keeps them, and dropping them here would put a
 * name in the box score that this table cannot account for.
 */
export function PlayerImpact({ rows }: { rows: ImpactRow[] }) {
  const m = useMetrics();
  const t = useTheme();

  if (rows.length === 0) {
    return (
      <Text
        style={{
          ...fUi(400),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink3,
        }}
      >
        Nobody played a minute in this game.
      </Text>
    );
  }

  const codes = rows[0].cells.map((c) => c.code);

  return (
    <Col>
      <Row gap={m.s2} style={{ paddingBottom: m.s2 }}>
        <View style={{ flex: 1, minWidth: 0 }} />
        {codes.map((code) => (
          <Text
            key={code}
            numberOfLines={1}
            style={{
              width: m.fsSm * W_CELL,
              flexGrow: 0,
              flexShrink: 0,
              textAlign: 'right',
              ...fUi(500),
              fontSize: m.fsSm * 0.82,
              letterSpacing: ls(m.fsSm * 0.82, LS_CAPS),
              color: t.ink3,
            }}
          >
            {code}
          </Text>
        ))}
      </Row>

      {rows.map((r, i) => (
        <Row
          key={r.id}
          gap={m.s2}
          align="flex-start"
          style={{
            paddingVertical: m.s3,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: t.rule,
          }}
        >
          <Row gap={m.s2} style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                flexGrow: 0,
                flexShrink: 0,
                ...fNum(600),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_TIGHT),
                color: t.ink3,
                fontVariant: ['tabular-nums'],
              }}
            >
              {r.number}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                minWidth: 0,
                ...fUi(500),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                color: t.ink,
              }}
            >
              {r.name}
            </Text>
          </Row>

          {r.cells.map((c) => (
            <ImpactCell key={c.key} cell={c} />
          ))}
        </Row>
      ))}
    </Col>
  );
}

/** A figure over the move that made it — the only cell on the page with two. */
function ImpactCell({ cell }: { cell: CompareRow }) {
  const m = useMetrics();
  const t = useTheme();
  const tone = cell.better === null ? t.ink3 : cell.better ? t.good : t.danger;

  return (
    <Col
      gap={2}
      style={{ width: m.fsSm * W_CELL, flexGrow: 0, flexShrink: 0 }}
    >
      <Text
        numberOfLines={1}
        style={{
          textAlign: 'right',
          ...fNum(700),
          fontSize: m.fsMd,
          letterSpacing: ls(m.fsMd, LS_TIGHT),
          color: t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {figure(cell, cell.subject)}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          textAlign: 'right',
          ...fNum(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: tone,
          fontVariant: ['tabular-nums'],
        }}
      >
        {deltaLabel(cell)}
      </Text>
    </Col>
  );
}

/**
 * WHAT CHANGED — at most three, biggest relative move first.
 *
 * A row and not a card each: these are three sentences, and three boxes around
 * three sentences is the structure this screen was rebuilt to get rid of. The
 * arrow says which way the FIGURE went and the colour says whether that was
 * good news, which are two different questions on the turnover line and the
 * one place this component earns both.
 */
export function WhatChanged({ highlights }: { highlights: Highlight[] }) {
  const m = useMetrics();
  const t = useTheme();

  if (highlights.length === 0) {
    return (
      <Text
        style={{
          ...fUi(400),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink3,
        }}
      >
        Nothing moved far enough from the average to call it a change.
      </Text>
    );
  }

  return (
    <Col>
      {highlights.map((h, i) => {
        const tone = h.better ? t.good : t.danger;
        return (
          <Row
            key={h.key}
            gap={m.s2}
            style={{
              paddingVertical: m.s3,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.rule,
            }}
          >
            <MaterialCommunityIcons
              name={h.rose ? 'arrow-up' : 'arrow-down'}
              size={m.fsMd}
              color={tone}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                ...fUi(600),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                color: t.ink,
              }}
            >
              {h.label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flexGrow: 0,
                flexShrink: 0,
                ...fNum(600),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_CAPS),
                color: tone,
                fontVariant: ['tabular-nums'],
              }}
            >
              {h.detail}
            </Text>
          </Row>
        );
      })}
    </Col>
  );
}

/**
 * AFTER TIMEOUTS — three lines and the sentence that makes them readable.
 *
 * It is a LIST and not the table above it, because it is not the same shape of
 * answer: the table is six stats against a window of games, and this is one
 * number about one game, read twice. Two figures and the move between them fit
 * on three rows with their own captions, and captions are the half that does
 * the work here — a rate per minute means nothing without the minutes it was
 * measured over.
 *
 * THE COLOUR IS ON THE CHANGE AND NOWHERE ELSE, exactly as it is in
 * `CompareLine`: the two rates are facts, and only the move between them has a
 * direction. A rise is good news with no polarity to look up — the measure is
 * net points, so up is always the right way.
 */
export function AfterTimeouts({ run, timeouts }: { run: TimeoutRun | null; timeouts: number }) {
  const m = useMetrics();
  const t = useTheme();

  if (!run || run.after === null || run.rest === null) {
    return (
      <Text
        style={{
          ...fUi(400),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          lineHeight: m.fsSm * 1.45,
          color: t.ink3,
        }}
      >
        {timeouts > 0
          ? 'This game counted its timeouts before the board marked when they were called, so there is nothing to compare.'
          : 'No timeouts were called in this game.'}
      </Text>
    );
  }

  const tone = run.better === null ? t.ink3 : run.better ? t.good : t.danger;
  const n = run.count;

  return (
    <Col>
      <EffectLine
        label="After a timeout"
        caption={`${n} timeout${n === 1 ? '' : 's'} · ${mmss(run.afterSeconds)} of clock · ${run.afterUs}–${run.afterThem}`}
        value={netLabel(run.after)}
        colour={t.ink}
        first
      />
      <EffectLine
        label="Rest of the game"
        caption={`${mmss(run.restSeconds)} of clock · ${run.restUs}–${run.restThem}`}
        value={netLabel(run.rest)}
        colour={t.ink3}
      />
      <EffectLine
        label="Change"
        caption={
          run.better === null
            ? 'The same either side of a huddle'
            : run.better
              ? 'Better after the huddle'
              : 'Worse after the huddle'
        }
        value={netLabel(run.delta)}
        colour={tone}
      />

      <Text
        style={{
          paddingTop: m.s3,
          ...fUi(400),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          lineHeight: m.fsXs * 1.45,
          color: t.ink3,
        }}
      >
        Net points per minute — ours minus theirs — over the two minutes of game
        clock after each timeout, against every other minute of the game. A
        window stops at its own period's buzzer, and two timeouts close together
        count their shared minutes once.
      </Text>
    </Col>
  );
}

/** One row of the block above: a name, what it was measured over, a rate. */
function EffectLine({
  label,
  caption,
  value,
  colour,
  first,
}: {
  label: string;
  caption: string;
  value: string;
  colour: string;
  first?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s3,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.rule,
      }}
    >
      <Col style={{ flex: 1, minWidth: 0 }} gap={2}>
        <Text
          numberOfLines={1}
          style={{
            ...fUi(500),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.ink2,
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            ...fUi(400),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink3,
          }}
        >
          {caption}
        </Text>
      </Col>

      <Text
        numberOfLines={1}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          textAlign: 'right',
          ...fNum(700),
          fontSize: m.fsMd,
          letterSpacing: ls(m.fsMd, LS_TIGHT),
          color: colour,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          flexGrow: 0,
          flexShrink: 0,
          ...fUi(400),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: t.ink3,
        }}
      >
        /min
      </Text>
    </Row>
  );
}
