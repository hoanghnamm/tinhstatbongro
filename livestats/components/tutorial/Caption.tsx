import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TUTORIAL_COPY } from '../../constants/tutorial';
import { useMetrics } from '../../theme/metrics';
import {
  DARK,
  ELEV_PANEL,
  LS_BTN,
  LS_LABEL,
  LS_MICRO,
  LS_TITLE,
  fUi,
  isTranslucent,
  ls,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Col, Row } from '../ui/Row';
import type { Rect } from '../../store/layoutStore';

/** The card's own measure, the gutter it keeps off every edge, and its floor. */
const CARD_MAX = 380;
const GUTTER = 12;
/**
 * Narrower than this and a card is two words a line. It is the gate on docking
 * SIDEWAYS: the vertical sides can always be as wide as the window, so only a
 * left or a right placement can be refused for want of room.
 */
const CARD_MIN = 220;

/**
 * WHERE THE CARD GOES, AND IT IS DECIDED EVERY FRAME.
 *
 * "The opposite side of the screen from the target" is four possible sides, not
 * two, and which one is right depends on a board that has two layouts and an
 * action column that can be on either edge. So it is measured rather than
 * chosen: the side with the most room left over is the side the card takes.
 *
 * A LANDSCAPE PHONE IS WHY THIS IS NOT SIMPLY "ABOVE OR BELOW". The board is
 * landscape-only on anything narrower than 700 (see `RotateGate`), so on most
 * phones running this tour the screen is about 360 points tall — and the
 * vertical room is the room there is least of. On a tablet in portrait it is
 * the other way round.
 *
 * BUT A SIDE IS ONLY TAKEN IF IT CAN HOLD A CARD. The widest gap beside a
 * spotlit court on a landscape phone is the rail, which is about a hundred
 * points; docking there would put a 380pt card straight back over the thing it
 * is describing. So a horizontal side has to clear `CARD_MIN` on its own
 * measure, and when neither can, the card falls back to whichever of top and
 * bottom has more room and takes the window's full width.
 */
type Side = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface Placement {
  side: Side;
  /** what the card may actually be, on the side it was given */
  width: number;
}

function placeFor(at: Rect | null, w: number, h: number, inset: number): Placement {
  const full = Math.max(CARD_MIN, Math.min(CARD_MAX, w - inset - GUTTER * 2));
  if (!at) return { side: 'center', width: full };

  const vertical = at.y >= h - (at.y + at.h) ? 'top' : 'bottom';
  const horizontal = at.x >= w - (at.x + at.w) ? 'left' : 'right';
  const sideRoom = Math.max(at.x, w - (at.x + at.w)) - GUTTER * 2;
  const stackRoom = Math.max(at.y, h - (at.y + at.h));

  // the widest gap wins, but a sideways one has to be able to hold a card and
  // an up-or-down one always can
  if (sideRoom >= CARD_MIN && sideRoom >= stackRoom) {
    return { side: horizontal, width: Math.min(CARD_MAX, sideRoom) };
  }
  return { side: vertical, width: full };
}

/**
 * THE CARD: ONE SHORT BOLD TITLE, AND THE CHROME THAT MOVES THROUGH THE TOUR.
 *
 * ## IT WAS A TITLE, A LINE AND AN OFFER, AND IT IS A TITLE
 *
 * Under the title sat one line of what the control MEANS, swapped after six
 * idle seconds for an instruction — *Tap anywhere inside the court* — and after
 * twelve for a SHOW ME that did the step on the scorer's behalf. All three are
 * gone. The ring is already round the control and the finger is already on the
 * spot: a paragraph beside them is the app explaining a thing the scorer is
 * looking at, on the one screen in the app where looking at it IS the lesson.
 *
 * What that buys is SIZE. A card carrying one string can set it at `fsLg`
 * rather than `fsMd` and still be the smallest object on the board, and a title
 * read at a glance from wherever the card has docked is worth more than three
 * lines read from close up. `constants/tutorial.ts` holds every string it
 * prints and `npm run check` holds each title to five words.
 *
 * ## IT IS THE PANEL'S OWN SURFACE, INCLUDING THE OPACITY RULE
 *
 * A 1px `line`, `m.r`, `ELEV_PANEL` — the same frame `PanelHost` builds,
 * because this is the same kind of object: a sheet in front of the room. It
 * also takes that file's hardest-won line, `isTranslucent(t) ? t.bg :
 * t.surface`: the board can be asked for the DARK palette, where `surface` is a
 * 5% white — which over a scrim is not a sheet but a slightly paler hole, with
 * every line of type inside it compositing a second time on top.
 *
 * Copying the four values rather than sharing them is deliberate; `PanelHost`'s
 * frame is bound up with its placement modes, and importing it here would drag
 * every panel in behind it.
 */
