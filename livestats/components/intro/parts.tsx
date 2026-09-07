import { Keyboard, Text, TextInput, View } from 'react-native';

import { Btn } from '../panels/shell';
import { GlowText } from '../ui/GlowText';
import { Press } from '../ui/Press';
import { Col, Row } from '../ui/Row';
import { INTRO_STEPS, type StepCopy } from '../../constants/intro';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, LS_TITLE, fUi, ls, withAlpha } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * THE DOOR'S FURNITURE.
 *
 * Five steps that have to read as one screen shown five times, so the parts
 * that repeat are drawn once: the headline block, the foot, the progress dots
 * and the two small marks. Everything here is module-level, for the reason
 * every piece in this app is — a component declared inside the screen is a new
 * type on every render, and this screen re-renders on every keystroke of a
 * club's name.
 *
 * It is the tab group's palette throughout: `app/intro.tsx` wears `DarkRoom`,
 * so `Btn` and everything below follow it with no `dark` prop anywhere.
 */

/**
 * THE HEADLINE AND ITS ONE SENTENCE.
 *
 * `hi` is the half of the title that is LIT — *two taps. Three at most.*,
 * *1 free game.* — and it sits on its own line under the plain half rather
 * than beside it, which is what makes it the thing the eye lands on. It is
 * painted with `glowInk` through `GlowText`, and handing that `t.accent` is
 * what arms it; on web it falls back to flat orange, because `react-native-web`
 * has no honest mask.
 *
 * IT IS THE BODY FACE, NOT `fDisplay`. The display face is spent on the
 * wordmark and the crest's monogram — a sentence set in the app's own logotype
 * reads as a poster shouting rather than as a screen talking. That argument is
 * the paywall's, and it is the same argument here one tap away from it.
 *
 * TWO SIZES, AND `big` IS THE TWO STEPS THAT ASK FOR NOTHING. A step with a
 * form under it gives its headline `fsXl`, because the form is the point; the
 * board tour and the trial carry only their own sentence, so they take `fs2xl`
 * and the room that goes with it.
 */
export function Head({ copy, big = false }: { copy: StepCopy; big?: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const fs = big ? m.fs2xl : m.fsXl;

  const title = {
    ...fUi(700),
    fontSize: fs,
    lineHeight: fs * 1.2,
    letterSpacing: ls(fs, LS_TITLE),
  };

  return (
    <Col gap={m.s2}>
      <Col>
        <Text style={{ ...title, color: t.ink }}>{copy.title}</Text>
        {!!copy.hi && <GlowText style={{ ...title, color: t.accent }}>{copy.hi}</GlowText>}
      </Col>
      <Text
        style={{
          ...fUi(400),
          fontSize: m.fsSm,
          lineHeight: m.fsSm * 1.5,
          letterSpacing: ls(m.fsSm, LS_LABEL),
          color: t.ink2,
        }}
      >
        {copy.blurb}
      </Text>
    </Col>
  );
}

/**
 * A SMALL LABEL OVER A CONTROL — *Club name*, *Periods*, *Roster*.
 *
 * The same shape `app/settings.tsx` gives its option titles, one step quieter:
 * on this screen the headline above already carries the question, and this is
 * only saying which box answers it. `note` is what is pinned to the far edge —
 * a count, a total.
 */
export function FieldLabel({ label, note }: { label: string; note?: string }) {
  const m = useMetrics();
  const t = useTheme();
  const style = {
    ...fUi(400),
    fontSize: m.fsXs,
    letterSpacing: ls(m.fsXs, LS_MICRO),
    color: t.ink3,
  };

  return (
    <Row gap={m.s2}>
      <Text style={style}>{label}</Text>
      {!!note && (
        <Text style={{ ...style, marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>{note}</Text>
      )}
    </Row>
  );
}

/**
 * THE ONE TEXT FIELD IN THE DOOR — a label, a line of type, and a rule under
 * it that IS the error message.
 *
 * `good` paints that rule `accent` and nothing else changes: no red, no words,
 * no icon. It is `ClubCard`'s device exactly, for `ClubCard`'s reason — the
 * club's name is required, so the only two states are "there is one" and
 * "there is not", and a 2px line says both without spending a row. The
 * sentence that explains WHY the verb is dark is printed over the verb by
 * `Foot`, which is where a scorer looking at a dark button is already reading.
 *
 * It is here rather than inline in the step for two reasons and the second one
 * is the real one: it is furniture, and this is where the door's furniture
 * lives.
 *
 * THE FIELD SITS ON NO BOX, which is the team tab's row and the club card's
 * name. A bordered input on a screen whose only job is one question reads as a
 * form; a line of type over a rule reads as the question being answered.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  good,
}: {
  label: string;
  value: string;
  onChangeText(v: string): void;
  placeholder: string;
  /** whether the rule under it is lit — see above */
  good: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Col>
      <FieldLabel label={label} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.ink3}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        accessibilityLabel={label}
        style={{
          paddingVertical: m.s2,
          paddingHorizontal: 0,
          minHeight: m.tap,
          ...fUi(500),
          fontSize: m.fsXl,
          color: t.ink,
        }}
      />
      <View
        style={{
          height: 2,
          borderRadius: 2,
          backgroundColor: good ? t.accent : t.line,
        }}
      />
    </Col>
  );
}

