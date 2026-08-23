import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { Press } from '../ui/Press';
import { Col, Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import {
  ELEV_CARD,
  LS_BTN,
  LS_LABEL,
  LS_MICRO,
  LS_TIGHT,
  fNum,
  fUi,
  isTranslucent,
  ls,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * The stats screen's furniture.
 *
 * It is built out of the same two ideas the board is: a card is an opaque
 * surface inside a 1px rule, and a run of cells is a rule-coloured parent
 * showing through 1px seams — so the cells must be opaque and carry no border
 * and no radius of their own, or the seam disappears.
 *
 * Every one of these is module-level rather than declared inside a screen: a
 * component declared in a render is a new type on every render, and this screen
 * re-renders whenever the quarter filter moves.
 */

/**
 * `key` is widened to a NUMBER as well as a string because two of the settings
 * are numbers — how many periods a game is and how long one of them is — and a
 * `String(4)` round trip at every call site is a second representation of the
 * same answer, which is the thing that goes wrong. React takes a number as a
 * key, and `===` on two numbers is the same comparison it always was.
 */
export interface SegItem<T extends string | number> {
  key: T;
  label: string;
}

/**
 * The one control this screen has. Both bars are this: the quarter filter and
 * the tab strip ask the same question — which slice of one game am I looking
 * at — so they are one control used twice rather than two that drift apart.
 *
 * The selected cell is an inverted surface, so it carries BOTH halves of the
 * pair: `accent` under `accentInk`. Keeping the ink and losing the fill is how
 * a selected tab turns into an invisible slab.
 */
export function Seg<T extends string | number>({
  items,
  value,
  onChange,
}: {
  items: SegItem<T>[];
  value: T;
  onChange(key: T): void;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Row
      align="stretch"
      gap={1}
      style={{
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: t.rule,
        borderRadius: m.rSm,
        overflow: 'hidden',
      }}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Press
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityLabel={it.label}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: m.tap,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: m.s2,
              backgroundColor: on ? t.accent : t.surface,
            }}
            pressedStyle={on ? undefined : { backgroundColor: t.surface2 }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...fUi(on ? 600 : 500),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                color: on ? t.accentInk : t.ink2,
              }}
            >
              {it.label}
            </Text>
          </Press>
        );
      })}
    </Row>
  );
}

/** A titled block. The title sits OUTSIDE the card, the way the board's do. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Col gap={m.s2} style={{ marginBottom: m.spLg }}>
      <Row gap={m.s2}>
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
        {!!note && (
          <Text
            numberOfLines={1}
            style={{
              marginLeft: 'auto',
              flexShrink: 1,
              ...fUi(500),
              fontSize: m.fsXs,
              color: t.ink3,
            }}
          >
            {note}
          </Text>
        )}
      </Row>
      <Card>{children}</Card>
    </Col>
  );
}

/**
 * A card's caption strip: a label, and optionally something small pinned to the
 * far edge — a clock, a date, a count. It is the same construction as `Line`'s
 * header row and is here for the same reason `Card` is: the lobby, the saved
 * games and the stats screen all draw one, and a second copy is the one that
 * would drift a pixel.
 */
export function Band({
  label,
  note,
  tone,
}: {
  label: string;
  note?: ReactNode;
  /** ink only — the band keeps its `surface2`, or it eats the seam under it */
  tone?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        backgroundColor: t.surface2,
        borderBottomWidth: 1,
        borderBottomColor: t.rule,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          ...fUi(tone ? 600 : 500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: tone ?? t.ink2,
        }}
      >
        {label}
      </Text>
      {!!note && <View style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>{note}</View>}
    </Row>
  );
}

/**
 * A card, and it FLOATS — two views, not one, and the split is the point.
 *
 * The shadow and the clip cannot sit on the same view: `overflow:'hidden'` is
 * `clipsToBounds` on iOS, and a card that clips its own children to the corner
 * radius will clip its own shadow with them. So the OUTER view carries the fill,
 * the radius and the elevation, and the INNER one carries the same radius plus
 * the clip that keeps a `Band` or a `Seam` from squaring off the corners.
 *
 * The hairline stays under the shadow rather than being replaced by it. The
 * canvas is a warm off-white and the card is pure white — a hair apart — so the
 * shadow reads as lift and the rule is still what draws the actual edge.
 */