export function Caption({
  at,
  title,
  step,
  total,
  onBack,
  onNext,
}: {
  at: Rect | null;
  /** the whole of what the card says */
  title: string;
  /** 1-based, because it is printed */
  step: number;
  total: number;
  /** absent on the first step */
  onBack?: () => void;
  /** present only on a step with nothing to tap */
  onNext?: () => void;
}) {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const { side, width } = placeFor(at, m.win.w, m.win.h, safe.left + safe.right);

  /**
   * The card is hung off the edge it was given and centred on the other axis.
   *
   * A SIDEWAYS CARD IS CENTRED VERTICALLY RATHER THAN PINNED TO THE TOP, and
   * that is not symmetry for its own sake: SKIP lives in the top-left corner,
   * and a left-docked card hung from the top would be sat on it.
   */
  const mid = Math.max(safe.top + GUTTER, (m.win.h - CARD_MAX * 0.6) / 2);
  const placed =
    side === 'top' ? { top: safe.top + GUTTER, left: (m.win.w - width) / 2 }
    : side === 'bottom' ? { bottom: safe.bottom + GUTTER, left: (m.win.w - width) / 2 }
    : side === 'left' ? { left: safe.left + GUTTER, top: mid }
    : side === 'right' ? { right: safe.right + GUTTER, top: mid }
    : { top: safe.top + GUTTER, left: (m.win.w - width) / 2 };

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        width,
        maxHeight: m.win.h - safe.top - safe.bottom - GUTTER * 2,
        backgroundColor: isTranslucent(t) ? t.bg : t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: m.r,
        padding: m.s3,
        gap: m.s2,
        flexDirection: 'column',
        alignItems: 'stretch',
        ...ELEV_PANEL,
        ...placed,
      }}
    >
      {/* TWO LINES, NOT ONE. `fsLg` on a card as narrow as `CARD_MIN` is four
          or five words a line, and a title cut short by an ellipsis says less
          than a small one that fits. */}
      <Text
        numberOfLines={2}
        style={{
          ...fUi(700),
          fontSize: m.fsLg,
          lineHeight: m.fsLg * 1.25,
          letterSpacing: ls(m.fsLg, LS_TITLE),
          color: t.ink,
        }}
      >
        {title}
      </Text>

      <Row gap={m.s2} align="center">
        {/* BACK IS A GLYPH AND NEXT IS A WORD, which is the ratio the lobby's
            own last row uses: the thing you came here to do keeps the word. */}
        {!!onBack && (
          <Press
            onPress={onBack}
            accessibilityLabel={TUTORIAL_COPY.back}
            style={{
              width: m.tapSm,
              height: m.tapSm,
              flexGrow: 0,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: m.rSm,
            }}
            pressedStyle={{ backgroundColor: t.press }}
          >
            <MaterialCommunityIcons name="arrow-left" size={m.fsMd} color={t.ink2} />
          </Press>
        )}

        <Text
          style={{
            ...fUi(500),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {`${step} ${TUTORIAL_COPY.counterSep} ${total}`}
        </Text>

        <View style={{ flex: 1 }} />

        {/* ONLY ON A STEP WITH NOTHING TO TAP. Everywhere else the board itself
            is the way on, and a Next beside a live control is a second way past
            a step the scorer is meant to perform. */}
        {!!onNext && (
          <Press
            onPress={onNext}
            accessibilityLabel={TUTORIAL_COPY.next}
            style={{
              minHeight: m.tapSm,
              paddingHorizontal: m.s4,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: m.rSm,
              backgroundColor: t.accent,
            }}
            pressedStyle={{ backgroundColor: t.accent2 }}
          >
            <Text
              style={{
                ...fUi(600),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_BTN),
                color: t.accentInk,
              }}
            >
              {step === total ? TUTORIAL_COPY.done : TUTORIAL_COPY.next}
            </Text>
          </Press>
        )}
      </Row>
    </View>
  );
}

