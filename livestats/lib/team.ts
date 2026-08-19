/**
 * The club's own rules, as plain functions over plain data — the same side of
 * the line `roster.ts` is on, and for the same reason: `npm run check` runs
 * every one of them without React, a store or a device.
 *
 * NOTHING HERE TOUCHES A FILE. The crest is a file on disk and the copying,
 * naming and deleting of it lives in `teamStore`, because `expo-file-system`
 * cannot be imported into a node script. What stays here is what can be
 * decided about a URI without opening it.
 */
import type { TeamProfile } from '../types';

/** The rail, the lobby header and a panel title all truncate at about here. */
export const TEAM_NAME_MAX = 24;
/** Two coach lines sit side by side on a tablet, so they are the same width. */
export const COACH_NAME_MAX = 24;

/**
 * The three labels a GAME carries, which are not the club's — but they are the
 * same kind of thing and are cleaned by the same function, which is why they
 * are here rather than in a fourth lib file. The opponent shares the club's cap
 * because the two sit at the same size on the same scoreline; the note is one
 * line under it and gets a line's worth.
 */
export const OPPONENT_MAX = TEAM_NAME_MAX;
export const NOTE_MAX = 60;
/**
 * A competition's name is a heading on the season screen and a tag on a shelf
 * row, so it gets more room than a club name and less than a note.
 */
export const COMPETITION_MAX = 32;

/** What a fresh install is a club of. The name is the one the board shipped. */
export const DEFAULT_TEAM: TeamProfile = {
  name: 'MY TEAM',
  logoUri: null,
  coach: '',
  assistant: '',
};

const clean = (s: string, max: number): string => s.trim().replace(/\s+/g, ' ').slice(0, max);

export const cleanTeamName = (name: string): string => clean(name, TEAM_NAME_MAX);
export const cleanCoach = (name: string): string => clean(name, COACH_NAME_MAX);
export const cleanOpponent = (name: string): string => clean(name, OPPONENT_MAX);
export const cleanNote = (note: string): string => clean(note, NOTE_MAX);
export const cleanCompetition = (name: string): string => clean(name, COMPETITION_MAX);

/**
 * THE KEY TWO GAMES ARE FILED UNDER THE SAME COMPETITION BY.
 *
 * Case and spacing only — `VBA 2026`, `vba 2026` and `VBA  2026` are one
 * competition, because a scorer typing it again three weeks later will not
 * reproduce their own capitals. Nothing else is normalised: `VBA` and `VBA
 * 2026` are two seasons of one league and the app has no business merging
 * them.
 *
 * The NAME shown for a group is the spelling of its most recent game, never
 * the key — a heading in lower case would be the one thing on the screen that
 * is.
 */
export const competitionKey = (name: string): string => cleanCompetition(name).toLowerCase();

/**
 * What to print where a competition's name goes.
 *
 * UNFILED is for the one case that can produce it: an official game saved
 * before competitions existed. The picker will not start a new official game
 * without a name, so this is a label for history rather than for a gap.
 */
export const competitionLabel = (name: string | undefined): string =>
  (name ?? '').trim().toUpperCase() || 'UNFILED';

/**
 * What to print where the other side's name goes.
 *
 * A game started without one — which is the hurried, ordinary case — reads
 * OPPONENT, the word the board has always used for the number it is beside.
 * Callers that would rather say nothing at all than say OPPONENT test the
 * string themselves; this is for the places that must print something.
 */
export const opponentLabel = (opponent: string | undefined): string =>
  (opponent ?? '').trim().toUpperCase() || 'OPPONENT';

/**
 * The monogram: 'MY TEAM' → 'MT', 'Hanoi' → 'H'.
 *
 * It is the crest when there is no crest, so it is never empty — a club with a
 * blank name still gets a mark rather than an empty circle. Two letters at most,
 * because the third one is unreadable at the size a crest is actually drawn.
 */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/**
 * A club read back off disk.
 *
 * A LOGO URI IS NOT TRUSTED. The document directory's absolute path moves
 * between installs on iOS, and a file can be gone for a dozen ordinary reasons,
 * so anything that is not a `file://` URI is dropped here and the store checks
 * that the file still exists on rehydrate. A crest that fails to load leaves a
 * broken square; the monogram is the fallback and has to be reachable.
 */
export function migrateTeam(raw: unknown): TeamProfile {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TEAM };
  const t = raw as Partial<TeamProfile>;
  const uri = typeof t.logoUri === 'string' && t.logoUri.startsWith('file://') ? t.logoUri : null;
  return {
    name: cleanTeamName(String(t.name ?? DEFAULT_TEAM.name)) || DEFAULT_TEAM.name,
    logoUri: uri,
    coach: cleanCoach(String(t.coach ?? '')),
    assistant: cleanCoach(String(t.assistant ?? '')),
  };
}

/**
 * The file name a picked crest is stored under.
 *
 * It is STAMPED, never `logo.png`, and that is not tidiness: React Native
 * caches an `<Image>` by its URI, so a second crest written to the same path
 * keeps showing the first one until the app is killed. A new name each time is
 * the whole fix, and the old file is deleted by the caller.
 */
export const logoName = (sourceUri: string, at: number = Date.now()): string => {
  const ext = /\.(jpe?g|png|webp|heic|heif)(?:\?|$)/i.exec(sourceUri)?.[1] ?? 'jpg';
  return `crest-${at.toString(36)}.${ext.toLowerCase()}`;
};
