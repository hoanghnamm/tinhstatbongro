import { View } from 'react-native';

import { useGameStore } from '../../store/gameStore';
import { useMeasure } from '../../store/layoutStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { Center, Col, Row } from '../ui/Row';
import { Court } from './Court';
import { Footer } from './Footer';
import { OppButtons } from './OppButtons';
import { Rail } from './Rail';
import { SideColumn } from './SBtn';

/**
 * Two layouts, keyed on ORIENTATION and never on a width threshold: a 667×320
 * phone in landscape is narrow but must not stack, and an 820×1180 tablet in
 * portrait is wide but must.
 *
 * Landscape is two columns and two rows — the board top-left, the footer under
 * it, and the rail down the whole right edge. The footer therefore stops at the
 * rail rather than running under it, which is what puts the last player at the
 * very bottom of the column; stacking them would cost the court a row it
 * cannot spare.
 *
 * Portrait is one column of three rows: the court with its action bar, then the
 * rail (which absorbs whatever the court could not use), then the footer.
 *
 * The score used to be a strip of its own between the two; it is a cell of the
 * footer now, and `computeMetrics` stopped subtracting it. A row removed here
 * is a subtraction removed there, always — a stale term does not throw, it
 * silently shrinks the court.
 */
export function Board() {
  const m = useMetrics();
  // m.safe, not the raw insets: the left/right ones are capped, and the court
  // arithmetic subtracts the capped pair
  const safe = m.safe;
  const bar = useGameStore((s) => s.options.bar);
  const ended = useGameStore((s) => s.ended);
  const clear = useUiStore((s) => s.clear);
  const open = useUiStore((s) => s.open);

  const board = useMeasure('board');
  const side = useMeasure('sidecol');
  const opp = useMeasure('oppbtns');

  // A foul and a rebound have no court spot, so the in-flight mark is dropped.
  // A free throw DOES — FT_SPOT — and the flow ends on a docked panel with the
  // floor in plain view, so it deliberately does not clear() on the way in.
  const start = (panel: 'foulKind' | 'rebKind' | 'ft') => () => {
    if (ended) return;
    if (panel === 'ft') {
      useUiStore.getState().setWhat('ft');
      open({ kind: 'who' });
      return;
    }
    clear();
    open({ kind: panel });
  };

  const sideCol = (
    <SideColumn
      innerRef={side.ref}
      onLayout={side.onLayout}
      onPf={start('foulKind')}
      onFt={start('ft')}
      onRb={start('rebKind')}
    />
  );

  /**
   * A notch, a Dynamic Island or a home indicator occludes the edge it sits on,
   * and in landscape that is an edge one of the action columns is standing in.
   * `overflow:'hidden'` is the guarantee behind the arithmetic: even if a child
   * mismeasures, it is clipped at the safe box rather than painting under the
   * status bar. The left/right insets here are the capped ones (see SIDE_INSET)
   * — 44pt on both landscape edges was a court's worth of black bars.
   */
  const shell = {
    flex: 1,
    overflow: 'hidden' as const,
    paddingTop: m.sp + safe.top,
    paddingRight: m.sp + safe.right,
    paddingBottom: m.sp + safe.bottom,
    paddingLeft: m.sp + safe.left,
  };

  if (m.portrait) {
    return (
      <Col gap={m.sp} style={shell}>
        <Col innerRef={board.ref} onLayout={board.onLayout} gap={m.sp} align="stretch">
          <Center>
            <Court />
          </Center>
          {/* PF/FT/RB and the three OPP buttons share one bar */}
          <Row gap={m.sp} align="stretch" style={{ minHeight: m.barh }}>
            {sideCol}
            <OppButtons innerRef={opp.ref} onLayout={opp.onLayout} />
          </Row>
        </Col>
        <Rail />
        <Footer />
      </Col>
    );
  }

  return (
    <Row gap={m.sp} align="stretch" style={shell}>
      <Col gap={m.sp} align="stretch" flex={1} style={{ minWidth: 0 }}>
        <View
          ref={board.ref}
          onLayout={board.onLayout}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            gap: m.sp,
            alignItems: 'stretch',
            // markup order is OPP, court, PF/FT/RB, so "right" is the plain
            // order and "left" is the reversal
            flexDirection: bar === 'left' ? 'row-reverse' : 'row',
          }}
        >
          {/* the opponent takes the outer edge: it is the cheapest thing to
              lose a corner of to a notch. The score used to head this column;
              the three buttons have the whole of it now. */}
          <Col
            gap={m.sp}
            align="stretch"
            style={{
              flexGrow: 1, flexShrink: 1, flexBasis: m.oppw,
              minWidth: m.oppw, maxWidth: m.oppw * 2.4,
              minHeight: 0,
            }}
          >
            <OppButtons innerRef={opp.ref} onLayout={opp.onLayout} />
          </Col>

          {/* aspect-locked, and centred on the block axis only: spare width
              must reach flex-grow rather than becoming margin */}
          <View style={{ alignSelf: 'center', flexGrow: 0, flexShrink: 0 }}>
            <Court />
          </View>

          {sideCol}
        </View>
        <Footer />
      </Col>
      <Rail />
    </Row>
  );
}
