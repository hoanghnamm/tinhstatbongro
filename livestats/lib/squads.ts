/**
 * THE TEAMS INSIDE THE CLUB, as plain functions over plain data — the same
 * side of the line `roster.ts` and `team.ts` are on, so `npm run check` runs
 * every rule here without React, Zustand or a device.
 *
 * ## WHAT CHANGED, AND WHY THE OLD RULE IS GONE
 *
 * `TEAM is singular` was a stated decision and it read: *a plural label
 * promises a switcher that does not exist*. The switcher exists now. A club
 * that runs a first team and a second team was keeping two seasons in one
 * shelf, one MVP over two sets of players, and one twenty-name roster it had
 * to remember the halves of. The promise is kept rather than withdrawn.
 *
 * ## THREE LAYERS, AND THEY ARE NOT THE SAME THING
 *
 *   the CLUB    `teamStore` — one name, one crest, two coaches. Unchanged, and
 *               still the only thing whose NAME crosses into a game.
 *   the POOL    `rosterStore` — every player the club has, capped at
 *               `ROSTER_CAP`. Still one flat list, still the durable half of a
 *               person: a jersey and a name.
 *   the TEAMS   here — at most `SQUAD_CAP` of them, each a name and a list of
 *               POOL IDS. A team owns no players; it REFERS to them.
 *
 * That last line is the whole design. A drafted player is not copied into a
 * team the way a `Player` is copied out of the pool at tip-off — they are
 * pointed at. Fixing a spelling on the pool row fixes it on all three teams,
 * which is what a scorer means by "the same player".
 *
 * ## A PLAYER MAY BE ON SEVERAL TEAMS
 *
 * Membership is a LIST ON THE TEAM, not a tag on the player, and that is the
 * reason: a club lends a player up to the first team for a cup tie without
 * taking them off the second, and a single `squadId` field on `RosterPlayer`
 * would make that impossible to say. The tag a row shows is DERIVED — see
 * `tagsFor` — so the two directions can never disagree, which is exactly what
 * a stored tag beside a stored list would eventually do.
 *
 * ## AND A CLUB THAT HAS NEVER HEARD OF TEAMS HAS ONE
 *
 * `squadsIn` is the reason there is no migration step, no ordering problem
 * between two stores rehydrating, and no empty first run: a club with no teams
 * saved reads as a club with ONE team called `Team 1` holding the whole pool.
 * The id is fixed (`FIRST_SQUAD`), so a game stamped before this existed and a
 * game stamped after it land in the same place. The store materialises that
 * derived team the first time anybody writes.
 */
import { ROSTER_CAP } from './roster';
import type { RosterPlayer, Squad } from '../types';

/**
 * THREE TEAMS. Past that a club is running an academy, and every screen here —
 * a strip of chips under the club card, one season line, one shelf — is built
 * for a number a scorer can hold in their head.
 */
export const SQUAD_CAP = 3;

/**
 * Fifteen to a team, which is FIBA's sheet. The board dresses whoever is
 * available and sits the rest, so this is the cap on a team sheet rather than
 * on a rail.
 */
export const SQUAD_SIZE = 15;

/** A chip under the club card, and a line in the picker. Both truncate here. */
export const SQUAD_NAME_MAX = 20;

/**
 * THE ID THE DERIVED FIRST TEAM CARRIES, and it is a constant rather than a
 * fresh id on purpose: every game saved before teams existed is filed under
 * this one, so the value has to survive the store materialising it. See
 * `squadIdOf`.
 */
export const FIRST_SQUAD = 'sq1';

const clean = (s: string, max: number): string => s.trim().replace(/\s+/g, ' ').slice(0, max);

export const cleanSquadName = (name: string): string => clean(name, SQUAD_NAME_MAX);

