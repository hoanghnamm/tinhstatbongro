import { Text, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_TITLE, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { CancelX, PHead, PTitleText } from './shell';

/**
 * Step 1 of a shot, and the one panel that does not cover the court: the point
 * of tapping a spot is seeing the spot, so this docks over the columns beside
 * the court and the scrim goes clear.
 *
 * There is deliberately NO zone label and NO manual 2/3 override. A named-zone
 * label with a tap-to-flip reading was built and cut; `zoneFor` is the only arc
 * call there is, which is what keeps the zone and the shot type from ever
 * disagreeing. Do not re-add one without being asked.
 *
 * The shot note is still wired end to end (SHOT_NOTES, ui.note, the event's
 * shotNote) but nothing renders it: the finishing type is a later question, and
 * this panel is one column wide.
 */
export function WhatPanel() {
  const m = useMetrics();
  const t = useTheme();
  const shotType = useUiStore((s) => s.shotType);
  const setWhat = useUiStore((s) => s.setWhat);
  const open = useUiStore((s) => s.open);

  useAnnounce(`${shotType} shot`);

  const pick = (what: 'made' | 'miss') => () => {
    setWhat(what);
    open({ kind: 'who' });
  };

  // MADE and MISS are the same tile at the same type size. MADE takes the
  // accent AND the accent's ink — the pair is set together, because keeping the
  // ink while losing the fill is exactly how this tile went dark-on-dark.
  const tile = (label: string, made: boolean) => (
    <Press
      onPress={pick(made ? 'made' : 'miss')}
      accessibilityLabel={label}
      // BOTH HALVES ARE NAMED FOR THE WALKTHROUGH, one step each: the tour
      // teaches a missed two and then a made three, so it rings MISS once and
      // MADE once. What it never does is ring both at the same time — a ring
      // around a two-way choice is a ring around the strip, which says nothing
      // the strip does not already say.
      targetId={made ? 'what.made' : 'what.miss'}
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
          ...fUi(600),
          fontSize: m.fsXl,
          letterSpacing: ls(m.fsXl, LS_TITLE),
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
      <PHead>
        <PTitleText>{shotType} shot</PTitleText>
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
        {tile('Made', true)}
        {tile('Miss', false)}
      </View>
    </>
  );
}
