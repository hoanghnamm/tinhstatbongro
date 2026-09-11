import { Text, View, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { GlowText } from '../ui/GlowText';
import { Press } from '../ui/Press';
import { Col, Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * WHICH GAME, AND AGAINST WHAT — the two controls the comparison is built on.
 *
 * THEY DRAW THE GAME RATHER THAN DESCRIBING IT, which is the same call the two
 * board confirms make with `PSubject`: what is at stake is a GAME, and this app
 * already has a way of printing one — a name, a muted tail, and a score with
 * OURS in accent, which is the MATCHES row exactly. A field that read
 * `Game 3 of 12` would be a sentence about a row the reader can already see.
 *
 * THERE IS NO PANEL BEHIND THEM. The STATS tab this page is opened from mounts
 * no `<PanelHost />` at all, and a modal system added to that room for one
 * screen would be a second one to keep in step with the board's. So choosing is
 * a STATE of this page: the field opens, the blocks below it stand down, and
 * the list is the page until something is picked. A list of thirty games is
 * what the room is for.
 */

/** A caret, pointing down when the list is shut and up when it is open. */
function Caret({ open }: { open: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
      <Path
        d={open ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'}
        stroke={t.ink3}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * OUR SCORE AND THEIRS, ours in accent — the shelf's own split, one step down.
 *
 * Two figures beside a dash need one of them marked or the reader has to
 * remember which end they are, and the dash is its own cell because an em dash
 * set inline draws a rule as long as the digits are tall.
 */
function Score({ us, them }: { us: number; them: number }) {
  const m = useMetrics();
  const t = useTheme();
  const figure: TextStyle = {
    ...fNum(700),
    fontSize: m.fsLg,
    letterSpacing: ls(m.fsLg, LS_TIGHT),
    fontVariant: ['tabular-nums'],
  };
  return (
    <Row gap={m.s1} style={{ flexGrow: 0, flexShrink: 0 }}>
      <GlowText style={{ ...figure, color: t.accent }}>{String(us)}</GlowText>
      <Text style={{ ...fNum(500), fontSize: m.fsXs, color: t.ink3 }}>—</Text>
      <Text style={{ ...figure, color: t.ink }}>{String(them)}</Text>
    </Row>
  );
}

export interface Subject {
  /** who or what — `vs Wolves`, `Team average` */
  line: string;
  /** the muted half of the same line: a competition, a date, a count of games */
  tail?: string;
  /** the one letter the shelf rides on its date line — `W`, `L` */
  mark?: 'W' | 'L' | null;
  /** a game's score; absent on the average, which has no scoreline */
  us?: number;
  them?: number;
}

/** The line and the tail, and the letter that rides at the end of it. */
function Titles({ subject, tone }: { subject: Subject; tone: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Col style={{ flex: 1, minWidth: 0 }} gap={2}>
      <Text
        numberOfLines={1}
        style={{
          ...fUi(600),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: tone,
        }}
      >
        {subject.line}
      </Text>
      <Row gap={m.s2} style={{ minWidth: 0 }}>
        {!!subject.tail && (
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              minWidth: 0,
              ...fUi(400),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.ink3,
            }}
          >
            {subject.tail}
          </Text>
        )}
        {!!subject.mark && (
          <Text
            style={{
              flexGrow: 0,
              flexShrink: 0,
              ...fNum(700),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_CAPS),
              color: subject.mark === 'W' ? t.accent : t.danger,
            }}
          >
            {subject.mark}
          </Text>
        )}
      </Row>
    </Col>
  );
}

/**
 * ONE OF THE TWO FIELDS — a label, the game it holds, and a caret.
 *
 * The label is a fixed cell rather than a caption above the value, so the two
 * fields line up down their own column and the eye reads GAME / AGAINST as a
 * pair. It is the one place on this page a word is set in caps, and it is
 * there for the same reason every other abbreviation on the board is.
 */
export function PickField({
  label,
  subject,
  open,
  onPress,
}: {
  label: string;
  subject: Subject;
  open: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${label}: ${subject.line}${subject.tail ? `, ${subject.tail}` : ''}. Change`}
      style={{
        borderWidth: 1,
        borderColor: open ? t.accent : t.rule,
        borderRadius: m.r,
        paddingVertical: m.s3,
        paddingHorizontal: m.s3,
        minHeight: m.tap,
        justifyContent: 'center',
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Row gap={m.s3}>
        <Text
          numberOfLines={1}
          style={{
            width: m.fsSm * 4.4,
            flexGrow: 0,
            flexShrink: 0,
            ...fUi(500),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_CAPS),
            color: t.ink3,
          }}
        >
          {label}
        </Text>
        <Titles subject={subject} tone={t.ink} />
        {subject.us !== undefined && subject.them !== undefined && (
          <Score us={subject.us} them={subject.them} />
        )}
        <Caret open={open} />
      </Row>
    </Press>
  );
}

/**
 * ONE ROW OF AN OPEN LIST.
 *
 * WHAT MARKS THE CHOSEN ONE IS INK, not a fill: the row is already a game
 * drawn the shelf's way, and a filled band behind one of them would be the only
 * slab on a page made entirely of type and hairlines. The 1px rule above each
 * row is the same seam the shelf's separator is.
 */
export function PickOption({
  subject,
  on,
  first,
  onPress,
}: {
  subject: Subject;
  on: boolean;
  first: boolean;
  onPress(): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${subject.line}${subject.tail ? `, ${subject.tail}` : ''}${on ? ', chosen' : ''}`}
      style={{
        paddingVertical: m.s3,
        minHeight: m.tap,
        justifyContent: 'center',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.rule,
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Row gap={m.s3}>
        <Titles subject={subject} tone={on ? t.accent : t.ink} />
        {subject.us !== undefined && subject.them !== undefined && (
          <Score us={subject.us} them={subject.them} />
        )}
        {/* the tick keeps its cell whether it is drawn or not, so nothing on
            the row moves when the choice moves */}
        <View style={{ width: m.fsMd, height: m.fsMd, flexGrow: 0, flexShrink: 0 }}>
          {on && (
            <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
              <Path
                d="M5 13l4 4 10-10"
                stroke={t.accent}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </View>
      </Row>
    </Press>
  );
}