/** `Team 1`, `Team 2`, `Team 3` — the lowest one nobody is called yet. */
export function nextSquadName(squads: Squad[]): string {
  const taken = new Set(squads.map((s) => s.name.toLowerCase()));
  for (let n = 1; n <= SQUAD_CAP + 1; n++) {
    const name = `Team ${n}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `Team ${squads.length + 1}`;
}

/** A team id that cannot collide with `FIRST_SQUAD` or with a sibling tap. */
let seq = 0;
export const newSquadId = (): string =>
  's' + Date.now().toString(36) + (seq++).toString(36);

/**
 * THE TEAMS AS EVERY SCREEN MUST READ THEM.
 *
 * A club with none saved has one, it is called `Team 1`, and it holds the
 * whole pool — which is precisely what a club that has never split into teams
 * already had. Nothing on any screen has to branch on "no teams yet", and the
 * first write materialises exactly what was already being drawn.
 */
export function squadsIn(squads: Squad[], roster: RosterPlayer[]): Squad[] {
  if (squads.length) return squads;
  return [{ id: FIRST_SQUAD, name: 'Team 1', playerIds: roster.map((p) => p.id) }];
}

/** The team being looked at — the saved choice, or the first one. */
export function activeIn(squads: Squad[], activeId: string): Squad {
  return squads.find((s) => s.id === activeId) ?? squads[0];
}

/**
 * The team's players, IN POOL ORDER and not in draft order.
 *
 * The pool is the list the scorer maintains and the order they put it in; a
 * team sheet that reordered itself by whoever was drafted last would be a
 * second, disagreeing arrangement of the same fifteen names. Ids with no pool
 * row behind them are dropped, which is what makes deleting a pool player safe
 * without walking every team.
 */
export function membersOf(squad: Squad | undefined, roster: RosterPlayer[]): RosterPlayer[] {
  if (!squad) return [];
  const ids = new Set(squad.playerIds);
  return roster.filter((p) => ids.has(p.id));
}

/** Is this player drafted to this team? */
export const draftedIn = (squad: Squad | undefined, playerId: string): boolean =>
  !!squad && squad.playerIds.includes(playerId);

/**
 * EVERY TEAM THIS PLAYER IS ON — the tags a pool row shows, derived from the
 * membership lists so the two can never drift apart.
 */
export const tagsFor = (squads: Squad[], playerId: string): Squad[] =>
  squads.filter((s) => s.playerIds.includes(playerId));

/**
 * Draft, or un-draft, one player. Pure, and it REFUSES rather than clamps: a
 * team already at `SQUAD_SIZE` is handed back unchanged, so the caller can say
 * so instead of silently dropping somebody.
 */
export function toggleDraft(squads: Squad[], squadId: string, playerId: string): Squad[] {
  return squads.map((s) => {
    if (s.id !== squadId) return s;
    if (s.playerIds.includes(playerId)) {
      return { ...s, playerIds: s.playerIds.filter((id) => id !== playerId) };
    }
    if (s.playerIds.length >= SQUAD_SIZE) return s;
    return { ...s, playerIds: [...s.playerIds, playerId] };
  });
}

/**
 * WHICH TEAM A SAVED ROW BELONGS TO.
 *
 * A row written before teams existed carries no id, and the honest answer is
 * the FIRST team — that is the team the club was, and the one every one of
 * those games was played by. It is the same call `summaryKind` makes about a
 * game saved before the two kinds: default to what it already was, never to
 * nothing, or a month of games would vanish off every screen at once.
 */
export const squadIdOf = (row: { squadId?: string }): string => row.squadId || FIRST_SQUAD;

/**
 * The rows one team played. Applied AT THE SCREEN, the way `officialIn` is and
 * for the same reason: the aggregates below it are also what one competition's
 * page is built from, and that page has already filtered.
 */
export const squadIn = <T extends { squadId?: string }>(rows: T[], squadId: string): T[] =>
  rows.filter((r) => squadIdOf(r) === squadId);

/**
 * A team read back off disk.
 *
 * Loose the way `migrateRoster` is loose: whatever a file or an older build
 * left behind is folded back onto the invariants the store's own writers hold
 * — no duplicate ids on one sheet, no sheet over `SQUAD_SIZE`, no more than
 * `SQUAD_CAP` sheets, and never a nameless team.
 *
 * `roster` IS OPTIONAL, AND OMITTING IT IS THE NORMAL CASE. Checking ids
 * against the pool sounds like the safer default and is the opposite: this
 * runs on rehydrate, `rosterStore` rehydrates independently, and a pool that
 * has not landed yet would look like a club with no players — which would
 * empty every team on the launch that raced. Nothing needs the check anyway:
 * `membersOf` resolves ids through the pool on the way out, so an id with no
 * player behind it is already invisible. Pass a roster only where one is known
 * to be in hand and the ids should be pruned for good.
 */
export function migrateSquads(raw: unknown, roster?: RosterPlayer[]): Squad[] {
  if (!Array.isArray(raw)) return [];
  const known = roster ? new Set(roster.map((p) => p.id)) : null;
  const out: Squad[] = [];
  for (const entry of raw.slice(0, SQUAD_CAP)) {
    const s = entry as Partial<Squad>;
    const id = typeof s.id === 'string' && s.id ? s.id : newSquadId();
    const ids = Array.isArray(s.playerIds) ? s.playerIds.map(String) : [];
    const seen = new Set<string>();
    const playerIds: string[] = [];
    for (const pid of ids) {
      if ((known && !known.has(pid)) || seen.has(pid) || playerIds.length >= SQUAD_SIZE) continue;
      seen.add(pid);
      playerIds.push(pid);
    }
    out.push({
      id,
      name: cleanSquadName(String(s.name ?? '')) || nextSquadName(out),
      playerIds,
    });
  }
  return out;
}

/**
 * CAN THIS TEAM BE DELETED?
 *
 * Only when nothing on the shelf was played by it. A team's games carry its id
 * and nothing else does, so deleting a team with games behind it would strand
 * every one of them where no screen could reach them — and the shelf is the
 * one thing in this app that cannot be rebuilt from anything else. The button
 * is GONE rather than disabled where this is false, the same way `+ ADD PLAYER`
 * is gone at the cap, and the count beside it is what says why.
 *
 * The last team standing cannot go either: a club is at least one team, and
 * `squadsIn` would simply draw it again on the next render.
 */
export function canRemoveSquad(
  squads: Squad[],
  squadId: string,
  rows: { squadId?: string }[],
): boolean {
  if (squads.length <= 1) return false;
  if (!squads.some((s) => s.id === squadId)) return false;
  return !rows.some((r) => squadIdOf(r) === squadId);
}

/** How many of the pool are on no team at all — the count the draft panel leads with. */
export const undraftedIn = (squads: Squad[], roster: RosterPlayer[]): RosterPlayer[] =>
  roster.filter((p) => !squads.some((s) => s.playerIds.includes(p.id)));

/** The pool cap, re-exported so a screen about teams imports one module. */
export { ROSTER_CAP };
