import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Seg, Section, type SegItem } from '../components/stats/parts';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { chunk } from '../lib/grid';
import { useGameStore } from '../store/gameStore';
import { useMetrics } from '../theme/metrics';
import {
  DOT_HUES,
  DOT_LABEL,
  LS_LABEL,
  LS_TITLE,
  dotColor,
  fUi,
  ls,
  type DotHue,
} from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import {
  BOARD_CHOICES,
  LABEL_CHOICES,
  LENGTH_CHOICES,
  PERIOD_CHOICES,
  POSS_CHOICES,
} from '../constants/options';

/**
 * GAME SETTINGS — the switches, on a screen of their own.
 *
 * IT WAS A PANEL AND IT IS A PAGE, and the move is the whole of why this file
 * exists. `SettingsPanel` was a `center` dialog reached from a gear in the
 * lobby's top-right corner: a modal the width of a phone, holding a stack of
 * segmented controls with a paragraph under each one, over a screen it had
 * nothing to do with. Every panel in this app is ONE decision made with the
 * game in front of you — which foul, which rebound, which five. A list of
 * preferences is not that: it is read, compared and scrolled, which is a page.
 *
 * SO THE GEAR IS GONE TOO. It was a glyph in a circle that named nothing, in
 * the corner of the one screen whose top row is the club's own identity, and
 * what it opened is now a named verb at the foot of the same screen, directly
 * under NEW GAME. A scorer looking for the settings reads the word.
 *
 * IT IS DARK, LIKE THE ROOM IT IS REACHED FROM. Same `DarkRoom` as `start` and
 * a player's own page — the three pushed pages that belong with the four tabs
 * rather than with the board. Nothing on it needed a colour changed: every
 * value here is a token, so `Section`, `Card` and `Seg` followed on their own.
 *
 * FOUR BLOCKS, AND THE ORDER IS HOW OFTEN A SCORER TOUCHES THEM: the rules of
 * the game first, because they are the only two here that are set per season
 * rather than once; then what a stat is called; then the chart's three marks;
 * then the board's own behaviour, which most scorers set once on the first
 * night and never open again.
 */

/** The same cap the lobby and the team tab draw: a settings row a foot across
 *  on a tablet is a row nobody can pair with the label above it. */
const TWO_UP = 700;

/* ---- the pieces ---------------------------------------------------- */

/**
 * A LABEL, A CONTROL AND A LINE OF PROSE, which is what every row on this
 * screen is. It is module-level for the reason every piece in this app is: a
 * component declared inside the screen is a new type on every render.
 */
function OptionRow<T extends string | number>({
  title,
  items,
  value,
  onChange,
  first = false,
}: {
  title: string;
  items: SegItem<T>[];
  value: T;
  onChange(key: T): void;
  /** the first row in a card owns no seam — the card's own edge is there */
  first?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Col
      gap={m.s2}
      style={{
        padding: m.s3,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.rule,
      }}
    >
      <Text
        style={{
          ...fUi(600),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink2,
        }}
      >
        {title}
      </Text>

      <Seg items={items} value={value} onChange={onChange} />

      <Text
        style={{
          ...fUi(400),
          fontSize: m.fsXs,
          lineHeight: m.fsXs * 1.5,
          color: t.ink3,
        }}
      >
      </Text>
    </Col>
  );
}

/**
 * THE EIGHT HUES, ON A FLOOR.
 *
 * The swatches are drawn over `t.court` rather than over the card, and that is
 * the point of them: a dot is only ever read on a basketball court, and a
 * colour that reads on a card can vanish on the floor. It previews this
 * palette's court, which is the dark one — the board's floor is lighter, and
 * `NEUTRAL` is the one swatch that differs between the two, because it IS the
 * palette's own `markMiss`.
 *
 * FOUR ACROSS, TWO DOWN, rather than eight in a wrapping row. Eight tap-sized
 * cells do not fit a 360pt phone, and a row that wraps 7 + 1 is a row that
 * looks broken; four and four is the same grid on every screen this runs on and
 * leaves every cell comfortably over `m.tap`.
 *
 * The selected one is a 2px `ink` frame, not a fill: a fill behind a colour
 * swatch changes the colour being previewed, which is the one thing this
 * control must not do.
 */
