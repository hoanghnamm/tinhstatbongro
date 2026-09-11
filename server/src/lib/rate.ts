/**
 * A LIMIT ON HOW OFTEN ONE ADDRESS MAY ASK FOR A LINK.
 *
 * In memory, and that is a stated limitation rather than an oversight: it
 * resets on deploy and it does not see across instances. What it is for is the
 * mistyped-address retry loop and the idle scanner, both of which it stops
 * completely. A determined flood is a job for the edge, not for this process,
 * and putting Redis in the dependency list to pretend otherwise would be
 * buying a distributed system to solve a button being pressed twice.
 *
 * The window is a plain map with its own sweep, so nothing accumulates.
 */
export interface Limit {
  /** how many are allowed in the window */
  burst: number;
  /** the window, in ms */
  windowMs: number;
}

export const LINK_LIMIT: Limit = { burst: 5, windowMs: 15 * 60 * 1000 };

export class Window {
  private hits = new Map<string, number[]>();

  constructor(private limit: Limit) {}

  /** true if this one is allowed, and it counts as taken when it is */
  take(key: string, now: number = Date.now()): boolean {
    const since = now - this.limit.windowMs;
    const seen = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (seen.length >= this.limit.burst) {
      this.hits.set(key, seen);
      return false;
    }
    seen.push(now);
    this.hits.set(key, seen);
    return true;
  }

  /** drop everything that has fallen out of every window */
  sweep(now: number = Date.now()): void {
    const since = now - this.limit.windowMs;
    for (const [key, times] of this.hits) {
      const kept = times.filter((t) => t > since);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }
}