/**
 * SKIP, IN A FIXED CORNER AND FIRST IN THE TREE.
 *
 * First in the tree because that is first in focus order, which is what a
 * screen reader owes somebody who has landed in a walkthrough they did not
 * want. Fixed rather than on the card because the card moves every step, and a
 * way out that moves is a way out you have to look for.
 *
 * It is TEXT and not a button shape: it is the one control here that is not
 * part of the tour.
 */
export function SkipButton({ onPress }: { onPress(): void }) {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={TUTORIAL_COPY.skip}
      style={{
        position: 'absolute',
        top: safe.top + 2,
        left: safe.left + GUTTER,
        minHeight: m.tapSm,
        paddingHorizontal: m.s3,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: m.rSm,
      }}
      pressedStyle={{ opacity: 0.55 }}
    >
      <Text
        style={{
          ...fUi(600),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_BTN),
          /**
           * `DARK.ink`, AND NOT `t.ink`. This is the one control in the tour
           * that sits on the SCRIM rather than on a sheet — a 50% black over
           * whatever the board is — so the palette it is drawn in is the wrong
           * one to ask: on a light board `t.ink` is a near-black that vanishes
           * into the sheet under it. `DARK` is the palette this ground belongs
           * to, and reading a token off it is what keeps the hex in
           * `theme/tokens.ts` where every hex in this app lives.
           */
          color: DARK.ink,
        }}
      >
        {TUTORIAL_COPY.skip}
      </Text>
    </Press>
  );
}

/**
 * THE CONFIRM, AND IT IS TWO VERBS AND NOTHING ELSE.
 *
 * A centred sheet over its own sheet, which is what every confirm in this app
 * is. KEEP GOING takes the primary weight: the destructive reading here is
 * leaving, and the one line under the title is the thing that makes leaving
 * survivable — you can start it again, from a row that is always there.
 */
export function SkipConfirm({ onSkip, onStay }: { onSkip(): void; onStay(): void }) {
  const m = useMetrics();
  const t = useTheme();

  const verb = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: m.tap,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: m.rSm,
  };
  const label = { ...fUi(600), fontSize: m.fsMd, letterSpacing: ls(m.fsMd, LS_BTN) };

  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }}
    >
      <View
        accessibilityViewIsModal
        style={{
          width: Math.min(m.win.w * 0.86, 420),
          padding: m.s4,
          gap: m.s4,
          backgroundColor: isTranslucent(t) ? t.bg : t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: m.r,
          flexDirection: 'column',
          alignItems: 'stretch',
          ...ELEV_PANEL,
        }}
      >
        <Col gap={m.s1}>
          <Text
            style={{
              ...fUi(700),
              fontSize: m.fsLg,
              letterSpacing: ls(m.fsLg, LS_TITLE),
              color: t.ink,
            }}
          >
            {TUTORIAL_COPY.confirmTitle}
          </Text>
          <Text
            style={{
              ...fUi(400),
              fontSize: m.fsSm,
              lineHeight: m.fsSm * 1.4,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink2,
            }}
          >
            {TUTORIAL_COPY.confirmLine}
          </Text>
        </Col>

        <Row gap={m.s2} align="stretch">
          <Press
            onPress={onSkip}
            accessibilityLabel={TUTORIAL_COPY.confirmSkip}
            style={{ ...verb, borderWidth: 2, borderColor: t.line }}
            pressedStyle={{ backgroundColor: t.press }}
          >
            <Text style={{ ...label, color: t.ink }}>{TUTORIAL_COPY.confirmSkip}</Text>
          </Press>
          <Press
            onPress={onStay}
            accessibilityLabel={TUTORIAL_COPY.confirmStay}
            style={{ ...verb, backgroundColor: t.accent }}
            pressedStyle={{ backgroundColor: t.accent2 }}
          >
            <Text style={{ ...label, color: t.accentInk }}>{TUTORIAL_COPY.confirmStay}</Text>
          </Press>
        </Row>
      </View>
    </View>
  );
}
