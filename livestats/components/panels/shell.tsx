import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { chunk, gridFor } from '../../lib/grid';
import { tileWords } from '../../lib/labels';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
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
  return (
    <UIRow
      gap={m.s2}
      align="center"
      className="border-b border-rule"
      style={{ flexGrow: 0, flexShrink: 0, minHeight: m.tap, paddingLeft: m.s3 }}
    >
      {children}
    </UIRow>
  );
}

export function PTitleText({ children }: { children: ReactNode }) {
  const m = useMetrics();
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      className="text-ink"
      style={{ flexShrink: 1, minWidth: 0, fontFamily: fNum(700), fontSize: m.fsLg }}
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
  return (
    <Text
      numberOfLines={1}
      className="text-ink-2"
      style={{
        flexGrow: 0, flexShrink: 0,
        fontFamily: fNum(500), fontSize: m.fsMd,
        fontVariant: ['tabular-nums'],
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Step 2's context label. Only the rebound flow makes it a control: a shot
 * result, a foul kind and FREE THROWS name themselves and nothing else, and a
 * chip that is *sometimes* a control is worse than neither.
 */
export function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const m = useMetrics();
  const t = useTheme();

  const body = (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        fontFamily: fNum(700), fontSize: m.fsMd,
        letterSpacing: ls(m.fsMd, LS_LABEL), color: t.ink,
      }}
    >
      {onPress ? '← ' : ''}
      {label}
    </Text>
  );

  const box = {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: m.tap,
    paddingHorizontal: onPress ? m.s3 : 0,
    borderRadius: m.rSm,
    borderWidth: 1,
    borderColor: onPress ? t.rule : 'transparent',
    backgroundColor: onPress ? t.surface2 : 'transparent',
  };

  if (!onPress) return <View style={box}>{body}</View>;
  return (
    <Press
      onPress={onPress}
      accessibilityLabel="change the previous step"
      style={box}
      pressedStyle={{ backgroundColor: t.rule }}
    >
      {body}
    </Press>
  );
}

/** The word is dropped on the docked panel, which is one column wide. */
export function CancelX({ label = 'CANCEL' }: { label?: string }) {
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
            fontFamily: fUi(600), fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_LABEL), color: t.ink2,
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
      caption={out ? 'OUT · ' + player.name : player.name}
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
 * colour together — surface-coloured text over a dropped background is an
 * invisible bar.
 */
export function PSub({ label, onPress }: { label: string; onPress(): void }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
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
          fontFamily: fNum(700), fontSize: m.fsLg,
          letterSpacing: ls(m.fsLg, LS_BTN), color: t.surface,
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
        style={{ flexShrink: 1, fontFamily: fNum(700), fontSize: m.fsXl, color: t.ink }}
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
          <Text style={{ fontFamily: fNum(700), fontSize: m.fsMd, color: fg }}>{kind}</Text>
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
}: {
  label: string;
  onPress(): void;
  /**
   * `surface` is the home screen's secondary: a filled cell with a 1px rule
   * around it, one step quieter than `solid` and one louder than `plain`. It
   * exists because a screen with three stacked buttons needs three weights —
   * on a panel, where every button sits in a row of two, `plain` was enough.
   */
  variant?: 'plain' | 'solid' | 'accent' | 'danger' | 'made' | 'surface';
  disabled?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  // background and foreground are chosen together, always — this pair is where
  // an inverted control loses one half and turns into an invisible slab
  const fill =
    variant === 'solid' ? t.ink
    : variant === 'accent' || variant === 'made' ? t.accent
    : variant === 'danger' ? t.danger
    : variant === 'surface' ? t.surface
    : 'transparent';
  const fg =
    variant === 'solid' ? t.surface
    : variant === 'accent' || variant === 'made' ? t.accentInk
    : variant === 'danger' ? t.dangerInk
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
        borderWidth: variant === 'surface' ? 1 : 2,
        borderColor:
          variant === 'plain' ? t.line : variant === 'surface' ? t.rule : fill,
        backgroundColor: fill,
        opacity: disabled ? 0.4 : 1,
      }}
      pressedStyle={{ opacity: 0.85 }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700), fontSize: m.fsLg,
          letterSpacing: ls(m.fsLg, LS_BTN), color: fg, textAlign: 'center',
        }}
      >
        {label}
      </Text>
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
        style={{ fontFamily: fNum(700), fontSize: m.fsXl, color: go ? t.accentInk : t.ink }}
      >
        {code}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fUi(600), fontSize: m.fsXs, textAlign: 'center',
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
  return (
    <Text
      className="text-ink-2"
      style={{ fontFamily: fUi(400), fontSize: m.fsSm, marginTop: m.sp, lineHeight: m.fsSm * 1.5 }}
    >
      {children}
    </Text>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const m = useMetrics();
  return (
    <Text
      className="text-center text-ink-2"
      style={{ paddingVertical: m.spLg, fontFamily: fUi(400), fontSize: m.fsMd }}
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
