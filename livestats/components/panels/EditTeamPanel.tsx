import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAnnounce } from '../../hooks/useAnnounce';
import { COACH_NAME_MAX, TEAM_NAME_MAX, cleanTeamName } from '../../lib/team';
import { useTeamStore } from '../../store/teamStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Crest } from '../ui/Crest';
import { Press } from '../ui/Press';
import { Row as UIRow } from '../ui/Row';
import { Btn, PTitle, Row } from './shell';

/**
 * THE CLUB, edited: the crest, the name and the two coaches.
 *
 * It is the roster form's twin and is deliberately built the same way — same
 * labelled fields, same SAVE-stays-dark rule, same CANCEL. The one thing it does
 * that no other panel does is touch a file, and that part does not wait for
 * SAVE: **the crest is applied the moment it is picked**, because the copy is
 * the expensive, failable half and holding it behind a button would mean either
 * doing it twice or keeping a cache URI alive long enough to go stale. CANCEL
 * therefore abandons the three text fields and nothing else, and the panel says
 * so rather than leaving it to be discovered.
 *
 * A square crop is REQUESTED, not required. `allowsEditing` with a 1:1 aspect
 * is what a crest wants, but a scorer who declines it still gets a crest —
 * `Crest` covers and crops rather than squashing.
 *
 * THE COACHES ARE NOT REQUIRED. Most scorers keeping stats for their own club
 * are the coach, and a form that insists on a name would be asking them to
 * write their own down to get past it.
 */
export function EditTeamPanel() {
  const m = useMetrics();
  const t = useTheme();

  const profile = useTeamStore((s) => s.profile);
  const setProfile = useTeamStore((s) => s.setProfile);
  const setLogo = useTeamStore((s) => s.setLogo);
  const clearLogo = useTeamStore((s) => s.clearLogo);
  const reset = useUiStore((s) => s.reset);
  const say = useUiStore((s) => s.say);

  const [name, setName] = useState(profile.name);
  const [coach, setCoach] = useState(profile.coach);
  const [assistant, setAssistant] = useState(profile.assistant);
  const [busy, setBusy] = useState(false);

  useAnnounce('edit team');

  // the name is the only required field — it is the crest's fallback, the
  // lobby's subtitle and what every box score is filed under
  const ok = cleanTeamName(name).length > 0;

  const save = () => {
    if (!ok) return;
    setProfile({ name, coach, assistant });
    reset();
  };

  const pick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        say('PHOTO ACCESS DENIED', true);
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const done = await setLogo(picked.assets[0].uri);
      say(done ? 'CREST UPDATED' : 'COULD NOT SAVE THAT IMAGE', !done);
    } catch {
      say('COULD NOT OPEN THE PHOTO LIBRARY', true);
    } finally {
      setBusy(false);
    }
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

  const crestSize = Math.round(m.fs3xl * 1.25);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PTitle title="EDIT TEAM" />

      {/* ---- the crest ------------------------------------------------ */}
      <UIRow gap={m.s4}>
        <Crest name={name || profile.name} uri={profile.logoUri} size={crestSize} />

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', gap: m.s2 }}>
          {label('CLUB CREST')}
          <UIRow align="stretch" gap={m.s2}>
            <Btn
              label={busy ? 'OPENING…' : profile.logoUri ? 'CHANGE' : 'UPLOAD'}
              variant="surface"
              disabled={busy}
              onPress={() => void pick()}
            />
            {!!profile.logoUri && (
              <Btn label="REMOVE" variant="plain" disabled={busy} onPress={clearLogo} />
            )}
          </UIRow>
          <Text
            style={{
              fontFamily: fUi(400),
              fontSize: m.fsXs,
              lineHeight: m.fsXs * 1.5,
              color: t.ink3,
            }}
          >
            Applied straight away — CANCEL below only drops the three fields.
          </Text>
        </View>
      </UIRow>

      {/* ---- the name ------------------------------------------------- */}
      <View style={{ flexDirection: 'column', gap: m.s2, marginTop: m.spLg }}>
        {label('TEAM NAME')}
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={TEAM_NAME_MAX}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          placeholder="MY TEAM"
          placeholderTextColor={t.ink3}
          accessibilityLabel="team name"
          style={field}
        />
      </View>

      {/* ---- the bench ------------------------------------------------ */}
      <View style={{ flexDirection: 'column', gap: m.s2, marginTop: m.sp }}>
        {label('HEAD COACH')}
        <TextInput
          value={coach}
          onChangeText={setCoach}
          maxLength={COACH_NAME_MAX}
          autoCorrect={false}
          returnKeyType="next"
          placeholder="optional"
          placeholderTextColor={t.ink3}
          accessibilityLabel="head coach"
          style={field}
        />
      </View>

      <View style={{ flexDirection: 'column', gap: m.s2, marginTop: m.sp }}>
        {label('ASSISTANT COACH')}
        <TextInput
          value={assistant}
          onChangeText={setAssistant}
          maxLength={COACH_NAME_MAX}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
          placeholder="optional"
          placeholderTextColor={t.ink3}
          accessibilityLabel="assistant coach"
          style={field}
        />
      </View>

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
        {ok ? '' : 'A TEAM NEEDS A NAME'}
      </Text>

      <Row>
        <Btn label="CANCEL" onPress={reset} />
        <Btn label="SAVE" variant="accent" disabled={!ok} onPress={save} />
      </Row>
    </KeyboardAvoidingView>
  );
}
