import { Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_TITLE, fNum, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { CancelX, PHead, PTitleText } from './shell';

/**
 * Quick free throws (`ft: 'quick'`), the result step — and the second panel in
 * the app to dock, for the same reason as the first: the point is seeing the
 * court. The FT_SPOT dot is already on the line by the time this opens, under a
 * panel that neither covers nor dims it, which is why the flow that opens this
 * one does NOT clear() the entry on its way in — `what` stays `'ft'`, and that
 * is what keeps the dot lit before the first attempt lands.
 *
 * It is the shot MADE/MISS panel in the same slot with the same shape, so the
 * muscle memory carries: MADE takes the wider tile and the accent, MISS the
 * surface, the 1px seam between them is the rule colour showing through.
 *
 * ONE TAP IS ONE ATTEMPT, and the panel stays open — a two- or three-shot trip
 * is tapped straight through without reopening. Only X closes it. Each tap is
 * its own one-shot trip, so undo steps back exactly one attempt.
 */
export function FTDockPanel() {
  const m = useMetrics();
  const t = useTheme();
  const shooter = useUiStore((s) => s.shooter);
  const p = usePlayer(shooter);
  const recordFreeThrowTrip = useGameStore((s) => s.recordFreeThrowTrip);

  useAnnounce('free throw');
  if (!p || !shooter) return null;

  const shoot = (made: boolean) => () => recordFreeThrowTrip(shooter, [made], false);

  // MADE and MISS are the same tile at the same type size. MADE takes the
  // accent AND the accent's ink — the pair is set together, because keeping the
  // ink while losing the fill is exactly how this tile goes dark-on-dark.
  const tile = (label: string, made: boolean) => (
    <Press
      onPress={shoot(made)}
      accessibilityLabel={label}
      style={{
        flexGrow: made ? 1.25 : 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: m.s4,
        paddingHorizontal: m.s3,
        backgroundColor: made ? t.accent : t.surface,
      }}
      pressedStyle={made ? { opacity: 0.9 } : { backgroundColor: t.surface2 }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: m.fs2xl,
          letterSpacing: ls(m.fs2xl, LS_TITLE),
          textAlign: 'center',
          color: made ? t.accentInk : t.ink,
        }}
      >
        {label}
      </Text>
    </Press>
  );

  return (
    <>
      {/* Title and X, nothing between them. A running made-attempted chip was
          built and cut: the split is the box score's job, and the dock is one
          column wide — the same reason CANCEL loses its word here. */}
      <PHead>
        <PTitleText>FT #{p.number}</PTitleText>
        <CancelX label="" />
      </PHead>
      {/* 1px seams over the rule colour, exactly like the tile grid */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          gap: 1,
          backgroundColor: t.rule,
        }}
      >
        {tile('MADE', true)}
        {tile('MISS', false)}
      </View>
    </>
  );
}
