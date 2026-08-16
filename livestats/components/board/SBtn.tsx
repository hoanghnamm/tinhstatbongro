import { Text, View } from 'react-native';

import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
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
 */
export function SBtn({
  code,
  label,
  onPress,
  opp = false,
  accessibilityLabel,
}: {
  code: string;
  label?: string;
  onPress(): void;
  opp?: boolean;
  accessibilityLabel?: string;
}) {
  const m = useMetrics();
  const t = useTheme();
  const portrait = m.portrait;

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? (label ? `${code} ${label}` : code)}
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
        borderColor: t.rule,
        borderRadius: m.rSm,
        backgroundColor: t.surface,
      }}
      pressedStyle={
        opp
          ? { backgroundColor: t.accent, borderColor: t.accent }
          : { backgroundColor: t.surface2 }
      }
    >
      {(pressed) => {
        const ink = pressed && opp ? t.accentInk : t.ink;
        return (
          <>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(700),
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
                  fontFamily: fUi(600),
                  fontSize: m.fsXs,
                  letterSpacing: ls(m.fsXs, LS_LABEL),
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

/** The PF / FT / RB column: the three most tapped controls, against one edge. */
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
      <SBtn code="PF" onPress={onPf} accessibilityLabel="record a foul" />
      <SBtn code="FT" onPress={onFt} accessibilityLabel="record free throws" />
      <SBtn code="RB" onPress={onRb} accessibilityLabel="record a rebound" />
    </View>
  );
}
