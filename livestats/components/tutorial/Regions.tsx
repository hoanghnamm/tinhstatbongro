import { Text, View } from 'react-native';

import { TUTORIAL_COPY } from '../../constants/tutorial';
import { useRects, type RectKey } from '../../store/layoutStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * STEP ONE, AND IT IS THE ONE STEP THAT WRITES ON THE BOARD RATHER THAN BESIDE
 * IT.
 *
 * Four regions named at once, which breaks the tour's own rule of one control
 * per step for the one case where the rule is wrong: before anything is
 * pointed at, the scorer has to be told what they are looking at, and a screen
 * that introduced the four quarters of the board one at a time would spend four
 * steps saying "and this bit".
 *
 * ## THE BOXES ARE THE BOARD'S OWN
 *
 * `court`, `sidecol`, `rail` and `footer` are already measured into
 * `store/layoutStore.ts` — the panel placement needs them and has needed them
 * since before this existed. Reading them rather than registering four more is
 * the whole reason this component is twenty lines: the board has two layouts
 * and a flippable action column, and there is exactly one arithmetic for where
 * those four things are. A second copy is the third one to drift.
 *
 * A region that has not reported yet is simply not drawn. There is no
 * placeholder and no guess.
 *
 * ## IT DOES NOT DIM AND IT DOES NOT BLOCK
 *
 * The scrim under it is a plain sheet on this step — there is no one control to
 * cut around — so the labels sit on the dimmed board and the outlines say which
 * dimmed thing is which. `pointerEvents="none"` throughout, for the reason
 * every decorative layer in this app carries it: a layer that eats taps is
 * invisible when it goes wrong.
 */
const REGIONS: readonly { key: RectKey; label: string }[] = [
  { key: 'court', label: TUTORIAL_COPY.regions.court },
  { key: 'sidecol', label: TUTORIAL_COPY.regions.sidecol },
  { key: 'rail', label: TUTORIAL_COPY.regions.rail },
  { key: 'footer', label: TUTORIAL_COPY.regions.footer },
];

export function Regions() {
  const m = useMetrics();
  const t = useTheme();
  const rects = useRects();

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {REGIONS.map(({ key, label }) => {
        const r = rects[key];
        if (!r) return null;
        return (
          <View
            key={key}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              borderWidth: 2,
              borderColor: withAlpha(t.accent, 0.75),
              borderRadius: m.rSm,
              alignItems: 'center',
              justifyContent: 'center',
              padding: m.s1,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                textAlign: 'center',
                paddingVertical: 2,
                paddingHorizontal: m.s2,
                borderRadius: m.rSm,
                overflow: 'hidden',
                ...fUi(600),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_LABEL),
                // the pair, both halves: an accent fill takes accent's own ink,
                // and keeping one without the other is how a label goes blank
                backgroundColor: t.accent,
                color: t.accentInk,
              }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
