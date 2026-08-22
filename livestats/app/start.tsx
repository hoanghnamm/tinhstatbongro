import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PanelHost } from '../components/panels/PanelHost';
import { Btn, Row as BtnRow } from '../components/panels/shell';
import { Band, Card, Seg, type SegItem } from '../components/stats/parts';
import { ClubCard } from '../components/team/ClubCard';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { Dot } from '../components/ui/Dot';
import { Jersey } from '../components/ui/Jersey';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { chunk } from '../lib/grid';
import { competitionsIn } from '../lib/history';
import { STARTERS, availableIn } from '../lib/roster';
import { COMPETITION_MAX, NOTE_MAX, OPPONENT_MAX, cleanCompetition, competitionKey } from '../lib/team';
import { useGameStore } from '../store/gameStore';
import { useHistoryStore } from '../store/historyStore';
import { useRosterStore } from '../store/rosterStore';
import { useTeamStore } from '../store/teamStore';
import { useUiStore } from '../store/uiStore';
import { useMetrics } from '../theme/metrics';
import { LS_LABEL, LS_MICRO, LS_TITLE, fNum, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { GameKind, RosterPlayer } from '../types';

/**
 * STEP ZERO OF A GAME — and it wears the TEAM tab's layout, not a panel's.
 *
 * It used to be a tile grid inside the foul panel's shell, which was the right
 * shape while the only question was "which five". It is now four questions —
 * who is here, who starts, who it is against, and what kind of night this is —
 * and those are a team screen's questions, so this is the team screen: the same
 * club card, the same columned list, the same 1px seams. A scorer who has used
 * MY TEAM has already used this.
 *
 * WHAT IT DELIBERATELY CANNOT DO IS EDIT THE TEAM. Not the club name, not the
 * crest, not the coaches, not a player's name or position. Those are facts
 * about the club that a scorer settles once, on the tab built for it — and the
 * club name in particular is what this game is about to be FILED UNDER, so
 * renaming it here would rewrite the label on the game being started.
 *
 * The ONE exception is the JERSEY NUMBER, because it is the one thing that
 * changes at the door: a squad turns up in a different set of shirts. It opens
 * `setNumber`, a keypad and nothing else, and it writes to the roster — a new
 * number is true of the player, not only of tonight.
 *
 * The three controls on a row are three separate press targets rather than one
 * row with a menu: the PLATE edits the number, the NAME picks or unpicks a
 * starter, and the DOT is availability — the same toggle it is on the TEAM tab,
 * because it is the same fact an hour later.
 *
 * AN UNAVAILABLE PLAYER STILL SHOWS, dimmed, and cannot be picked. They are on
 * the team and this is the screen where "actually, they made it" is one tap;
 * what they are not is one of the answers to "who is starting". `availableIn`
 * is still the only filter that reaches `buildPlayers`, so an unavailable
 * player never enters the game at all.
 *
 * Leaving without starting is a back tap. Nothing is written until START GAME
 * — except a number and an availability, which are roster edits and are meant
 * to outlive the visit — so arriving here from a live game costs nothing.
 *
 * THE PAGE SCROLLS AND THE LIST DOES NOT, which is the opposite of the TEAM
 * tab and is the right way round here. There is a club card, a roster, a
 * two-field form and a button on this screen, and on a 667×320 phone in
 * landscape they do not fit however they are stacked — so the whole column
 * scrolls and START GAME stays pinned under it, where a thumb can always find
 * it. A `FlatList` inside a `ScrollView` would be two scrollers fighting; the
 * roster is capped at `ROSTER_CAP` anyway, so there is nothing to virtualise
 * and the rows are simply chunked into their columns and laid out.
 */

/**
 * THE TWO KINDS, and the picker opens on OFFICIAL.
 *
 * Not because most games are — because this is the one question on the screen
 * that cannot be answered later. A game filed under the wrong kind is wrong for
 * as long as it is on the shelf: the season either counts a scrimmage or drops
 * a league game, and nothing in the app edits a saved game. Opening on OFFICIAL
 * with the competition still empty means START GAME is dark until the scorer
 * has said one of the two things out loud — typed the competition, or tapped
 * PRACTICE. One tap either way, once a night.
 */
const KINDS: SegItem<GameKind>[] = [
  { key: 'practice', label: 'PRACTICE' },
  { key: 'official', label: 'OFFICIAL' },
];

/** Two columns start here. The same line `team.tsx` and `RotateGate` draw. */
const TWO_UP = 700;
/** …and past it the count is computed, so a 1180pt iPad gets three, not two. */
const COL_W = 340;

/* ---- the pieces ---------------------------------------------------- */

function Label({ children, tone }: { children: string; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: fNum(500),
        fontSize: m.fsXs,
        letterSpacing: ls(m.fsXs, LS_MICRO),
        color: tone ?? t.ink2,
      }}
    >
      {children}
    </Text>
  );
}

