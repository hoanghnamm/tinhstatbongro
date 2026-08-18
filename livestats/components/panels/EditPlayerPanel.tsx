import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Switch, Text, TextInput, View } from 'react-native';

import { COURT_POSITIONS } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { NAME_MAX, numberHolder, validNumber } from '../../lib/roster';
import { useRosterStore } from '../../store/rosterStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Seg, type SegItem } from '../stats/parts';
import { Btn, PTitle, Row } from './shell';
import type { CourtPosition } from '../../types';

/** `—` is a real choice and the default one: most players never get a label. */
type PosKey = '' | CourtPosition;
const POS_ITEMS: SegItem<PosKey>[] = [
  { key: '', label: '—' },
  ...COURT_POSITIONS.map((p) => ({ key: p as PosKey, label: p })),
];

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
 *
 * The two fields under the name are the two things that are true of a player
 * between games rather than during one. POSITION is a LABEL and nothing reads
 * it — not the picker, not the rail, not a single stat — which is why it can be
 * left blank and why blank is where it starts. AVAILABLE is the one that does
 * something: it is what hides an injured player from the starter picker, and
 * it is a switch rather than a delete because they are still on the team.
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
  const [position, setPosition] = useState<PosKey>(editing?.position ?? '');
  // a player is added because they are on the team, not because they are hurt
  const [available, setAvailable] = useState(editing ? editing.available : true);

  const title = editing ? 'EDIT PLAYER' : 'ADD PLAYER';
  useAnnounce(title);

  const num = Number(numText);
  const numOk = numText.length > 0 && validNumber(num);
  const holder = numOk ? numberHolder(roster, num, playerId) : null;
  const nameOk = name.trim().length > 0;
  const ok = numOk && nameOk && !holder;

  const save = () => {
    if (!ok) return;
    // `position: undefined` is how the blank is stored — the key is optional and
    // the patch spread clears it, which is what picking `—` has to mean
    const pos = position === '' ? undefined : position;
    if (editing) update(editing.id, { number: num, name, position: pos, available });
    else add({ number: num, name, position: pos, available });
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

      <View style={{ flexDirection: 'column', gap: m.s2, marginTop: m.sp }}>
        {label('POSITION')}
        <Seg items={POS_ITEMS} value={position} onChange={(k) => setPosition(k)} />
      </View>

      <Row mt>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', gap: 2 }}>
          {label('AVAILABLE')}
          <Text
            style={{
              fontFamily: fUi(400),
              fontSize: m.fsXs,
              lineHeight: m.fsXs * 1.5,
              color: t.ink3,
            }}
          >
            {available ? 'Can be picked to start.' : 'Injured or away — hidden from the picker.'}
          </Text>
        </View>
        <View style={{ flexGrow: 0, flexShrink: 0, justifyContent: 'center' }}>
          <Switch
            value={available}
            onValueChange={setAvailable}
            accessibilityLabel="available for selection"
            trackColor={{ false: t.rule, true: t.accent }}
            thumbColor={t.surface}
            ios_backgroundColor={t.rule}
          />
        </View>
      </Row>

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
