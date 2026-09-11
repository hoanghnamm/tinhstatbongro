import { Store } from '../platform/storage';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_TEAM, cleanCoach, cleanTeamName, logoName, migrateTeam } from '../lib/team';
import type { TeamProfile } from '../types';

/**
 * THE CLUB — the other durable half of "my team".
 *
 * `rosterStore` holds the people and this holds everything else about the team
 * that outlives a game: the name, the crest, and the two coaches. They are two
 * stores rather than one because they are two different kinds of thing to keep
 * — a list with a cap and a duplicate rule, and a record with a file attached —
 * and because the file is the part with a lifecycle nothing else here has.
 *
 * Only the NAME crosses into a game, and `startGame` copies it the way
 * `buildPlayers` copies a jersey. The crest and the coaches stay: they are true
 * of the club today, not of a game that is already over.
 */
export interface TeamState {
  profile: TeamProfile;

  /** The three text fields. The crest has its own writer — it owns a file. */
  setProfile(patch: Partial<Omit<TeamProfile, 'logoUri'>>): void;

  /**
   * Copy a picked image into the document directory and point the crest at it.
   *
   * The URI the picker returns lives in the CACHE, which the OS empties when
   * storage runs low, so keeping it would be a crest that disappears on a bad
   * morning. Returns false if the copy failed, so the panel can say so rather
   * than silently keeping the old one.
   */
  setLogo(sourceUri: string): Promise<boolean>;
  clearLogo(): void;
}

/** One folder, so the crest is never mixed in with anything else. */
const dir = (): Directory => new Directory(Paths.document, 'team');

/** Deleting is best-effort everywhere: a crest is not worth throwing over. */
const drop = (uri: string | null): void => {
  if (!uri) return;
  if (Platform.OS === 'web') return; // the PNG lives in the persisted profile
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* the old crest outliving its replacement is a wasted kilobyte, not a bug */
  }
};

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      profile: { ...DEFAULT_TEAM },

      setProfile: (patch) => {
        const p = get().profile;
        set({
          profile: {
            ...p,
            name: patch.name === undefined ? p.name : cleanTeamName(patch.name) || p.name,
            coach: patch.coach === undefined ? p.coach : cleanCoach(patch.coach),
            assistant:
              patch.assistant === undefined ? p.assistant : cleanCoach(patch.assistant),
          },
        });
      },

      setLogo: async (sourceUri) => {
        try {
          if (Platform.OS === 'web') {
            const { webLogo } = await import('../platform/webLogo');
            const logoUri = await webLogo(sourceUri);
            // Check the actual write before replacing the old crest. Storage
            // quota failure must leave the previous profile usable.
            const profile = { ...get().profile, logoUri };
            await Store.write('hooplog-team', JSON.stringify({ state: { profile }, version: 1 }));
            set({ profile });
            return true;
          }
          const folder = dir();
          if (!folder.exists) folder.create({ intermediates: true, idempotent: true });

          const target = new File(folder, logoName(sourceUri));
          new File(sourceUri).copy(target);

          const previous = get().profile.logoUri;
          set({ profile: { ...get().profile, logoUri: target.uri } });
          // only after the new one is in place — a failed copy must not leave
          // the club with no crest at all
          drop(previous);
          return true;
        } catch {
          return false;
        }
      },

      clearLogo: () => {
        const previous = get().profile.logoUri;
        set({ profile: { ...get().profile, logoUri: null } });
        drop(previous);
      },
    }),
    {
      name: 'hooplog-team',
      storage: createJSONStorage(() => Store),
      version: 1,
      migrate: (persisted) => ({
        profile: migrateTeam((persisted as { profile?: unknown } | undefined)?.profile, Platform.OS === 'web'),
      }),
      onRehydrateStorage: () => (s) => {
        if (!s) return;
        s.profile = migrateTeam(s.profile, Platform.OS === 'web');
        // THE PATH IS CHECKED, NOT TRUSTED. iOS moves the document directory
        // between installs and a restore can bring the record back without the
        // file, and a dead URI renders as a broken square where the monogram
        // would have rendered as a crest.
        const uri = s.profile.logoUri;
        if (uri && Platform.OS !== 'web') {
          try {
            if (!new File(uri).exists) s.profile.logoUri = null;
          } catch {
            s.profile.logoUri = null;
          }
        }
      },
    },
  ),
);
