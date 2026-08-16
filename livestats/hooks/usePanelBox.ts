import { courtBox, dockBox, useRects, type Box } from '../store/layoutStore';
import { useMetrics } from '../theme/metrics';

/**
 * The court's own footprint, measured. Panels are placed and the roster grid is
 * fitted off this rather than off the sizing constants — the layout arithmetic
 * already lives in metrics.ts and in the flex tree, and a third copy is how the
 * three drift apart.
 */
export function useCourtBox(): Box {
  const m = useMetrics();
  const rects = useRects();
  return (
    courtBox(rects) ?? {
      left: 0, top: 0, right: m.win.w, bottom: m.win.h, w: m.win.w, h: m.win.h,
    }
  );
}

export function useDockBox(): Box {
  const m = useMetrics();
  const rects = useRects();
  return (
    dockBox(rects) ?? {
      left: 0, top: 0, right: m.win.w, bottom: m.win.h, w: m.win.w, h: m.win.h,
    }
  );
}
