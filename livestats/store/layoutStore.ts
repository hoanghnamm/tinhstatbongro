import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

/**
 * Real boxes, measured in window coordinates. Three panels are positioned off
 * these rather than off the sizing constants: the layout arithmetic already
 * lives in metrics.ts and in the flex tree, and a third copy is how the three
 * drift apart. Only the board writes here.
 */
/**
 * `lit` is not a place on the board — it is whichever ONE control is currently
 * holding the lit fill, whatever that turns out to be. The scrim cuts its hole
 * there, so a single slot is all it can ever need: two controls are never lit
 * at once, and a key per control would be nine names for one question.
 */
export type RectKey = 'board' | 'court' | 'rail' | 'sidecol' | 'oppbtns' | 'footer' | 'lit';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  w: number;
  h: number;
}

interface LayoutState {
  rects: Partial<Record<RectKey, Rect>>;
  setRect(key: RectKey, rect: Rect): void;
  /** only `lit` uses this: a control that goes dark has no box to report */
  clearRect(key: RectKey): void;
}

const same = (a: Rect | undefined, b: Rect) =>
  !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const useLayoutStore = create<LayoutState>()((set, get) => ({
  rects: {},
  setRect: (key, rect) => {
    if (same(get().rects[key], rect)) return; // a no-op write would loop the layout
    set({ rects: { ...get().rects, [key]: rect } });
  },
  clearRect: (key) => {
    if (!(key in get().rects)) return;
    const { [key]: _gone, ...rest } = get().rects;
    set({ rects: rest });
  },
}));

/** Attach to the view whose box a panel needs. Re-measures on every layout pass. */
export function useMeasure(key: RectKey) {
  const ref = useRef<View>(null);
  const setRect = useLayoutStore((s) => s.setRect);
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => setRect(key, { x, y, w, h }));
  }, [key, setRect]);
  return { ref, onLayout };
}

/**
 * The lit control reports its own box, so the scrim can leave it out.
 *
 * A fill alone could never do this: the scrim is a 45% black sheet over the
 * whole window, so a "lit" cell under it is multiplied down with everything
 * else — brighter than its neighbours, still plainly dimmed. The only way a
 * control is genuinely NOT dimmed is for the sheet to have a hole in it.
 *
 * It measures on the OFF→ON edge rather than on layout, because becoming lit
 * is not a layout change — the panel opened, the row did not move. `onLayout`
 * is here as well so a rotation mid-panel does not leave the hole behind.
 */
export function useLitRect(on: boolean) {
  const ref = useRef<View>(null);
  const setRect = useLayoutStore((s) => s.setRect);
  const clearRect = useLayoutStore((s) => s.clearRect);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => setRect('lit', { x, y, w, h }));
  }, [setRect]);

  useEffect(() => {
    if (!on) return;
    measure();
    // React runs every cleanup in a commit before any effect, so a control
    // going dark cannot wipe the slot of the one lighting up beside it
    return () => clearRect('lit');
  }, [on, measure, clearRect]);

  return { ref, onLayout: on ? measure : undefined };
}

export const useRects = () => useLayoutStore(useShallow((s) => s.rects));

const box = (r: Rect): Box => ({
  left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h, w: r.w, h: r.h,
});

const mk = (left: number, top: number, right: number, bottom: number): Box => ({
  left, top, right, bottom, w: right - left, h: bottom - top,
});

/**
 * The court's own footprint: from whichever action column is on the left to
 * whichever is on the right, and from the top of the board down to the footer.
 * Portrait stands both columns side by side under the court, so there is
 * nothing to sit between and the board's own box is the answer there.
 */
export function courtBox(rects: Partial<Record<RectKey, Rect>>): Box | null {
  const { board, court, sidecol, oppbtns } = rects;
  if (!board || !court || !sidecol || !oppbtns) return null;
  const b = box(board);
  const pair = [box(oppbtns), box(sidecol)];
  const [lc, rc] = pair[0].left <= pair[1].left ? pair : [pair[1], pair[0]];
  const stacked = lc.right > rc.left; // portrait
  const gap = Math.max(0, box(court).left - lc.right);
  return mk(
    stacked ? b.left : lc.right + gap,
    b.top,
    stacked ? b.right : rc.left - gap,
    b.bottom,
  );
}

/**
 * The complement of that box: the first column to the right of the court out to
 * the rail's outer edge, at the rail's full height, so both side columns go
 * under it and the court never does. Portrait has no column beside the court,
 * so it takes the rail's rows instead.
 */
export function dockBox(rects: Partial<Record<RectKey, Rect>>): Box | null {
  const { board, court, rail, sidecol, oppbtns } = rects;
  if (!board || !court || !rail || !sidecol || !oppbtns) return null;
  const b = box(board), r = box(rail), c = box(court);
  if (r.top >= c.bottom) return mk(b.left, r.top, r.right, r.bottom); // portrait
  const col = [box(sidecol).left, box(oppbtns).left]
    .filter((x) => x >= c.right)
    .sort((m, n) => m - n)[0];
  return mk(col ?? c.right, r.top, r.right, r.bottom);
}

/**
 * How much width the footer must give back while the dock is open. The panel
 * runs the whole height of the column, which is over END; the nav ends at the
 * panel's left edge instead and its four cells re-centre in what is left.
 */
export function dockFooterOverlap(rects: Partial<Record<RectKey, Rect>>): number {
  const d = dockBox(rects);
  const f = rects.footer;
  if (!d || !f) return 0;
  const ftr = box(f);
  const overlaps = d.bottom > ftr.top && d.left < ftr.right;
  return overlaps ? Math.max(0, ftr.right - d.left) : 0;
}
