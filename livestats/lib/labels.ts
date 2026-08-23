/**
 * What a stat is CALLED on the panel where it is picked.
 *
 * A tile has two slots — a big line and a small one under it — and three ways
 * to fill them from the same pair of strings:
 *
 *   short  DF
 *   full   Defensive
 *   both   DF over Defensive
 *
 * FULL is the default and the reason this exists: the abbreviations are the
 * scorebook's, not the scorer's, and a board that answers "which foul was it"
 * with two letters is asking a question of its own. BOTH is the old look and
 * SHORT is for the scorer who has learnt them and wants the biggest possible
 * target — which is what `word` carries: a WORD in the big slot cannot take the
 * abbreviation's type size, so the tile drops a step and takes two lines.
 *
 * It is a plain function over the option rather than a branch in each panel so
 * the three panels that ask it can never answer differently.
 */
import type { Options } from '../constants/options';

export type LabelMode = Options['labels'];

export interface TileWords {
  /** the dominant line */
  code: string;
  /** the small line under it, when there is one */
  caption?: string;
  /** `code` is a word, not an abbreviation */
  word: boolean;
}

export function tileWords(mode: LabelMode, short: string, full: string): TileWords {
  if (mode === 'short') return { code: short, word: false };
  if (mode === 'both') return { code: short, caption: full, word: false };
  return { code: full, word: true };
}
