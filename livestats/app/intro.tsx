import { useEffect, useState } from 'react';
import {
  BackHandler,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { MiniBoard } from '../components/intro/MiniBoard';
import {
  Badge,
  FieldLabel,
  Foot,
  Head,
  Taps,
  TextField,
} from '../components/intro/parts';
import { NUM_DONE, RosterRow } from '../components/team/RosterRow';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { GlowText } from '../components/ui/GlowText';
import { HeroArt } from '../components/ui/HeroArt';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { BOARD_STEPS, INTRO_COPY, INTRO_STEPS, TRIAL_GIVES } from '../constants/intro';
import { showPaywall } from '../hooks/useGate';
import { ROSTER_CAP, nextFreeNumber } from '../lib/roster';
import { DEFAULT_TEAM, cleanTeamName } from '../lib/team';
import { useIntroStore } from '../store/introStore';
import { useRosterStore } from '../store/rosterStore';
import { useTeamStore } from '../store/teamStore';
import { useMetrics } from '../theme/metrics';
import { LS_LABEL, LS_MICRO, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * THE DOOR — four steps, once per install.
 *
 * ## WHAT IT IS FOR
 *
 * Two things this app genuinely cannot guess, and two it owes the scorer
 * before they find out the hard way. The club's NAME, because every game is
 * filed under it and the crest falls back to it. WHO is on the team, because
 * the board is five rows and a fresh install seeds five numbered shirts. Then
 * the BOARD, which is two taps per stat and looks like nothing else on a
 * phone; and the TRIAL, which is one free game and had better be said out loud
 * before it is spent.
 *
 * The order is the argument: the two that ask come first, and the two that
 * only tell come last, so the scorer who taps straight through has still
 * answered everything the app needed.
 *
 * THERE WAS A THIRD ASKING STEP and it is CUT — *Your league, your rules*, the
 * `periods`/`periodLen` pair plus a readout of the four settings that are not
 * stamped. See `INTRO_STEPS`: those two are still asked, on `app/settings.tsx`,
 * which is one tap off the lobby and deliberately not gated. This screen no
 * longer touches `gameStore` at all.
 *
 * ## ONE ROUTE, FOUR STEPS — NOT FOUR ROUTES
 *
 * `step` is a number in this component's own state. Four routes would be four
 * files sharing one foot and one progress row, and a stack a scorer could back
 * into halfway — which on a door is exactly the thing that must not happen.
 * There is no back BUTTON for the same reason there are no tappable dots: the
 * one step that requires an answer is the first, so going back is undoing work
 * rather than correcting it. Android's hardware back still steps back, because
 * that gesture is the platform's and not this screen's to take away.
 *
 * ## IT IS REACHED BY `replace` AND IT LEAVES BY `replace`
 *
 * `hooks/useIntro.ts` puts a scorer here from the lobby, once, with the LAUNCH
 * PAGE still over the top so the lobby underneath is never seen. The last step
 * leaves the same way — onto `/start`, because the verb on it says so and
 * because a door you can walk back into is not a door.
 *
 * ## WHAT IT DOES NOT DO
 *
 * It does not build a game, and it does not touch `gameStore` at all. It
 * writes to `teamStore` and `rosterStore` — the two
 * stores that OUTLIVE every game — through their own writers, so a scorer who
 * later opens the TEAM tab finds exactly what they typed here, in the same
 * rows, edited the same way. The roster step IS `components/team/RosterRow.tsx`
 * for that reason: the door and the tab are the same editor.
 */

/** The column's own measure. The same line every other room in the app draws. */
const MEASURE = 700;

/** How much of the window the trial step's photograph takes. The paywall's. */
const ART_H = 0.36;

/* ---- the pieces ---------------------------------------------------- */

/**
 * ONE OF THE FOUR NUMBERED LINES UNDER THE MINIATURE BOARD: the badge, the
 * thing you tap, how many taps it is, and what comes out.
 *
 * The badge is the SECOND drawing of a number already on the picture above,
 * which is what stops the list reading as prose beside a screenshot.
 */
function BoardLine({ n, title, taps, blurb, live }: (typeof BOARD_STEPS)[number]) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Row gap={m.s3} align="flex-start">
      <View style={{ paddingTop: 2 }}>
        <Badge n={n} live={live} />
      </View>
      <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Row gap={m.s2}>
          <Text
            style={{
              ...fUi(600),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink,
            }}
          >
            {title}
          </Text>
          <Taps label={taps} />
        </Row>
        <Text
          style={{
            ...fUi(400),
            fontSize: m.fsXs,
            lineHeight: m.fsXs * 1.45,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink2,
          }}
        >
          {blurb}
        </Text>
      </Col>
    </Row>
  );
}