export function Card({ children, glass = false }: { children: ReactNode; glass?: boolean }) {
  const m = useMetrics();
  const t = useTheme();

  // GLASS IS OPT-IN, and its callers are the cards that sit UNDER THE BLOOM —
  // the lobby's, which is where the gradient is strongest and where a blur
  // therefore has something worth sampling. Everywhere else this stays the
  // opaque surface it has always been: a frosted card over a flat canvas is a
  // flat card that costs a render pass, and on the board it would be contrast
  // spent on decoration. Do not pass it from a light screen.
  const inner = {
    borderWidth: 1,
    borderColor: glass ? 'rgba(255,255,255,0.12)' : t.rule,
    borderRadius: m.r,
    overflow: 'hidden' as const,
  };

  return (
    <View
      style={{
        borderRadius: m.r,
        // the shadow needs an opaque ground on Android, and a glass card has
        // none — so the wrapper carries the fill even when the blur is what is
        // actually seen. Under the blur it reads as the tint it is sampling.
        //
        // ON A TRANSLUCENT PALETTE IT CARRIES NOTHING, and that is the third
        // case rather than an omission: painting `surface` here and again on
        // the inner view composites a 5% white over a 5% white, so the card
        // comes out a step lighter than the token says AND blocks the bloom it
        // is meant to sit in. What is lost with the fill is Android's
        // `elevation`, which on near-black is a shadow nobody can see anyway.
        backgroundColor:
          glass ? 'rgba(10,7,5,0.35)' : isTranslucent(t) ? 'transparent' : t.surface,
        ...ELEV_CARD,
      }}
    >
      {glass ? (
        <BlurView intensity={28} tint="dark" style={inner}>
          {children}
        </BlurView>
      ) : (
        <View style={{ ...inner, backgroundColor: t.surface }}>{children}</View>
      )}
    </View>
  );
}

/**
 * One stat: a name, its number, and an optional second number under the same
 * roof — a percentage beside a made-attempted, a caption beside a count. The
 * two value columns are fixed widths so every row in a card lines up, and both
 * are tabular so nothing shifts as the game goes on.
 */
export function Line({
  label,
  value,
  sub,
  tone,
  strong = false,
  head = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** ink only — the row keeps its surface, or it eats the seam above it */
  tone?: string;
  strong?: boolean;
  /**
   * The card's caption band. It is this component rather than one of its own
   * so the three columns cannot drift: a header whose widths are written out a
   * second time lines up until the first time one of them is edited.
   */
  head?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        borderTopWidth: head ? 0 : 1,
        borderTopColor: t.rule,
        borderBottomWidth: head ? 1 : 0,
        borderBottomColor: t.rule,
        backgroundColor: head || strong ? t.surface2 : t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          ...(head ? fUi(500) : fUi(strong ? 600 : 400)),
          fontSize: head ? m.fsXs : m.fsSm,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: head ? t.ink2 : t.ink,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          minWidth: m.fsSm * 4.4,
          textAlign: 'right',
          ...(head ? fNum(500) : fNum(700)),
          fontSize: head ? m.fsXs : m.fsMd,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: head ? t.ink2 : (tone ?? t.ink),
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          width: m.fsSm * 3.6,
          textAlign: 'right',
          ...fNum(500),
          fontSize: head ? m.fsXs : m.fsSm,
          letterSpacing: head ? ls(m.fsXs, LS_MICRO) : 0,
          color: t.ink2,
          fontVariant: ['tabular-nums'],
        }}
      >
        {sub ?? ''}
      </Text>
    </Row>
  );
}

/** A run of cells with the seam showing between them. */
export function Seam({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Row align="stretch" gap={1} style={{ backgroundColor: t.rule }}>
      {children}
    </Row>
  );
}

/** A headline number over its name. Opaque, edgeless — it lives in a Seam. */
export function Tile({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        paddingVertical: m.s3,
        paddingHorizontal: m.s1,
        backgroundColor: t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          ...fNum(700),
          fontSize: m.fsXl,
          letterSpacing: ls(m.fsXl, LS_TIGHT),
          lineHeight: m.fsXl * 1.1,
          color: tone ?? t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          // the light half of the pair — see the lobby's own `Stat` cell
          ...fUi(400),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** The small print under stats. Hidden as requested. */
export function Note(_props: { children: ReactNode }) {
  return null;
}

/** Nothing logged in this slice — said once, in the body, not as a blank card. */
export function Empty({ children }: { children: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      style={{
        paddingVertical: m.s6,
        textAlign: 'center',
        ...fUi(500),
        fontSize: m.fsMd,
        letterSpacing: ls(m.fsMd, LS_BTN),
        color: t.ink3,
      }}
    >
      {children}
    </Text>
  );
}

/** A key for a chart: a dot, then what it means. */
export function Key({ color, label, ring = false }: { color: string; label: string; ring?: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const d = Math.round(m.fsSm * 0.8);
  return (
    <Row gap={m.s2} style={{ flexGrow: 0, flexShrink: 0 }}>
      <View
        style={{
          width: d,
          height: d,
          flexGrow: 0,
          flexShrink: 0,
          borderRadius: d,
          borderWidth: ring ? 1 : 0,
          borderColor: t.ink3,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          ...fUi(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
    </Row>
  );
}
