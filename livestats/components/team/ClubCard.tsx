import { useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { COACH_NAME_MAX, TEAM_NAME_MAX, cleanTeamName } from '../../lib/team';
import { useTeamStore } from '../../store/teamStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Card } from '../stats/parts';
import { Crest } from '../ui/Crest';
import { Press } from '../ui/Press';
import { Row } from '../ui/Row';

/**
 * THE CLUB CARD — the half of "my team" that is not a list of people, and on
 * the TEAM tab it is now EDITED IN PLACE, exactly as a roster row is.
 *
 * THREE BANDS, AND IT IS KEPT SHORT ON PURPOSE: this card scrolls WITH the
 * roster rather than sitting above it, so every point it spends is a player the
 * scorer cannot see on the first screen. Padding is `s2` throughout and the name
 * sits at `fsLg`, not `fsXl`.
 *
 *   the identity  CREST AND NAME ON ONE ROW, over a 2px rule. The mark and the
 *                 word are the same fact and were two bands for no reason; side
 *                 by side the crest also takes its height from the field beside
 *                 it instead of setting the band's. The rule is `accent` while
 *                 the name is good and `danger` while it is empty — a club with
 *                 no name has no crest fallback, no lobby subtitle and nothing
 *                 to file a game under, so it is the one required field here,
 *                 and that rule is the whole error message.
 *   the bench     COACH and ASSISTANT COACH, side by side, both optional. Most
 *                 scorers keeping stats for their own club ARE the coach, and a
 *                 card that insisted would be asking them to write their own
 *                 name down to get past it.
 *   the crest row a dashed `+ ADD CLUB LOGO`, the same shape as `+ ADD PLAYER`
 *                 one block down the same screen, with REMOVE beside it once
 *                 there is a crest to remove.
 *
 * `EditTeamPanel` was where all of it used to live and IS GONE. Two editors over
 * three fields is one field added twice, so the lobby's identity block routes to
 * this tab now rather than opening a dialog over itself. This card is the only
 * writer of the club.
 *
 * THERE ARE NO CLUB COLOURS ON IT. The mockup pairs the crest with a MAIN and an
 * ACCENT swatch; the palette has exactly one skin and `theme/tokens.ts` is the
 * only place a hex is written, so a per-club colour is a theme change and not a
 * field. It was raised and declined — do not add one back unprompted.
 *
 * **THE CREST IS APPLIED ON PICK**, the one behaviour carried over from the
 * panel unchanged. The copy into the document directory is the expensive,
 * failable half, and holding it behind a SAVE would mean either doing it twice
 * or keeping a cache URI alive long enough to go stale. There is no SAVE here at
 * all now, so there is nothing left to hold it behind.
 *
 * A square crop is REQUESTED, not required — `Crest` covers and crops, so a
 * scorer who declines the editor still gets a crest.
 *
 * **`readOnly` IS THE NEW-GAME PICKER, and it is the same card because it is the
 * same fact** — who this board belongs to. What it is NOT there is a way in: a
 * club is renamed on the team screen, not thirty seconds before tip-off, and a
 * rename mid-picker would change the name the game is about to be FILED UNDER.
 * So every field renders as text and the crest row is not drawn at all, rather
 * than promising an editor that never opens.
 *
 * The text is held locally and committed as it is typed, for the same reason the
 * roster rows do it: `setProfile` runs `cleanTeamName` / `cleanCoach`, which
 * trim and collapse whitespace, so a store round trip per keystroke would eat a
 * space the moment it was typed. Blur re-seeds from the store — which is also
 * what puts the last good name back after the field is cleared, since
 * `setProfile` refuses an empty one.
 */
export function ClubCard({ readOnly = false }: { readOnly?: boolean }) {
  const m = useMetrics();
  const t = useTheme();

  const club = useTeamStore((s) => s.profile);
  const setProfile = useTeamStore((s) => s.setProfile);
  const setLogo = useTeamStore((s) => s.setLogo);
  const clearLogo = useTeamStore((s) => s.clearLogo);
  const say = useUiStore((s) => s.say);

  const [name, setName] = useState(club.name);
  const [coach, setCoach] = useState(club.coach);
  const [assistant, setAssistant] = useState(club.assistant);
  const [busy, setBusy] = useState(false);

  const nameOk = cleanTeamName(name).length > 0;
  // off the TYPE ramp, not the tap ramp: it sits beside the name and should read
  // as part of it rather than as a third control on the row
  const crestSize = Math.round(m.fsLg * 1.6);

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

  /**
   * The box every field on this card is drawn in — the roster row's twin. It is
   * split from the type rules because the read-only cell puts the same box on a
   * `View`, and `fontFamily` on a `ViewStyle` is a rule React Native drops.
   */
  const box = {
    minHeight: m.tap,
    paddingHorizontal: m.s2,
    borderRadius: m.r,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
  };
  const field = { ...box, color: t.ink, fontFamily: fUi(600), fontSize: m.fsMd };

  /** …and its read-only twin, so the picker's card is the same card. */
  const readCell = (value: string, fallback: string) => (
    <View style={{ ...box, flex: 1, minWidth: 0, justifyContent: 'center' }}>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{ fontFamily: fUi(600), fontSize: m.fsMd, color: value ? t.ink : t.ink3 }}
      >
        {value || fallback}
      </Text>
    </View>
  );

  return (
    <Card>
      {/* s2 throughout, not s3 — see the note: this card is a list header now */}
      <View style={{ padding: m.s2, gap: m.s2 }}>
        {/* ---- THE CREST AND THE NAME, over the one rule on the card ---- */}
        <Row
          gap={m.s2}
          style={{
            paddingBottom: m.s2,
            borderBottomWidth: 2,
            // the rule carries the only error this card can show, so it needs no
            // words: an empty name is the only thing it refuses
            borderBottomColor: readOnly ? t.rule : nameOk ? t.accent : t.danger,
          }}
        >
          <Crest name={name || club.name} uri={club.logoUri} size={crestSize} />

          {readOnly ? (
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: m.tap,
                lineHeight: m.tap,
                fontFamily: fNum(700),
                fontSize: m.fsLg,
                letterSpacing: ls(m.fsLg, LS_BTN),
                color: t.ink,
              }}
            >
              {club.name.toUpperCase()}
            </Text>
          ) : (
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setProfile({ name: v });
              }}
              onBlur={() => setName(club.name)}
              maxLength={TEAM_NAME_MAX}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholder="TEAM NAME"
              placeholderTextColor={t.ink3}
              accessibilityLabel="team name"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: m.tap,
                padding: 0,
                fontFamily: fNum(700),
                fontSize: m.fsLg,
                letterSpacing: ls(m.fsLg, LS_BTN),
                color: t.ink,
              }}
            />
          )}
        </Row>

        {/* ---- THE BENCH, two across ----------------------------------- */}
        <Row align="stretch" gap={m.s2}>
          {readOnly ? (
            <>
              {readCell(club.coach, '—')}
              {readCell(club.assistant, '—')}
            </>
          ) : (
            <>
              <TextInput
                value={coach}
                onChangeText={(v) => {
                  setCoach(v);
                  setProfile({ coach: v });
                }}
                onBlur={() => setCoach(club.coach)}
                maxLength={COACH_NAME_MAX}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                placeholder="Coach"
                placeholderTextColor={t.ink3}
                accessibilityLabel="head coach"
                style={[field, { flex: 1, minWidth: 0 }]}
              />
              <TextInput
                value={assistant}
                onChangeText={(v) => {
                  setAssistant(v);
                  setProfile({ assistant: v });
                }}
                onBlur={() => setAssistant(club.assistant)}
                maxLength={COACH_NAME_MAX}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                placeholder="Assistant coach"
                placeholderTextColor={t.ink3}
                accessibilityLabel="assistant coach"
                style={[field, { flex: 1, minWidth: 0 }]}
              />
            </>
          )}
        </Row>

        {/* ---- THE CREST ROW, the same shape as + ADD PLAYER ------------ */}
        {!readOnly && (
          <Row align="stretch" gap={m.s2}>
            <Press
              onPress={() => void pick()}
              disabled={busy}
              accessibilityLabel={club.logoUri ? 'change the club crest' : 'add a club crest'}
              style={{
                flex: 1,
                minWidth: 0,
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
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fNum(700),
                  fontSize: m.fsMd,
                  letterSpacing: ls(m.fsMd, LS_LABEL),
                  color: busy ? t.ink3 : t.accent,
                }}
              >
                {busy ? 'OPENING…' : club.logoUri ? '+ CHANGE CLUB LOGO' : '+ ADD CLUB LOGO'}
              </Text>
            </Press>

            {!!club.logoUri && (
              <Press
                onPress={clearLogo}
                disabled={busy}
                accessibilityLabel="remove the club crest"
                style={{
                  flexGrow: 0,
                  flexShrink: 0,
                  minHeight: m.tap,
                  paddingHorizontal: m.s3,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: m.r,
                }}
                pressedStyle={{ backgroundColor: t.surface2 }}
              >
                <Text
                  style={{
                    fontFamily: fNum(700),
                    fontSize: m.fsXs,
                    letterSpacing: ls(m.fsXs, LS_LABEL),
                    color: t.ink3,
                  }}
                >
                  REMOVE
                </Text>
              </Press>
            )}
          </Row>
        )}
      </View>
    </Card>
  );
}
