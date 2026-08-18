import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { useAnnounce } from '../../hooks/useAnnounce';
import { NAME_MAX, numberHolder, validNumber } from '../../lib/roster';
import { useRosterStore } from '../../store/rosterStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn, PTitle, Row } from './shell';

/**
 * ADD PLAYER and EDIT PLAYER are one panel, because they are one form: the
 * only difference is whether the two fields start empty, and which id the
 * duplicate check is allowed to ignore.
 *
 * The number is checked against the rest of the roster as it is typed and the
 * error NAMES THE HOLDER — "#12 IS TAKEN BY bd" tells the scorer what to do
 * next, where "already in use" makes them go and look. SAVE stays dark until
 * both fields are good, so the error is the only thing that can be wrong.
 *
 * This is the only screen in the app with a text input, which is why the
 * keyboard avoidance lives here and nowhere else — the board never opens one.
 */
export function EditPlayerPanel({ playerId }: { playerId: string | null }) {
  const m = useMetrics();
  const t = useTheme();

  const roster = useRosterStore((s) => s.players);
  const add = useRosterStore((s) => s.add);
  const update = useRosterStore((s) => s.update);
  const reset = useUiStore((s) => s.reset);

  const editing = playerId ? roster.find((p) => p.id === playerId) ?? null : null;

  // the number is held as TEXT, not a number: an empty field and a typed 0 are
  // different states, and `Number('')` is 0
  const [numText, setNumText] = useState(editing ? String(editing.number) : '');
  const [name, setName] = useState(editing?.name ?? '');

  const title = editing ? 'EDIT PLAYER' : 'ADD PLAYER';
  useAnnounce(title);

  const num = Number(numText);
  const numOk = numText.length > 0 && validNumber(num);
  const holder = numOk ? numberHolder(roster, num, playerId) : null;
  const nameOk = name.trim().length > 0;
  const ok = numOk && nameOk && !holder;

  const save = () => {
    if (!ok) return;
    if (editing) update(editing.id, { number: num, name });
    else add({ number: num, name });
    reset();
  };

  const label = (text: string) => (
    <Text
      style={{
        fontFamily: fNum(500),
        fontSize: m.fsXs,
        letterSpacing: ls(m.fsXs, LS_LABEL),
        color: t.ink2,
      }}
    >
      {text}
    </Text>
  );

  const field = {
    minHeight: m.tap,
    paddingHorizontal: m.s3,
    borderRadius: m.r,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface2,
    color: t.ink,
    fontFamily: fNum(600),
    fontSize: m.fsLg,
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PTitle title={title} />

      <View style={{ flexDirection: 'column', gap: m.s2 }}>
        {label('NUMBER')}
        <TextInput
          value={numText}
          onChangeText={(v) => setNumText(v.replace(/[^0-9]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          placeholderTextColor={t.ink3}
          accessibilityLabel="jersey number"
          style={[field, { fontVariant: ['tabular-nums'] }]}
        />
      </View>

      <View style={{ flexDirection: 'column', gap: m.s2, marginTop: m.sp }}>
        {label('NAME')}
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
          placeholder="name"
          placeholderTextColor={t.ink3}
          accessibilityLabel="player name"
          style={field}
        />
      </View>

      {/* the one error the form can show, and it says who to go and ask */}
      <Text
        accessibilityLiveRegion="polite"
        style={{
          marginTop: m.s2,
          minHeight: m.fsSm * 1.5,
          fontFamily: fUi(600),
          fontSize: m.fsSm,
          lineHeight: m.fsSm * 1.5,
          color: t.danger,
        }}
      >
        {holder ? `#${holder.number} IS TAKEN BY ${holder.name}` : ''}
      </Text>

      <Row>
        <Btn label="CANCEL" onPress={reset} />
        <Btn label="SAVE" variant="accent" disabled={!ok} onPress={save} />
      </Row>
    </KeyboardAvoidingView>
  );
}
