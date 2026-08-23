import { Text, View } from 'react-native';

import { litControl } from '../../lib/lit';
import { useLitRect } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';

/**
 * One action button: a big code with an optional caption, both axes centred.
 * A column in landscape; a row in portrait, where the same three sit in a bar
 * under the court.
 *
 * `opp` inverts on press — those buttons score immediately with no panel to
 * confirm them, so the press itself has to be the confirmation. Background and
 * ink flip together; flipping one alone is how a control goes invisible.
 *
 * PF / FT / RB open a panel instead, so their press only has to say "this one":
 * `t.press` lifts the tile off the surface and takes the border with it, so the
 * cell reads as lit rather than as an outline that got darker inside. `lit`
 * holds exactly that fill for as long as the flow the button started is open —
 * a `court` panel dims the board without covering these three, and a lit tile
 * under the scrim is the only thing that says which one you are answering.
 */
export function SBtn({
  code,
  label,
  onPress,
  opp = false,
  lit = false,
  accessibilityLabel,
}: {
  code: string;
  label?: string;
  onPress(): void;
  opp?: boolean;
  /** held while the panel this button opened is on screen */
  lit?: boolean;
  accessibilityLabel?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const portrait = m.portrait;
  const hole = useLitRect(lit);

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? (label ? `${code} ${label}` : code)}
      innerRef={hole.ref}
      onLayout={hole.onLayout}
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: portrait ? m.barh : m.tap,
        flexDirection: portrait ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: portrait ? m.sp : m.s1,
        paddingVertical: portrait ? 0 : m.s2,
        paddingHorizontal: portrait ? m.sp : m.s1,
        borderWidth: 1,
        borderColor: lit ? t.press : t.rule,
        borderRadius: m.rSm,
        backgroundColor: lit ? t.press : t.surface,
      }}
      pressedStyle={
        opp
          ? { backgroundColor: t.accent, borderColor: t.accent }
          : { backgroundColor: t.press, borderColor: t.press }
      }
    >
      {(pressed) => {
        const ink = pressed && opp ? t.accentInk : t.ink;
        return (
          <>
            <Text
              numberOfLines={1}
              style={{
                ...fNum(700),
                fontSize: portrait ? m.fsLg : m.fs2xl,
                textAlign: 'center',
                color: ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {code}
            </Text>
            {!!label && (
              <Text
                numberOfLines={1}
                style={{
                  ...fUi(600),
                  fontSize: m.fsXs,
                  // OPP is an abbreviation, and abbreviations are the one
                  // thing left in caps — so they keep the air caps need.
                  letterSpacing: ls(m.fsXs, LS_CAPS),
                  textAlign: 'center',
                  color: pressed && opp ? t.accentInk : t.ink2,
                }}
              >
                {label}
              </Text>
            )}
          </>
        );
      }}
    </Press>
  );
}

/**
 * The PF / FT / RB column: the three most tapped controls, against one edge.
 *
 * One subscription for the three of them: `litControl` reads the panel and the
 * in-flight entry together, because step 2 (`who`) is the same panel for all
 * three flows and only the entry says whose it is.
 */
export function SideColumn({
  onPf,
  onFt,
  onRb,
  innerRef,
  onLayout,
}: {
  onPf(): void;
  onFt(): void;
  onRb(): void;
  innerRef: React.Ref<View>;
  onLayout(): void;
}) {
  const m = useMetrics();
  const lit = useUiStore((s) => litControl(s.panel, s.what));
  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
      style={
        m.portrait
          ? {
              flexDirection: 'row', alignItems: 'stretch',
              width: '100%', minHeight: m.barh, gap: m.sp,
            }
          : {
              flexGrow: 1, flexShrink: 1, flexBasis: m.side,
              minWidth: m.side, maxWidth: m.side * 2.4,
              flexDirection: 'column', alignItems: 'stretch',
              gap: m.sp, minHeight: 0,
            }
      }
    >
      <SBtn code="PF" onPress={onPf} lit={lit === 'pf'} accessibilityLabel="record a foul" />
      <SBtn code="FT" onPress={onFt} lit={lit === 'ft'} accessibilityLabel="record free throws" />
      <SBtn code="RB" onPress={onRb} lit={lit === 'rb'} accessibilityLabel="record a rebound" />
    </View>
  );
}
