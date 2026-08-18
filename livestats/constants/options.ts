/**
 * The web build read these from the query string so a call that could go either
 * way was a switch to try rather than a decision buried in the code. There is
 * no query string here, so they live in the store — and this is the single
 * place a future settings screen would write.
 *
 * `skin` used to be a fifth, and the only one ever exposed. It is gone: the app
 * has one look, the light one, so there is nothing left to store.
 */
export interface Options {
  /** quick: one tap = one attempt | trip: batched 1/2/3/and-1 */
  ft: 'quick' | 'trip';
  /** stats: player row opens the stat sheet | sub: straight to substitution */
  tap: 'stats' | 'sub';
  /** ask: prompt after every made shot | skip: never prompt */
  assist: 'ask' | 'skip';
  /** which edge PF/FT/RB lives on; OPP always takes the other. Landscape only. */
  bar: 'right' | 'left';
}

export const DEFAULT_OPTIONS: Options = {
  ft: 'quick',
  tap: 'stats',
  assist: 'ask',
  bar: 'right',
};