function PlayerRow({
  player,
  starting,
  onPick,
  onNumber,
  onAvailable,
}: {
  player: RosterPlayer;
  starting: boolean;
  onPick(): void;
  onNumber(): void;
  onAvailable(): void;
}) {
  const m = useMetrics();
  const t = useTheme();
  const jh = Math.round(m.tap * 0.72);

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: m.tap,
        flexDirection: 'row',
        alignItems: 'center',
        gap: m.s2,
        borderBottomWidth: 1,
        borderBottomColor: t.rule,
        // dimmed, not hidden — they are still on the team, and the dot beside
        // them is still the way to say they turned up after all
        opacity: player.available ? 1 : 0.45,
      }}
    >
      {/* THE PLATE IS THE NUMBER EDITOR, and the only editor on this screen */}
      <Press
        onPress={onNumber}
        accessibilityLabel={`change the number for #${player.number} ${player.name}`}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          minHeight: m.tap,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: m.s2,
          borderRadius: m.rSm,
        }}
        pressedStyle={{ backgroundColor: t.surface2 }}
      >
        <Jersey
          number={player.number}
          w={Math.round(jh * 1.15)}
          h={jh}
          tone={starting ? 'selected' : 'floor'}
        />
      </Press>

      {/* the name is the pick. It takes the rest of the row, so the target for
          the thing done most is everything the other two do not need. */}
      <Press
        onPress={player.available ? onPick : undefined}
        accessibilityLabel={
          player.available
            ? `#${player.number} ${player.name}${starting ? ', starting' : ''}`
            : `#${player.number} ${player.name}, unavailable`
        }
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: m.tap,
          flexDirection: 'row',
          alignItems: 'center',
          gap: m.s2,
          paddingHorizontal: m.s1,
          borderRadius: m.rSm,
        }}
        pressedStyle={{ backgroundColor: t.surface2 }}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            flexShrink: 1,
            minWidth: 0,
            fontFamily: fUi(600),
            fontSize: m.fsMd,
            color: t.ink,
          }}
        >
          {player.name}
        </Text>
        {starting && (
          <View style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
            <Label tone={t.accent}>STARTER</Label>
          </View>
        )}
      </Press>

      {/* and the state, which is the same toggle the TEAM tab draws */}
      <Press
        onPress={onAvailable}
        accessibilityLabel={
          player.available
            ? `mark #${player.number} ${player.name} unavailable`
            : `mark #${player.number} ${player.name} available`
        }
        style={{
          flexGrow: 0,
          flexShrink: 0,
          width: m.tap,
          minHeight: m.tap,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: m.rSm,
        }}
        pressedStyle={{ backgroundColor: t.surface2 }}
      >
        <Dot on={player.available} />
      </Press>
    </View>
  );
}

/**
 * A COMPETITION THE SHELF ALREADY KNOWS, offered under the field.
 *
 * The first game of a season is typed; every game after it is a tap, and that
 * is the whole point — a competition is what thirty games are grouped by, and a
 * group is only a group if the name is spelled the same way each time. The
 * suggestions come off the INDEX, which is already in memory, so offering them
 * costs no disk read.
 *
 * They FILTER as the scorer types and the exact match drops out of the row:
 * a chip that would type nothing new is a target that does nothing.
 */
function Chip({ label, onPress }: { label: string; onPress(): void }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`file this game under ${label}`}
      style={{
        flexGrow: 0,
        flexShrink: 1,
        minWidth: 0,
        minHeight: Math.round(m.tap * 0.72),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: m.s3,
        borderRadius: m.rSm,
        borderWidth: 1,
        borderColor: t.rule,
        backgroundColor: t.surface2,
      }}
      pressedStyle={{ backgroundColor: t.surface }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: t.ink2,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </Press>
  );
}

/** One row of the match card: a label, and the line the scorer types on. */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText(v: string): void;
  placeholder: string;
  maxLength: number;
  onSubmitEditing?(): void;
}) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Row
      gap={m.s3}
      style={{
        minHeight: m.tap,
        paddingHorizontal: m.s3,
        borderTopWidth: 1,
        borderTopColor: t.rule,
      }}
    >
      <View style={{ flexGrow: 0, flexShrink: 0, width: Math.round(m.fsXs * 6.2) }}>
        <Label>{label}</Label>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={t.ink3}
        accessibilityLabel={label}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: m.tap,
          padding: 0,
          color: t.ink,
          fontFamily: fUi(600),
          fontSize: m.fsMd,
        }}
      />
    </Row>
  );
}

/* ---- the screen ----------------------------------------------------- */

