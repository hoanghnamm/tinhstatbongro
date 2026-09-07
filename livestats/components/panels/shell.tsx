import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import type { TargetId } from '../../constants/tutorial';
import { chunk, gridFor } from '../../lib/grid';
import { tileWords } from '../../lib/labels';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import {
  BLOOM_END,
  BLOOM_START,
  BLOOM_STOPS,
  LS_BTN,
  LS_MICRO,
  bloomFill,
  plateWash,
  fNum,
  fUi,
  ls,
} from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Badge } from '../ui/Badge';
import { Press } from '../ui/Press';
import { Center, Row as UIRow } from '../ui/Row';
import { Tile } from '../ui/Tile';
import type { Player } from '../../types';

export { Badge, Tile };

/* ------------------------------------------------------------------ *
 * Header
 * A ROW — the CSS said `display:flex`, which lays out horizontally there
 * and vertically here. The name truncates; CANCEL is pinned to the far
 * edge by `marginLeft:'auto'` and neither it nor the points ever shrink.
 * ------------------------------------------------------------------ */

export function PHead({ children }: { children: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <UIRow
      gap={m.s2}
      align="center"
      style={{
        flexGrow: 0, flexShrink: 0, minHeight: m.tap, paddingLeft: m.s3,
        borderBottomWidth: 1, borderBottomColor: t.rule,
      }}
    >
      {children}
    </UIRow>
  );
}

