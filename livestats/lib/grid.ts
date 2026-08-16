export interface Grid {
  columns: number;
  rows: number;
  /** the smallest side of a resulting cell, in px — what the search maximises */
  min: number;
}

/**
 * How many columns n tiles want inside a box. Never a hardcoded five: every
 * column count yields cells of the same area, so the only thing to choose
 * between them is shape — take the one whose smallest side is largest. That is
 * "as big as possible" in one line, and it is also the shape most likely to
 * clear the tap floor, so a separate 44pt filter would only ever pick a worse
 * grid. The panel cannot scroll, so this always returns a shape rather than
 * giving up.
 */
export function gridFor(n: number, boxW: number, boxH: number, tap: number): Grid {
  const h = boxH - tap; // minus the header row
  let best: Grid = { columns: 1, rows: Math.max(1, n), min: 0 };
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const min = Math.min(boxW / c, h / r);
    if (min > best.min) best = { columns: c, rows: r, min };
  }
  return best;
}

/** Chunk a list into the rows a Grid describes, so the last row can be short. */
export function chunk<T>(items: T[], columns: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += columns) out.push(items.slice(i, i + columns));
  return out;
}