/**
 * ONE OF THE THREE THINGS THE FREE GAME GIVES: a glyph, a noun, a sentence.
 *
 * It is NOT the paywall's `Benefit`, which is one sentence with its noun set
 * bold inside it. This one is a title over a line, because these three are
 * things the scorer ALREADY HAS rather than things being offered — a list of
 * what is yours reads as a list, and a list of what could be reads as a pitch.
 * The two sit one tap apart on this step, and they are meant to read
 * differently.
 */
function Gift({ icon, title, blurb }: (typeof TRIAL_GIVES)[number]) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Row gap={m.s3} align="flex-start">
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={m.fsLg}
        color={t.accent}
        // the glyphs are different widths, and a ragged left edge on three
        // stacked lines reads as three unrelated rows
        style={{ width: m.fsLg, textAlign: 'center', marginTop: 2 }}
      />
      <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...fUi(600),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            ...fUi(400),
            fontSize: m.fsXs,
            lineHeight: m.fsXs * 1.45,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink2,
          }}
        >
          {blurb}
        </Text>
      </Col>
    </Row>
  );
}

/* ---- the screen ---------------------------------------------------- */

function IntroScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const kind = INTRO_STEPS[step];
  const copy = INTRO_COPY[kind];

  const finish = useIntroStore((s) => s.finish);

  const club = useTeamStore((s) => s.profile.name);
  const setProfile = useTeamStore((s) => s.setProfile);
  const players = useRosterStore((s) => s.players);
  const add = useRosterStore((s) => s.add);

  /**
   * THE CLUB FIELD IS HELD LOCALLY AND SEEDED LATE.
   *
   * `null` means the scorer has not typed yet, and while it is null the field
   * shows whatever the store currently holds — blank on a fresh install, the
   * real club on an upgrade, and correct either way even if `teamStore` lands
   * off disk a frame after this screen mounts. `DEFAULT_TEAM.name` is treated
   * as nothing typed, because it IS nothing typed: it is what a fresh install
   * is a club of, and printing it into the field would make an untouched
   * placeholder look like an answer.
   */
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? (club === DEFAULT_TEAM.name ? '' : club);
  const named = cleanTeamName(name).length > 0;

  const last = step === INTRO_STEPS.length - 1;

  const next = (): void => setStep((s) => Math.min(s + 1, INTRO_STEPS.length - 1));

  /**
   * OUT OF THE DOOR AND ONTO THE PICKER.
   *
   * `finish()` before the navigation, always: the flag is what stops this
   * screen being handed back on the next launch, and a `replace` that ran
   * first would unmount the component that had not written it yet.
   *
   * `replace` AND NOT `push`, so nothing can back into the onboarding — the
   * stack behind `/start` is then empty, which is why that screen's back arrow
   * falls through to the lobby rather than to a dead button.
   *
   * IT LANDS ON `/start` RATHER THAN ON THE LOBBY because the verb says so.
   * A scorer who has just been told they have one free game and pressed START
   * MY FIRST GAME should be looking at the question "who is playing", not at a
   * home screen with a button on it that asks it again.
   */
  const done = (): void => {
    finish();
    router.replace('/start');
  };

  /**
   * ANDROID'S BACK IS THE PLATFORM'S GESTURE AND NOT THIS SCREEN'S TO TAKE
   * AWAY, so it steps back through the door. On the FIRST step it is left
   * alone — there is nothing behind this route (it was reached by `replace`),
   * so consuming it would trap a scorer on a screen with no way out at all,
   * where letting it through is the ordinary "back out of the app" every
   * Android launcher screen does.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  /* -- the five bodies ---------------------------------------------- */

  const clubStep = (
    <Col gap={m.s5}>
      <Head copy={copy} />

      <TextField
        label="Club name"
        value={name}
        onChangeText={setTyped}
        placeholder="e.g. Sài Gòn Heat"
        good={named}
      />
    </Col>
  );

  const rosterStep = (
    <Col gap={m.s4}>
      <Head copy={copy} />

      <Col gap={m.s2}>
        <FieldLabel label="Roster" note={`${players.length}/${ROSTER_CAP}`} />
        <Col>
          {players.map((p, i) => (
            <RosterRow key={p.id} player={p} index={i} />
          ))}
        </Col>
      </Col>

      {/* AT THE CAP IT IS GONE, NOT DISABLED — the team tab's rule, and its
          reason: a dark button on a full roster is a control still asking to be
          pressed. */}
      {players.length < ROSTER_CAP && (
        <Press
          onPress={() => add({ number: nextFreeNumber(players), name: '' })}
          accessibilityLabel="add a player to the team"
          style={{
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.r,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: t.rule,
          }}
          pressedStyle={{ backgroundColor: t.surface2, borderColor: t.accent }}
        >
          <GlowText
            style={{
              ...fUi(600),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.accent,
            }}
          >
            + Add player
          </GlowText>
        </Press>
      )}
    </Col>
  );

  const boardStep = (
    <Col gap={m.s4}>
      <Head copy={copy} big />

      {/* THE SLAB RUNS EDGE TO EDGE, which is why it steps back out of the
          column's own padding. A picture of a screen with a margin around it
          reads as a card; without one it reads as the screen. */}
      <View style={{ marginLeft: -(safe.left + m.s4), marginRight: -(safe.right + m.s4) }}>
        <MiniBoard />
      </View>

      <Col gap={m.s4}>
        {BOARD_STEPS.map((b) => (
          <BoardLine key={b.n} {...b} />
        ))}
      </Col>
    </Col>
  );

  const trialStep = (
    <Col gap={m.s5}>
      {/* the picture owns the top of the screen, so the type starts below it */}
      <View style={{ height: m.win.h * ART_H - safe.top - m.s5 }} />
      <Head copy={copy} big />
      <Col gap={m.s4}>
        {TRIAL_GIVES.map((g) => (
          <Gift key={g.title} {...g} />
        ))}
      </Col>
    </Col>
  );

  const body =
    kind === 'club' ? clubStep
    : kind === 'roster' ? rosterStep
    : kind === 'board' ? boardStep
    : trialStep;

  /* -- the foot, which is one line per step -------------------------- */

  const foot =
    kind === 'club' ? (
      <Foot
        step={step}
        primary="Next"
        disabled={!named}
        onPrimary={() => {
          setProfile({ name });
          next();
        }}
      />
    ) : kind === 'roster' ? (
      <Foot
        step={step}
        primary="Next"
        onPrimary={next}
        onSecondary={next}
      />
    ) : kind === 'board' ? (
      <Foot step={step} primary="Got it" onPrimary={next} />
    ) : (
      <Foot
        step={step}
        primary="Start my first game"
        onPrimary={done}
        // SEE PLANS PUSHES OVER THE TOP rather than ending the door, so
        // closing the paywall puts the scorer back on this step with the verb
        // still under their thumb. It is the one route out of here that is not
        // a `replace`, and it is the one that is meant to come back.
        secondary="See plans"
        onSecondary={() => showPaywall()}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* the photograph, then the bloom over it — one light on one surface,
          the order the lobby and the paywall both use. The picture is the last
          step's alone; the other three are the room on its own. */}
      {last && <HeroArt height={m.win.h * ART_H} />}
      <Bloom />

      {/* A FORM GETS A `KeyboardAvoidingView`, WHICH IS THE APP'S OWN LINE:
          the TEAM tab is a LIST and pays the keyboard as tail on its content,
          because a scorer there works down twenty rows. Two of these four
          steps are forms with a handful of fields, so the whole column moves
          and nothing has to be measured. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          // a field is nearly always focused on the first two steps, so the
          // first tap on a control beside one has to LAND rather than merely
          // dismiss a keyboard
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingTop: safe.top + m.s5,
            paddingBottom: safe.bottom + m.s4,
            paddingLeft: safe.left + m.s4,
            paddingRight: safe.right + m.s4,
            // the foot is pinned low on a short step and flows on a long one,
            // which is what `flexGrow` buys — the paywall's own trick
            flexGrow: 1,
          }}
        >
          <Col style={{ width: '100%', maxWidth: MEASURE, alignSelf: 'center', flex: 1 }}>
            {body}
            <View style={{ flex: 1, minHeight: m.s5 }} />
            {foot}
          </Col>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* one bar for the whole screen — the number pad's only way out on iOS,
          and the roster step's rows are its only callers */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NUM_DONE}>
          <Row
            justify="flex-end"
            style={{
              backgroundColor: t.bg,
              borderTopWidth: 1,
              borderTopColor: t.rule,
              paddingHorizontal: m.s3,
            }}
          >
            <Press
              onPress={() => Keyboard.dismiss()}
              accessibilityLabel="done"
              style={{
                minHeight: m.tap,
                paddingHorizontal: m.s3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              pressedStyle={{ opacity: 0.6 }}
            >
              <Text
                style={{
                  ...fUi(600),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: t.accent,
                }}
              >
                Done
              </Text>
            </Press>
          </Row>
        </InputAccessoryView>
      )}
    </View>
  );
}

/**
 * THE PALETTE AND THE STATUS BAR, TOGETHER — the same `DarkRoom` the four
 * rooms and the six pushed pages wear. The door is a place you stand BEFORE a
 * game, which is the whole of what that palette is for; the one screen in this
 * app that is light is the board, and step three is where it is shown.
 */
export default function Intro() {
  return (
    <DarkRoom>
      <IntroScreen />
    </DarkRoom>
  );
}