/**
 * A NUMBERED BADGE, drawn TWICE per step of the board tour: once on the
 * miniature board and once at the head of the line that explains it. Two
 * drawings of one number is the whole device that ties the picture to the list.
 *
 * `live` IS THE COURT'S, and it is not decoration. The mark that badge points
 * at is the live tap mark, which is `live` blue on the real floor because a tap
 * not yet resolved into a make or a miss is not a made shot — see that token.
 * Colouring this one accent would put orange on the one mark in the app that
 * must not be.
 */
export function Badge({ n, live = false, size }: { n: number; live?: boolean; size?: number }) {
  const m = useMetrics();
  const t = useTheme();
  const d = size ?? Math.round(m.fsMd * 1.15);

  return (
    <View
      style={{
        width: d,
        height: d,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: live ? t.live : t.accent,
      }}
    >
      <Text
        style={{
          ...fUi(700),
          fontSize: d * 0.55,
          lineHeight: d * 0.55 * 1.15,
          color: t.accentInk,
          fontVariant: ['tabular-nums'],
        }}
      >
        {n}
      </Text>
    </View>
  );
}

/**
 * THE TAP COUNT — `3 TAPS`, in an accent outline.
 *
 * CAPS at `LS_CAPS`, which is the one positive step on the tracking ramp and
 * is spent on abbreviations. This is the closest thing on the screen to one: it
 * is a CODE the headline made a promise about, read as a unit beside a sentence
 * rather than as a word inside one.
 *
 * The OUTLINE rather than a fill is the plan card's rule, for the plan card's
 * reason: four of these are read against each other down the screen, and four
 * filled pills would be four marks competing with the four badges beside them.
 */
export function Taps({ label }: { label: string }) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <View
      style={{
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: withAlpha(t.accent, 0.45),
        paddingVertical: 2,
        paddingHorizontal: m.s2,
      }}
    >
      <Text
        style={{
          ...fUi(600),
          fontSize: m.fs2xs,
          letterSpacing: ls(m.fs2xs, LS_CAPS),
          color: t.accent,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * WHERE THE SCORER IS, AS ONE DOT PER STEP with the current one drawn as a bar.
 *
 * IT IS A READOUT AND NOT A CONTROL. Four press targets six points across is
 * not a target, and jumping to the last step before naming a club would leave
 * the one required answer behind. Progress is the only thing it says.
 *
 * The count is `INTRO_STEPS`, never a number typed here, so the row cannot end
 * up with four dots over a five-step door — which is exactly the drift it was
 * written against, and exactly what happened when the rules step was cut.
 */
export function Dots({ step }: { step: number }) {
  const m = useMetrics();
  const t = useTheme();
  const d = 6;

  return (
    <View
      accessibilityLabel={'step ' + (step + 1) + ' of ' + INTRO_STEPS.length}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: m.s1 + 3,
      }}
    >
      {INTRO_STEPS.map((key, i) => (
        <View
          key={key}
          style={{
            width: i === step ? d * 3.3 : d,
            height: d,
            flexGrow: 0,
            flexShrink: 0,
            borderRadius: d / 2,
            backgroundColor: i === step ? t.accent : t.line,
          }}
        />
      ))}
    </View>
  );
}

/**
 * THE FOOT: the verb, the way past it, and the dots — the same three things in
 * the same order on every step.
 *
 * THE PRIMARY WEARS `bloom`, the variant for a button that STARTS something:
 * the same one CONTINUE GAME, START GAME and the paywall's own verb take. It is
 * the room made into a button, which on a screen that IS the room is the honest
 * weight for the one control that moves you on.
 *
 * THE SECONDARY IS A LINE OF TEXT AND NOT A SECOND BUTTON. It is the way PAST a
 * step, and a step that can be skipped is one the app is not really asking for
 * — two controls of comparable weight would make the skip read as a choice
 * between equals. It keeps a full `tap` of height, because being quiet is not
 * the same as being hard to hit.
 *
 * `note` is the one line printed OVER the verb while it is dark — *Your club
 * needs a name* — which is the lobby's own rule for a disabled primary: say WHY,
 * on the screen, rather than leaving a dead button to be poked at.
 */
export function Foot({
  primary,
  onPrimary,
  disabled = false,
  note,
  secondary,
  onSecondary,
  step,
}: {
  primary: string;
  onPrimary(): void;
  disabled?: boolean;
  note?: string;
  secondary?: string;
  onSecondary?(): void;
  step: number;
}) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <Col gap={m.s2}>
      {!!note && (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            textAlign: 'center',
            ...fUi(400),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_MICRO),
            color: t.ink3,
          }}
        >
          {note}
        </Text>
      )}

      <Row align="stretch">
        <Btn label={primary} variant="bloom" disabled={disabled} onPress={onPrimary} />
      </Row>

      {!!secondary && !!onSecondary && (
        <Press
          onPress={onSecondary}
          accessibilityLabel={secondary}
          style={{
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.r,
          }}
          pressedStyle={{ opacity: 0.55 }}
        >
          <Text
            style={{
              ...fUi(400),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink2,
            }}
          >
            {secondary}
          </Text>
        </Press>
      )}

      <View style={{ paddingTop: m.s2 }}>
        <Dots step={step} />
      </View>
    </Col>
  );
}

