import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAnnounce } from '../../hooks/useAnnounce';
import { SQUAD_SIZE, activeIn, draftedIn, squadsIn, tagsFor } from '../../lib/squads';
import { useRosterStore } from '../../store/rosterStore';
import { useSquadStore } from '../../store/squadStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_MICRO, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Jersey } from '../ui/Jersey';
import { Press } from '../ui/Press';
import { Btn, PEmpty, PTitle, PanelScroll, Row } from './shell';

/**
 * THE DRAFT — the whole pool, with a tick against everyone on this team.
 *
 * It is the one place membership is written, and it is a panel rather than a
 * screen because drafting is a thing you do TO the team you are already
 * looking at: the TEAM tab shows one team's sheet, and this is the pool it is
 * drawn from, opened over it and closed again.
 *
 * ## IT TOGGLES, IN BOTH DIRECTIONS
 *
 * The same row that drafts a player un-drafts them, which is why there is no
 * REMOVE anywhere on the TEAM tab's rows. A destructive control a thumb's
 * width from two text fields is what got the roster row's `×` cut, and taking
 * a player off a team is not destructive anyway — the pool row, the name, the
 * jersey and every game they have played all stand. Nothing is deleted; a
 * pointer is dropped.
 *
 * ## THE OTHER TEAMS' TAGS ARE SHOWN, AND THEY ARE NOT A WARNING
 *
 * A player already on Team 1 shows that tag while being drafted to Team 2, and
 * the draft goes through: a club lends a player up for a cup tie without
 * taking them off their own side, which is the whole reason membership is a
 * list on the team rather than a `squadId` on the player. The tag is there so
 * the scorer knows what they are looking at, not to stop them.
 *
 * ## AND THE CAP REFUSES RATHER THAN CLAMPS
 *
 * `toggleDraft` hands back an unchanged list at `SQUAD_SIZE` — see
 * `lib/squads.ts` — so a full sheet simply does not take another name and the
 * count in the title is what says why. It is the same answer `recordFoul`
 * gives a sixth foul: the rule lives in `lib/`, and the panel reports it.
 */
export function DraftPanel() {
  const m = useMetrics();
  const t = useTheme();

  const roster = useRosterStore((s) => s.players);
  const saved = useSquadStore((s) => s.squads);
  const activeId = useSquadStore((s) => s.activeId);
  const draft = useSquadStore((s) => s.draft);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);

  const squads = squadsIn(saved, roster);
  const squad = activeIn(squads, activeId);
  const count = squad?.playerIds.length ?? 0;
  const full = count >= SQUAD_SIZE;

  useAnnounce(squad ? `draft players into ${squad.name}` : 'draft players');

  const jh = Math.round(m.tap * 0.62);
  const jw = Math.round(jh * 1.15);

  return (
    <>
      <PTitle title={squad ? `Draft into ${squad.name}` : 'Draft'} kind={`${count}/${SQUAD_SIZE}`} />

      {roster.length === 0 ? (
        <PEmpty>
          <Text style={{ ...fUi(500), fontSize: m.fsMd, color: t.ink2, textAlign: 'center' }}>
            The pool is empty. Add players on the team screen first.
          </Text>
        </PEmpty>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          <PanelScroll>
            {roster.map((p) => {
              const on = draftedIn(squad, p.id);
              // every OTHER team this player is on — the tag, derived, so it
              // can never disagree with the list it came from
              const elsewhere = tagsFor(squads, p.id).filter((s) => s.id !== squad?.id);
              const who = p.name || `#${p.number}`;

              return (
                <Press
                  key={p.id}
                  onPress={() => {
                    if (!squad) return;
                    if (!on && full) {
                      say(`${squad.name} is full at ${SQUAD_SIZE}`, true);
                      return;
                    }
                    draft(squad.id, p.id);
                  }}
                  accessibilityLabel={
                    on ? `take ${who} off ${squad?.name}` : `draft ${who} into ${squad?.name}`
                  }
                  style={{
                    minHeight: m.tap,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: m.s2,
                    paddingHorizontal: m.s2,
                    borderBottomWidth: 1,
                    borderBottomColor: t.rule,
                    // a full sheet dims the rows it will not take, the way an
                    // unavailable roster row dims — still readable, still
                    // tappable, and the tap says why
                    opacity: !on && full ? 0.45 : 1,
                  }}
                  pressedStyle={{ backgroundColor: t.surface2 }}
                >
                  <Jersey number={p.number} w={jw} h={jh} />

                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      ...fUi(600),
                      fontSize: m.fsMd,
                      color: t.ink,
                    }}
                  >
                    {p.name || `Player ${p.number}`}
                  </Text>

                  {elsewhere.map((s) => (
                    <Text
                      key={s.id}
                      numberOfLines={1}
                      style={{
                        flexGrow: 0,
                        flexShrink: 0,
                        ...fUi(500),
                        fontSize: m.fs2xs,
                        letterSpacing: ls(m.fs2xs, LS_MICRO),
                        color: t.ink3,
                      }}
                    >
                      {s.name}
                    </Text>
                  ))}

                  <View
                    style={{
                      flexGrow: 0,
                      flexShrink: 0,
                      width: m.tap * 0.6,
                      alignItems: 'center',
                    }}
                  >
                    <MaterialCommunityIcons
                      name={on ? 'check-circle' : 'circle-outline'}
                      size={m.fsLg}
                      color={on ? t.accent : t.ink3}
                    />
                  </View>
                </Press>
              );
            })}
          </PanelScroll>
        </View>
      )}

      {/* the pool's own count, under the list it belongs to — the sheet's is
          in the title, and the two are different numbers */}
      <Text
        style={{
          marginTop: m.s2,
          ...fNum(500),
          fontSize: m.fsSm,
          letterSpacing: ls(m.fsSm, LS_TIGHT),
          color: t.ink2,
          fontVariant: ['tabular-nums'],
        }}
      >
        {roster.length} in the pool
      </Text>

      <Row>
        <Btn label="Done" variant="accent" onPress={reset} />
      </Row>
    </>
  );
}