/**
 * IT IS DARK, WITH THE FOUR ROOMS, and it is not one of them.
 *
 * The door into a game is reached from the lobby and read standing in the same
 * place, a minute earlier — a light picker between a dark lobby and a dark
 * TEAM tab was the app blinking once on the way through. So it wears `DarkRoom`
 * and draws the same `<Bloom />`, while staying OUTSIDE the tab group: it is a
 * page you go into and come back out of, and it has a back arrow rather than a
 * fifth tab.
 *
 * Nothing else on it changed. Every colour here was already a token, so the
 * fields, the chips, the seams, `ClubCard` and `Seg` all followed on their own
 * — and `ClubCard` is the proof that the `readOnly` card and the TEAM tab's
 * editable one are still one component.
 *
 * START GAME takes the `bloom` variant, the same as NEW GAME on the lobby: it
 * is the same verb one screen later, and the two are the only buttons in the
 * app that start something.
 */
function StartScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  // EVERY player, not only the available ones. The filter that matters is
  // still `availableIn`, and it is applied at the one crossing — `startGame`
  // below — so an unavailable player is shown here and never reaches the game.
  const roster = useRosterStore((s) => s.players);
  const update = useRosterStore((s) => s.update);
  const startGame = useGameStore((s) => s.startGame);
  const open = useUiStore((s) => s.open);
  // the name the game will be filed under, read at tip-off and copied
  const teamName = useTeamStore((s) => s.profile.name);

  // the shelf, for the names it already holds — summaries only, no disk read
  const index = useHistoryStore((s) => s.index);
  const known = useMemo(() => competitionsIn(index), [index]);

  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<GameKind>('official');
  const [competition, setCompetition] = useState('');
  const [opponent, setOpponent] = useState('');
  const [note, setNote] = useState('');

  // what is left to offer: everything the typed text is a prefix or a fragment
  // of, minus the one it already spells exactly
  const typed = competitionKey(competition);
  const suggestions = known.filter((name) => {
    const key = competitionKey(name);
    return key !== typed && (!typed || key.includes(typed));
  });

  const toggle = (id: string) =>
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : // at five, a sixth tap is IGNORED rather than swapping someone out
          // silently — the scorer has to say who leaves
          cur.length >= STARTERS
          ? cur
          : [...cur, id],
    );

  // turning a player off has to take them off the floor with them, or START
  // GAME would send five ids in where one of them is no longer selectable
  const setAvailable = (p: RosterPlayer) => {
    update(p.id, { available: !p.available });
    if (p.available) setPicked((cur) => cur.filter((x) => x !== p.id));
  };

  // AN OFFICIAL GAME IS NOT STARTED WITHOUT A COMPETITION. It is the label the
  // season groups by and there is no editing it afterwards, so the picker is
  // the only place it can be asked — and PRACTICE is the one tap that says the
  // question does not apply.
  const filed = kind === 'practice' || !!cleanCompetition(competition);
  const ready = picked.length === STARTERS && filed;

  const usable = m.win.w - safe.left - safe.right - 2 * m.s4;
  const columns = usable >= TWO_UP ? Math.max(2, Math.floor(usable / COL_W)) : 1;

  const rows = chunk(roster, columns);

  const start = () => {
    if (!ready) return;
    startGame(availableIn(roster), picked, teamName, { kind, competition, opponent, note });
    // replace, not push: back off the board goes home, not to a picker for a
    // game that has already started
    router.replace('/game');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {/* outside the padded view below, so it runs under the safe-area inset */}
      <Bloom />

      <View
        style={{
          flex: 1,
          paddingTop: safe.top + m.s2,
          paddingBottom: safe.bottom + m.s3,
          paddingLeft: safe.left + m.s4,
          paddingRight: safe.right + m.s4,
        }}
      >
        {/* this screen is pushed, not a tab root, so it owns its way out */}
        <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
          <Press
            onPress={() => router.back()}
            accessibilityLabel="back, start no game"
            style={{
              flexGrow: 0,
              flexShrink: 0,
              width: m.tap,
              minHeight: m.tap,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -m.s2,
              borderRadius: m.rSm,
            }}
            pressedStyle={{ backgroundColor: t.surface2 }}
          >
            <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
              <Path
                d="M15 5l-7 7 7 7"
                stroke={t.ink2}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Press>

          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fNum(700),
              fontSize: m.fsXl,
              letterSpacing: ls(m.fsXl, LS_TITLE),
              color: t.ink,
            }}
          >
            NEW GAME
          </Text>
        </Row>

        <ScrollView
          style={{ flex: 1, marginTop: m.s2 }}
          contentContainerStyle={{ paddingBottom: m.s2 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* who this board belongs to, and it is not editable from here */}
          <ClubCard readOnly />

          <Row gap={m.s2} style={{ minHeight: m.tap, marginTop: m.s3 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontFamily: fNum(700),
                fontSize: m.fsMd,
                letterSpacing: ls(m.fsMd, LS_LABEL),
                color: t.ink2,
              }}
            >
              STARTING FIVE
            </Text>

            <Text
              style={{
                marginLeft: 'auto',
                flexGrow: 0,
                flexShrink: 0,
                fontFamily: fNum(500),
                fontSize: m.fsMd,
                color: ready ? t.accent : t.ink2,
                fontVariant: ['tabular-nums'],
              }}
            >
              {picked.length}/{STARTERS}
            </Text>
          </Row>

          {roster.length ? (
            rows.map((row, i) => (
              <Row key={i} align="stretch" gap={m.s3}>
                {row.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    starting={picked.includes(p.id)}
                    onPick={() => toggle(p.id)}
                    onNumber={() => open({ kind: 'setNumber', playerId: p.id })}
                    onAvailable={() => setAvailable(p)}
                  />
                ))}
                {/* a short last row keeps its cells the width of every other */}
                {Array.from({ length: columns - row.length }, (_, k) => (
                  <View key={'gap' + k} style={{ flex: 1 }} />
                ))}
              </Row>
            ))
          ) : (
            <Col align="center" gap={m.s2} style={{ paddingVertical: m.s6 }}>
              <Text
                style={{
                  fontFamily: fNum(500),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: t.ink3,
                }}
              >
                NO PLAYERS YET
              </Text>
              <Label tone={t.ink3}>ADD THEM ON THE TEAM TAB</Label>
            </Col>
          )}

          {/* THE MATCH — the four things true of this game and of no other.
              THREE of them are optional: a scorer at the buzzer starts the game
              and types none of them, and a blank opponent reads as OPPONENT.
              The COMPETITION is the exception, and only on an official game —
              see `filed` above. */}
          <View style={{ marginTop: m.s3 }}>
            <Col gap={m.s2}>
              <Seg items={KINDS} value={kind} onChange={(k) => setKind(k)} />

              <Card>
                <Band label="THE MATCH" />

                {/* the competition field is DRAWN ONLY FOR AN OFFICIAL GAME,
                    not merely disabled: a practice is not filed under anything,
                    and a dead field on the card is a question still being asked */}
                {kind === 'official' && (
                  <>
                    <Field
                      label="LEAGUE"
                      value={competition}
                      onChangeText={setCompetition}
                      placeholder="which competition"
                      maxLength={COMPETITION_MAX}
                    />
                    {suggestions.length > 0 && (
                      <Row
                        gap={m.s2}
                        style={{
                          flexWrap: 'wrap',
                          paddingHorizontal: m.s3,
                          paddingTop: m.s2,
                          paddingBottom: m.s2,
                          borderTopWidth: 1,
                          borderTopColor: t.rule,
                        }}
                      >
                        {suggestions.map((name) => (
                          <Chip key={name} label={name} onPress={() => setCompetition(name)} />
                        ))}
                      </Row>
                    )}
                  </>
                )}

                <Field
                  label="OPPONENT"
                  value={opponent}
                  onChangeText={setOpponent}
                  placeholder="who you are playing"
                  maxLength={OPPONENT_MAX}
                />
                <Field
                  label="NOTE"
                  value={note}
                  onChangeText={setNote}
                  placeholder="round, venue, anything"
                  maxLength={NOTE_MAX}
                  onSubmitEditing={start}
                />
              </Card>
            </Col>
          </View>
        </ScrollView>

        {/* the one reason START GAME can be dark that is not the five — said
            out loud, because a dark button with no explanation is a bug */}
        {!filed && (
          <Text
            // two lines, because the narrowest board this runs on is 330 wide
            // and a truncated reason is worse than no reason
            numberOfLines={2}
            style={{
              marginTop: m.s2,
              textAlign: 'center',
              fontFamily: fNum(500),
              fontSize: m.fsXs,
              letterSpacing: ls(m.fsXs, LS_MICRO),
              color: t.danger,
            }}
          >
            NAME THE COMPETITION, OR MARK IT A PRACTICE
          </Text>
        )}

        <BtnRow mt>
          {/* the same lit fill the lobby's NEW GAME wears — one verb, two
              screens, and this is the second half of it */}
          <Btn label="START GAME" variant="bloom" disabled={!ready} onPress={start} />
        </BtnRow>
      </View>

      {/* the number keypad opens from here, so this screen needs the router */}
      <PanelHost />
    </KeyboardAvoidingView>
  );
}

/** The palette and the status bar, from the same wrapper the tab group uses. */
export default function Start() {
  return (
    <DarkRoom>
      <StartScreen />
    </DarkRoom>
  );
}