export function PTitleText({ children }: { children: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        flexShrink: 1, minWidth: 0,
        ...fUi(600), fontSize: m.fsLg, color: t.ink,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Secondary context in the header — never a control, and it never shrinks.
 * Tabular, because one of the things it carries is a running game clock.
 */
export function Pts({ children }: { children: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        flexGrow: 0, flexShrink: 0,
        ...fNum(500), fontSize: m.fsMd, color: t.ink2,
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Step 2's context label, and it is the SAME TITLE every other panel's header
 * carries — `PTitleText`'s face, weight and size, with nothing drawn around it.
 *
 * **IT WAS A CHIP AND THE CHIP IS GONE.** The rebound flow's copy wore a filled
 * box: a `surface2` fill, a 1px `rule` border and a radius, because it is the
 * one step-2 title that is also a control. That made the ONE header in the app
 * whose title sat in a container — every other panel names itself in plain type
 * against the seam — so the flow that needed the least explanation was the one
 * that looked different. The box also cost the title a size: it was set at
 * `fsMd` where a panel title is `fsLg`.
 *
 * **THE `←` IS THE WHOLE AFFORDANCE NOW**, and it is enough: an arrow in
 * front of a word says "back" more plainly than a border around it ever did.
 * Only the rebound flow gets one — a shot result, a foul kind and FREE THROWS
 * name themselves and nothing else, and a control that is *sometimes* a control
 * is worse than neither. The press is an OPACITY rather than a fill, because a
 * fill under a title with no box is a box that appears under the thumb.
 *
 * The tap floor is kept as `minHeight` on the pressable half, which costs
 * nothing: `PHead` is already `m.tap` tall.
 */
export function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const m = useMetrics();

  // the title itself is `PTitleText` and not a second copy of its rules: this
  // is a step-2 header like every other one, and two declarations of one face
  // is how the one that is also a control drifts away from the ones that are not
  const body = (
    <PTitleText>
      {onPress ? '← ' : ''}
      {label}
    </PTitleText>
  );

  if (!onPress) return body;
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="change the previous step"
      style={{
        flexShrink: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: m.tap,
      }}
      pressedStyle={{ opacity: 0.6 }}
    >
      {body}
    </Press>
  );
}

/** The word is dropped on the docked panel, which is one column wide. */
export function CancelX({ label = 'Cancel' }: { label?: string }) {
  const m = useMetrics();
  const t = useTheme();
  const reset = useUiStore((s) => s.reset);

  return (
    <Press
      onPress={reset}
      accessibilityLabel="cancel, record nothing"
      style={{
        // pinned to the far edge of the header, whatever the title's width
        marginLeft: 'auto',
        alignSelf: 'stretch',
        flexGrow: 0,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.s2,
        paddingHorizontal: m.s3,
        minWidth: m.tap,
        borderLeftWidth: 1,
        borderLeftColor: t.rule,
      }}
      pressedStyle={{ backgroundColor: t.surface2 }}
    >
      {!!label && (
        <Text
          style={{
            ...fUi(600), fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO), color: t.ink2,
          }}
        >
          {label}
        </Text>
      )}
      <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
        <Path d="M5 5l14 14M19 5L5 19" stroke={t.ink2} strokeWidth={2.4} fill="none" />
      </Svg>
    </Press>
  );
}

/* ------------------------------------------------------------------ *
 * Tile grid
 * The 1px divider IS the gap: a rule-coloured parent showing through 1px
 * seams. Tiles must be opaque and edgeless for that to read.
 * ------------------------------------------------------------------ */

/**
 * The seam grid, given its rows explicitly — one row per array, and the cells
 * in a row split it evenly however many there are.
 *
 * `PGrid` is this with the chunking done for you, and it is the right default.
 * Reach for `PRows` when a row's cell count is the point rather than an
 * accident: the quarter panel's two enders take half the bottom each, and the
 * clock pad's right column is three actions beside a 3×3 of digits. Neither is
 * a chunk of a flat list.
 */
export function PRows({ rows }: { rows: ReactNode[][] }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1, minHeight: 0,
        flexDirection: 'column', gap: 1,
        backgroundColor: t.rule,
      }}
    >
      {rows.map((row, i) => (
        <View key={i} style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
          {row.map((cell, j) => (
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PGrid({ columns, children }: { columns: number; children: ReactNode[] }) {
  const t = useTheme();
  const rows = chunk(children, columns).map((row) => [
    ...row,
    // a short last row keeps the cell size rather than stretching
    ...Array.from({ length: columns - row.length }, (_, k) => (
      <View key={'gap' + k} style={{ flex: 1, backgroundColor: t.surface }} />
    )),
  ]);

  return <PRows rows={rows} />;
}

/**
 * A tile that NAMES A STAT — a foul kind, a rebound kind, a tally — and
 * therefore the one kind of tile the LABELS option is about. It is the only
 * reader of that option: three panels asking it separately is three answers
 * waiting to drift, and `tileWords` is the rule.
 *
 * The screen reader always hears the full word, whatever is drawn. An
 * abbreviation is a thing to look at, not a thing to say.
 */
export function StatTile({
  short,
  full,
  badge,
  selected,
  big,
  onPress,
  accessibilityLabel,
}: {
  short: string;
  full: string;
  badge?: number;
  selected?: boolean;
  big?: boolean;
  onPress(): void;
  accessibilityLabel?: string;
}) {
  const mode = useGameStore((s) => s.options.labels);
  const w = tileWords(mode, short, full);
  return (
    <Tile
      code={w.code}
      caption={w.caption}
      word={w.word}
      badge={badge}
      selected={selected}
      big={big}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? full}
    />
  );
}

/**
 * One roster tile, shared by every picker. A player who has fouled out is
 * disabled rather than merely discouraged, so an invalid record is impossible.
 */
export function PlayerTile({ player, onPress }: { player: Player; onPress(): void }) {
  const out = player.status === 'out';
  return (
    <Tile
      code={player.number}
      caption={out ? 'Out · ' + player.name : player.name}
      badge={player.stats.fouls}
      disabled={out}
      onPress={onPress}
      accessibilityLabel={`#${player.number} ${player.name}${out ? ', fouled out' : ''}`}
    />
  );
}

/** The roster grid, auto-fitted to the panel's own measured box. */
export function PlayerGrid({
  players,
  box,
  onPick,
}: {
  players: Player[];
  box: { w: number; h: number };
  onPick(id: string): void;
}) {
  const m = useMetrics();
  const grid = gridFor(players.length, box.w, box.h, m.tap);
  return (
    <PGrid columns={grid.columns}>
      {players.map((p) => (
        <PlayerTile key={p.id} player={p} onPress={() => onPick(p.id)} />
      ))}
    </PGrid>
  );
}

/**
 * Inverted on purpose: this is the one button on the panel that LEAVES it, so
 * it must never wear the same surface as the tiles that do not. Background AND
 * colour together — text over a dropped background is an invisible bar.
 *
 * The ink is `bg` and NOT `surface`, which is what it used to be: an inverted
 * pair has to survive both palettes, and `DARK`'s `surface` is 5% WHITE, so on
 * a dark board this bar drew white on white. `bg` is the one token that is the
 * opposite of `ink` in both.
 */
export function PSub({
  label,
  onPress,
  targetId,
}: {
  label: string;
  onPress(): void;
  /** the walkthrough's name for this bar — see `Press`'s own note */
  targetId?: TargetId;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      targetId={targetId}
      style={{
        flexGrow: 0, flexShrink: 0,
        minHeight: m.tap,
        alignItems: 'center', justifyContent: 'center',
        borderTopWidth: 1, borderTopColor: t.rule,
        backgroundColor: t.ink,
      }}
      pressedStyle={{ backgroundColor: t.ink2 }}
    >
      <Text
        style={{
          ...fUi(600), fontSize: m.fsMd,
          letterSpacing: ls(m.fsMd, LS_BTN), color: t.bg,
        }}
      >
        {label}
      </Text>
    </Press>
  );
}

/* ------------------------------------------------------------------ *
 * Centre-dialog pieces
 * ------------------------------------------------------------------ */

export function PTitle({
  title,
  kind,
  tone = 'accent',
}: {
  title: string;
  kind?: string;
  tone?: 'accent' | 'ink' | 'bad';
}) {
  const m = useMetrics();
  const t = useTheme();
  const bg = tone === 'bad' ? t.danger : tone === 'ink' ? t.ink : t.accent;
  const fg = tone === 'ink' ? t.surface : tone === 'bad' ? t.dangerInk : t.accentInk;

  return (
    <UIRow gap={m.sp} align="center" style={{ marginBottom: m.spLg }}>
      <Text
        numberOfLines={2}
        style={{ flexShrink: 1, ...fUi(600), fontSize: m.fsLg, color: t.ink }}
      >
        {title}
      </Text>
      {!!kind && (
        <View
          style={{
            marginLeft: 'auto',
            flexGrow: 0, flexShrink: 0,
            borderRadius: 99,
            paddingVertical: 4, paddingHorizontal: m.sp * 1.4,
            backgroundColor: bg,
          }}
        >
          <Text style={{ ...fUi(600), fontSize: m.fsSm, color: fg }}>{kind}</Text>
        </View>
      )}
    </UIRow>
  );
}

export function Btn({
  label,
  onPress,
  variant = 'plain',
  disabled = false,
  icon,
}: {
  label: string;
  onPress(): void;
  /**
   * `surface` is the home screen's secondary: a filled cell with a 1px rule
   * around it, one step quieter than `solid` and one louder than `plain`. It
   * exists because a screen with three stacked buttons needs three weights —
   * on a panel, where every button sits in a row of two, `plain` was enough.
   *
   * `bloom` IS THE BACKGROUND, MADE INTO A BUTTON: the near-black ground of the
   * four rooms with the accent washing across it on the bloom's own axis — the
   * same construction as the screen behind it, at a weight a control can carry.
   * It is a SEVENTH variant rather than a change to `accent` on purpose: every
   * accent button on the board sits on a panel over a light court, where there
   * is no bloom to belong to and where a fill that falls to near-black would be
   * a hole. Its callers now are CONTINUE GAME and START GAME, and it is drawn
   * on `DARK` only.
   *
   * `plate` IS THE JERSEY PLATE, MADE INTO A BUTTON, and it is the EIGHTH.
   * The same three layers `components/ui/Jersey.tsx` draws, in the same order:
   * the `court` fill, `plateWash` out of the corner the room itself is lit
   * from, and the 2px accent rule down the LEFT — with the glyph in
   * `courtLine`, which is the ink a jersey number is stencilled in. Its one
   * caller is the lobby's `+`.
   *
   * IT IS NOT A QUIETER `bloom`. `bloom` is the ROOM made into a button — the
   * near-black ground of the four rooms with the accent washing over it, which
   * says the verb belongs to the screen it is on. `plate` says a different
   * thing: that the `+` on the lobby and the plates on the picker one tap
   * later are the same object, so the button is a jersey before there is a
   * number on it. Two arguments, and neither is the other at half strength.
   */
  variant?: 'plain' | 'solid' | 'accent' | 'danger' | 'made' | 'surface' | 'bloom' | 'plate';
  disabled?: boolean;
  /**
   * A GLYPH INSTEAD OF THE LABEL, never beside it. A button carrying both is a
   * label with decoration on it; a button carrying only the glyph is what a
   * narrow cell in a split row can actually hold. `label` stays REQUIRED either
   * way — it is what the screen reader says, and an icon-only control with no
   * name is a control only a sighted scorer has.
   *
   * The family is the tab bar's, and the weights match it: these are the two
   * places in the app a glyph stands in for a word, and two icon sets would
   * read as two apps.
   */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const m = useMetrics();
  const t = useTheme();

  const lit = variant === 'bloom';
  // the plate is a pair like every other variant here, and it is the one pair
  // that does not invert with the palette: a jersey is the floor with a number
  // stencilled on it, in a dark room and on a light board alike.
  const plated = variant === 'plate';

  // background and foreground are chosen together, always — this pair is where
  // an inverted control loses one half and turns into an invisible slab.
  //
  // THE LIT BUTTON'S OWN FILL IS THE CANVAS, because the gradient over it is
  // the accent at FALLING ALPHA — the same way the wash is painted onto the
  // screen. Painting `accent` under it instead would flatten the far end back
  // into orange and there would be no gradient left to see.
  const fill =
    variant === 'solid' ? t.ink
    : variant === 'accent' || variant === 'made' ? t.accent
    : variant === 'danger' ? t.danger
    : variant === 'surface' ? t.surface
    : lit ? t.bg
    : plated ? t.court
    : 'transparent';
  const fg =
    variant === 'solid' ? t.surface
    : variant === 'accent' || variant === 'made' || lit ? t.accentInk
    : variant === 'danger' ? t.dangerInk
    : plated ? t.courtLine
    : t.ink;

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: m.sp,
        borderRadius: m.r,
        // THE PLATE CARRIES NO BORDER AT ALL, because its edge is not a border:
        // it is a 2px rule down ONE side, drawn below with the wash. A ring of
        // accent around the whole button would be a different object — every
        // plate in the app is lit from the left and open on the other three.
        borderWidth: plated ? 0 : variant === 'surface' ? 1 : 2,
        // the lit button's edge is the ACCENT, not its own fill: the fill is a
        // near-black that would draw no edge at all against the room
        borderColor:
          variant === 'plain' ? t.line
          : variant === 'surface' ? t.rule
          : lit ? t.accent
          : fill,
        backgroundColor: fill,
        opacity: disabled ? 0.4 : 1,
        // the gradient is absolutely positioned, so the corners have to be cut
        // somewhere — and the two dressed variants are the only ones with
        // anything to cut. There is no shadow here to lose to the clip.
        overflow: lit || plated ? 'hidden' : 'visible',
      }}
      // DOWN IS DARKER on anything orange, not fainter. `opacity` fades a
      // saturated orange toward a warm canvas that is nearly the same hue, so
      // the primary button read as going PALE under the thumb rather than as
      // going down. `accent2` is that step; the ink stays `accentInk`, which is
      // still white and still passes on the darker fill. Every other variant
      // keeps the fade — none of them is orange. On the LIT one the ramp itself
      // takes the step, so only the edge is left here to move with it.
      // ON THE PLATE THERE IS NOTHING LEFT HERE TO MOVE: the two things that
      // could go down are both orange and both drawn below, so the wash and
      // the edge take `accent2` in the render and the warm fill under them
      // holds still. Fading the whole plate would take the number's contrast
      // with it, which is the one thing a plate has.
      pressedStyle={
        lit ? { borderColor: t.accent2 }
        : plated ? {}
        : variant === 'accent' || variant === 'made'
          ? { backgroundColor: t.accent2, borderColor: t.accent2 }
          : { opacity: 0.85 }
      }
    >
      {(pressed) => (
        <>
          {/* THE SAME WASH AS THE ROOM, over the same near-black and on the
              same axis — the ramp comes out of `tokens.ts` beside the wash's
              own, so the button cannot end up lit from a different corner than
              the screen it is on. Pressed, the whole ramp steps down to
              `accent2`. */}
          {lit && (
            <LinearGradient
              colors={bloomFill(pressed ? t.accent2 : t.accent)}
              locations={BLOOM_STOPS}
              start={BLOOM_START}
              end={BLOOM_END}
              pointerEvents="none"
              style={{ position: 'absolute', inset: 0 }}
            />
          )}
          {/* THE PLATE'S TWO GROUND LAYERS, in `Jersey`'s own order: the
              corner bloom first, then the one solid thing in the set. A wash
              with no hard edge anywhere reads as a smudge, which is the whole
              reason the rule is there — and it is 2px on the LEFT, exactly as
              a jersey wears it. Both step to `accent2` under the thumb. */}
          {plated && (
            <>
              <LinearGradient
                colors={plateWash(pressed ? t.accent2 : t.accent)}
                locations={BLOOM_STOPS}
                start={BLOOM_START}
                end={BLOOM_END}
                pointerEvents="none"
                style={{ position: 'absolute', inset: 0 }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: pressed ? t.accent2 : t.accent,
                }}
              />
            </>
          )}
          {icon ?
            <MaterialCommunityIcons name={icon} size={m.fsXl} color={fg} />
          : <Text
              numberOfLines={1}
              style={{
                ...fUi(600), fontSize: m.fsMd,
                letterSpacing: ls(m.fsMd, LS_BTN), color: fg, textAlign: 'center',
              }}
            >
              {label}
            </Text>
          }
        </>
      )}
    </Press>
  );
}

/** A big two-line action: code over caption, both axes centred. */
export function Act({
  code,
  caption,
  onPress,
  go = false,
}: {
  code: string;
  caption: string;
  onPress(): void;
  go?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${code}, ${caption}`}
      style={{
        flex: 1,
        minHeight: m.tap,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.s1,
        paddingVertical: m.spLg,
        paddingHorizontal: m.sp * 0.6,
        borderRadius: m.r,
        borderWidth: 2,
        borderColor: go ? t.accent : t.line,
        backgroundColor: go ? t.accent : 'transparent',
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <Text
        numberOfLines={1}
        style={{ ...fUi(600), fontSize: m.fsLg, color: go ? t.accentInk : t.ink }}
      >
        {code}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          ...fUi(600), fontSize: m.fsXs, textAlign: 'center',
          letterSpacing: ls(m.fsXs, LS_BTN),
          color: go ? t.accentInk : t.ink2, opacity: go ? 0.85 : 1,
        }}
      >
        {caption}
      </Text>
    </Press>
  );
}

/** A row of equal-width buttons. `align:'stretch'` so they share a height. */
export function Row({ children, gap, mt }: { children: ReactNode; gap?: number; mt?: boolean }) {
  const m = useMetrics();
  return (
    <UIRow gap={gap ?? m.sp} align="stretch" style={{ marginTop: mt ? m.sp : 0 }}>
      {children}
    </UIRow>
  );
}

export function Stack({ children, gap }: { children: ReactNode; gap?: number }) {
  const m = useMetrics();
  return <View style={{ flexDirection: 'column', gap: gap ?? m.sp }}>{children}</View>;
}

export function Note({ children }: { children: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      style={{
        ...fUi(400), fontSize: m.fsSm, color: t.ink2,
        marginTop: m.sp, lineHeight: m.fsSm * 1.5,
      }}
    >
      {children}
    </Text>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      style={{
        paddingVertical: m.spLg, textAlign: 'center',
        ...fUi(400), fontSize: m.fsMd, color: t.ink2,
      }}
    >
      {children}
    </Text>
  );
}

/** An empty bench says so in the body rather than opening a grid of nothing. */
export function PEmpty({ children }: { children?: ReactNode }) {
  const m = useMetrics();
  return (
    <Center flex={1} gap={m.sp} style={{ minHeight: 0, padding: m.spLg }}>
      {children}
    </Center>
  );
}

/** Only panels scroll; the board never does. */
export function PanelScroll({ children }: { children: ReactNode }) {
  return <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}