function Swatches({
  label,
  value,
  onChange,
  first = false,
}: {
  label: string;
  value: DotHue;
  onChange(hue: DotHue): void;
  /** the first block in a card owns no seam — the card's own edge is there */
  first?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();
  const rows = chunk([...DOT_HUES], 4);
  const size = Math.round(m.fsLg);

  return (
    <Col
      gap={m.s2}
      style={{ padding: m.s3, borderTopWidth: first ? 0 : 1, borderTopColor: t.rule }}
    >
      <Row gap={m.s2}>
        <Text
          style={{
            ...fUi(600),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.ink2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            marginLeft: 'auto',
            ...fUi(500),
            fontSize: m.fsXs,
            color: t.ink3,
          }}
        >
          {DOT_LABEL[value]}
        </Text>
      </Row>

      {rows.map((row, i) => (
        <Row key={i} gap={m.s2} align="stretch">
          {row.map((hue) => {
            const on = hue === value;
            return (
              <Press
                key={hue}
                onPress={() => onChange(hue)}
                accessibilityLabel={`${label}: ${DOT_LABEL[hue]}`}
                style={{
                  flex: 1,
                  minHeight: m.tap,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: m.rSm,
                  borderWidth: 2,
                  borderColor: on ? t.ink : t.rule,
                  backgroundColor: t.court,
                }}
                pressedStyle={{ opacity: 0.6 }}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    flexShrink: 0,
                    borderRadius: size / 2,
                    backgroundColor: dotColor(hue, t),
                  }}
                />
              </Press>
            );
          })}
        </Row>
      ))}
    </Col>
  );
}

/* ---- the answers --------------------------------------------------- */

/**
 * THE FOUR TABLES ARE IN `constants/options.ts` NOW, because the door draws
 * two of them as well — see the note there. Nothing about them changed; they
 * simply stopped being this screen's private copy.
 */

/* ---- the screen ---------------------------------------------------- */

function SettingsScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const options = useGameStore((s) => s.options);
  const setOption = useGameStore((s) => s.setOption);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* outside the padded view below, so it runs under the safe-area inset */}
      <Bloom />

      <View
        style={{
          flex: 1,
          paddingTop: safe.top + m.s2,
          paddingBottom: safe.bottom + m.s3,
          paddingLeft: safe.left + m.s4,
          paddingRight: safe.right + m.s4,
        }}
      >
        {/* pushed, not a tab root, so it owns its way out — the same arrow the
            new-game picker and a player's page draw */}
        <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
          <Press
            onPress={() => router.back()}
            accessibilityLabel="back"
            style={{
              flexGrow: 0,
              flexShrink: 0,
              width: m.tap,
              minHeight: m.tap,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -m.s2,
              borderRadius: m.rSm,
            }}
            pressedStyle={{ backgroundColor: t.surface2 }}
          >
            <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
              <Path
                d="M15 5l-7 7 7 7"
                stroke={t.ink}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Press>

          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              ...fUi(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_TITLE),
              color: t.ink,
            }}
          >
            Settings
          </Text>
        </Row>

        <ScrollView
          style={{ flex: 1, marginTop: m.s3 }}
          contentContainerStyle={{ paddingBottom: m.s5, alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <Col style={{ width: '100%', maxWidth: TWO_UP }}>
            {/* ── THE RULES ── the two that are stamped onto a game rather than
                read live. The note says so out loud, because a setting that
                does nothing until the next tip-off is otherwise a setting the
                scorer thinks is broken. */}
            <Section title="The game">
              <OptionRow
                first
                title="Periods"
                items={[...PERIOD_CHOICES]}
                value={options.periods}
                onChange={(k) => setOption('periods', k)}
              />
              <OptionRow
                title="Minutes per period"
                items={[...LENGTH_CHOICES]}
                value={options.periodLen}
                onChange={(k) => setOption('periodLen', k)}
              />
            </Section>

            {/* ── WHAT A STAT IS CALLED ── the panels only; see `lib/labels.ts` */}
            <Section title="Stat names">
              <OptionRow
                first
                title="On the panels"
                items={[...LABEL_CHOICES]}
                value={options.labels}
                onChange={(k) => setOption('labels', k)}
              />
            </Section>

            {/* ── THE THREE MARKS ── every chart in the app draws these, and
                they are the one part of the palette a scorer may move */}
            <Section title="The chart" note="">
              <Col>
                <Swatches
                  first
                  label="Made shot"
                  value={options.dotMade}
                  onChange={(h) => setOption('dotMade', h)}
                />
                <Swatches
                  label="Missed shot"
                  value={options.dotMiss}
                  onChange={(h) => setOption('dotMiss', h)}
                />
                <Swatches
                  label="Free throws"
                  value={options.dotFt}
                  onChange={(h) => setOption('dotFt', h)}
                />
              </Col>
            </Section>

            {/* ── THE BOARD'S OWN BEHAVIOUR ── set once on the first night, and
                last on the screen for exactly that reason */}
            <Section title="The board">
              <OptionRow
                first
                title="Background"
                items={[...BOARD_CHOICES]}
                value={options.board}
                onChange={(k) => setOption('board', k)}
              />
              {/* THE FOURTH FOOTER CELL, WHOLE OR IN HALVES. The timeout count
                  is not a choice — every game has them — so the switch is
                  named after what it ADDS, and adding it splits the cell
                  rather than replacing anything. Read live: a game already on
                  the board shows the count it already has. */}
              <OptionRow
                title="Possession index"
                items={[...POSS_CHOICES]}
                value={options.poss}
                onChange={(k) => setOption('poss', k)}
              />
            </Section>
          </Col>
        </ScrollView>
      </View>
    </View>
  );
}

export default function Settings() {
  return (
    <DarkRoom>
      <SettingsScreen />
    </DarkRoom>
  );
}
