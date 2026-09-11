import { useState } from 'react';
import { Keyboard, Text, TextInput } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Press } from '../ui/Press';
import { Row } from '../ui/Row';
import { SQUAD_CAP, SQUAD_NAME_MAX, activeIn, squadsIn } from '../../lib/squads';
import { useRosterStore } from '../../store/rosterStore';
import { useSquadStore } from '../../store/squadStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import type { Squad } from '../../types';

/**
 * THE SWITCHER — a strip of at most three chips under the club card, and the
 * one control in the app that says which team everything else is about.
 *
 * It is a STRIP AND NOT A PANEL for the same reason `Seg` is a strip on the
 * stats screens: three is a number you pick from by looking, and a chooser
 * that has to be opened to be read costs a tap to answer a question the screen
 * could simply have been showing. The active chip is the accent, which is what
 * the accent means everywhere else — OURS.
 *
 * ## THE ACTIVE CHIP IS ALSO THE NAME FIELD
 *
 * Tapping a chip that is already active turns it into a `TextInput` over the
 * same box. That is the TEAM tab's own idiom — the row IS the form, the club
 * card IS the form — carried up one level, and it is why no `squadName` panel
 * was built: the five off-board panel kinds are confirms and a keypad, and
 * `docs/DECISIONS.md` says there is no FORM among them. There still is not.
 *
 * The text is held locally and committed as it is typed, exactly as
 * `RosterRow` does it and for exactly the same reason: `rename` runs
 * `cleanSquadName`, which trims, so a store round trip per keystroke would eat
 * a space the moment it was typed. Blur re-seeds from the store, which is what
 * reverts a name typed down to nothing.
 *
 * ## AND THE `+` IS GONE AT THE CAP, NOT DISABLED
 *
 * `+ ADD PLAYER` is gone at `ROSTER_CAP` and this is the same call: a control
 * still asking to be pressed on a club that already has three teams is a
 * control that has to explain itself. Three chips on the strip is what says
 * why.
 */
export function SquadStrip({
  onEditingChange,
}: {
  /** the TEAM tab tracks a focused field for its keyboard lift */
  onEditingChange?: (editing: boolean) => void;
}) {
  const m = useMetrics();
  const t = useTheme();

  const roster = useRosterStore((s) => s.players);
  const saved = useSquadStore((s) => s.squads);
  const activeId = useSquadStore((s) => s.activeId);
  const setActive = useSquadStore((s) => s.setActive);
  const create = useSquadStore((s) => s.create);
  const rename = useSquadStore((s) => s.rename);

  // the derived first team is what a club that has never split into teams
  // already had — see `squadsIn`. Nothing here branches on "no teams yet".
  const squads = squadsIn(saved, roster);
  const active = activeIn(squads, activeId);

  // which chip is being typed in, and the text while it is
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');

  const startEdit = (s: Squad) => {
    setEditing(s.id);
    setText(s.name);
    onEditingChange?.(true);
  };

  const stopEdit = () => {
    setEditing(null);
    onEditingChange?.(false);
  };

  return (
    <Row gap={m.s2} style={{ minHeight: m.tap, marginTop: m.s3 }}>
      {squads.map((s) => {
        const on = s.id === active?.id;
        const typing = editing === s.id;

        return (
          <Press
            key={s.id}
            onPress={() => {
              if (typing) return;
              // ONE TAP SELECTS, A SECOND TAP RENAMES. A chip that opened a
              // field on the first tap would make switching teams — the thing
              // this strip is for — put a keyboard up every time.
              if (on) startEdit(s);
              else setActive(s.id);
            }}
            accessibilityLabel={on ? `rename ${s.name}` : `switch to ${s.name}`}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: m.tap,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: m.s2,
              borderRadius: m.rSm,
              borderWidth: 1,
              // AN INVERTED SURFACE IS A PAIR — the fill and the ink are set
              // together on both branches, which is what `npm run check` greps
              // for. `accent2` is the pressed accent below, never a fainter one.
              borderColor: on ? t.accent : t.rule,
              backgroundColor: on ? t.accent : 'transparent',
            }}
            pressedStyle={{ backgroundColor: on ? t.accent2 : t.surface2 }}
          >
            {typing ? (
              <TextInput
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  rename(s.id, v);
                }}
                onBlur={() => {
                  setText(s.name);
                  stopEdit();
                }}
                onSubmitEditing={Keyboard.dismiss}
                autoFocus
                selectTextOnFocus
                maxLength={SQUAD_NAME_MAX}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel={`name for ${s.name}`}
                style={{
                  width: '100%',
                  padding: 0,
                  textAlign: 'center',
                  ...fUi(600),
                  fontSize: m.fsSm,
                  // the field sits inside the active chip, so it takes the
                  // chip's own ink — the other half of the pair above
                  color: t.accentInk,
                }}
              />
            ) : (
              <Text
                numberOfLines={1}
                style={{
                  ...fUi(600),
                  fontSize: m.fsSm,
                  letterSpacing: ls(m.fsSm, LS_LABEL),
                  // AN ACCENT FILL'S INK IS `accentInk`, and writing the two
                  // together on the same rule is what `npm run check` greps for
                  color: on ? t.accentInk : t.ink2,
                }}
              >
                {s.name}
              </Text>
            )}
          </Press>
        );
      })}

      {squads.length < SQUAD_CAP && (
        <Press
          onPress={() => create()}
          accessibilityLabel="add a team to the club"
          style={{
            flexGrow: 0,
            flexShrink: 0,
            width: m.tap,
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.rSm,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: t.rule,
          }}
          pressedStyle={{ backgroundColor: t.surface2, borderColor: t.accent }}
        >
          <MaterialCommunityIcons name="plus" size={m.fsMd} color={t.accent} />
        </Press>
      )}
    </Row>
  );
}
