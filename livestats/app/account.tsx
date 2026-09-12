import { useCallback, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from '../components/panels/shell';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { Col, Row } from '../components/ui/Row';
import { API_URL } from '../platform/api';
import { useCloudStore, requestCode, verifyCode, refreshCloud, backupNow, restoreFromCloud, signOutCloud, deleteCloudAccount } from '../store/cloudStore';
import { useMetrics } from '../theme/metrics';
import { useTheme } from '../theme/useTheme';
import { LS_TITLE, fUi, ls } from '../theme/tokens';

function AccountScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const cloud = useCloudStore();
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState<'restore' | 'replace' | 'delete' | 'signout' | null>(null);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => cloud.busy);
    return () => sub.remove();
  }, [cloud.busy]));
  const field = { ...fUi(500), fontSize: m.fsMd, color: t.ink, backgroundColor: t.surface,
    minHeight: m.tap, borderRadius: m.rSm, padding: m.s3 };
  const text = { ...fUi(400), fontSize: m.fsSm, color: t.ink2 };
  const games = cloud.pending ? Object.keys(cloud.pending.rows).filter(k => k.startsWith('hooplog-game:')).length : 0;
  const hasBackup = !!cloud.pending && Object.keys(cloud.pending.rows).length > 0;
  const send = async () => {
    const next = await requestCode(email.trim());
    if (next) { setChallenge(next); setCode(''); }
  };
  const execute = async () => {
    const action = confirm;
    setConfirm(null);
    if (action === 'restore') await restoreFromCloud();
    if (action === 'replace') await backupNow(true);
    if (action === 'delete') await deleteCloudAccount();
    if (action === 'signout') { await signOutCloud(); setChallenge(null); setCode(''); }
  };
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <Stack.Screen options={{ gestureEnabled: !cloud.busy }} />
    <Bloom />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: safe.top + m.s4,
        paddingBottom: safe.bottom + m.s5, paddingHorizontal: m.s4, alignItems: 'center' }}>
        <Col gap={m.s4} style={{ width: '100%', maxWidth: 700 }}>
          <Row><Btn label="Back" variant="plain" disabled={cloud.busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /></Row>
          <Text style={{ ...fUi(700), fontSize: m.fsXl, color: t.ink, letterSpacing: ls(m.fsXl, LS_TITLE) }}>Account and backup</Text>
          <Text style={text}>Keep your player roster, squads and saved games in your account. Sign in with the same email after reinstalling to restore them.</Text>
          {!API_URL && <Text style={text}>Cloud backup is not available in this build yet.</Text>}
          {!cloud.account ? <Col gap={m.s3}>
            <TextInput accessibilityLabel="Email address" placeholder="Email address" placeholderTextColor={t.ink3}
              value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              textContentType="emailAddress" editable={!cloud.busy && !challenge} style={field} />
            {!challenge ? <Btn label="Email me a code" variant="accent" disabled={!API_URL || !email.trim() || cloud.busy}
              onPress={() => void send()} /> : <>
              <TextInput accessibilityLabel="Sign-in code" placeholder="Eight-digit code" placeholderTextColor={t.ink3}
                value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 8))} maxLength={8}
                keyboardType="number-pad" textContentType="oneTimeCode" editable={!cloud.busy} style={field} />
              <Btn label="Sign in" variant="accent" disabled={cloud.busy || code.length !== 8} onPress={() => void verifyCode(challenge, code, email)} />
              <Btn label="Use another email or request a new code" variant="plain" disabled={cloud.busy} onPress={() => { setChallenge(null); setCode(''); }} />
            </>}
          </Col> : <Col gap={m.s3}>
            <Text style={{ ...fUi(600), fontSize: m.fsMd, color: t.ink }}>{cloud.account.email}</Text>
            {cloud.lastBackup && <Text style={text}>{`Last confirmed backup: ${new Date(cloud.lastBackup).toLocaleString()}`}</Text>}
            {cloud.enabled ? <>
              <Text style={text}>Automatic backup is on. Changes upload while the app is open and online. Wait for a confirmed backup before deleting the app.</Text>
              <Btn label="Back up now" variant="accent" disabled={cloud.busy} onPress={() => void backupNow()} />
            </> : cloud.pending ? <>
              <Text style={text}>{hasBackup ? `${games} saved games in your cloud backup.` : 'This account has no cloud backup yet.'}</Text>
              {hasBackup && <Btn label="Restore cloud backup" variant="accent" disabled={cloud.busy} onPress={() => setConfirm('restore')} />}
              <Btn label={hasBackup ? 'Replace cloud backup with this device' : 'Back up this device'} variant="surface" disabled={cloud.busy}
                onPress={() => hasBackup ? setConfirm('replace') : void backupNow(true)} />
            </> : null}
            <Btn label="Check cloud backup" variant="surface" disabled={cloud.busy} onPress={() => void refreshCloud()} />
            <Btn label="Sign out" variant="plain" disabled={cloud.busy} onPress={() => setConfirm('signout')} />
            <Btn label="Delete account and cloud data" variant="danger" disabled={cloud.busy} onPress={() => setConfirm('delete')} />
          </Col>}
          {cloud.busy && <Text accessibilityLiveRegion="polite" style={text}>Please wait…</Text>}
          {!!cloud.message && <Text accessibilityLiveRegion="polite" style={text}>{cloud.message}</Text>}
          {confirm && <Col gap={m.s3}>
            <Text style={text}>{confirm === 'restore' ? 'Replace the roster, squads and saved games on this device with the cloud backup? A recovery copy of this device is kept if restoring fails.'
              : confirm === 'replace' ? 'Replace this account’s cloud roster and saved games with the data on this device? Other devices may have newer data.'
              : confirm === 'delete' ? 'Permanently delete your account and its cloud backup? Local data stays on this device. This does not cancel your App Store or Google Play subscription.'
              : 'Sign out and pause automatic backup? Any changes not yet backed up will remain only on this device.'}</Text>
            <Btn label={confirm === 'delete' ? 'Delete permanently' : 'Confirm'} variant={confirm === 'delete' ? 'danger' : 'accent'} disabled={cloud.busy} onPress={() => void execute()} />
            <Btn label="Cancel" variant="plain" disabled={cloud.busy} onPress={() => setConfirm(null)} />
          </Col>}
          {cloud.account && <Btn label="Go to my team and games" variant="surface" disabled={cloud.busy} onPress={() => router.replace('/')} />}
          <Text style={text}>Saved games are backed up. A game still in progress and the club crest photo are not included.</Text>
        </Col>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
export default function Account() { return <DarkRoom><AccountScreen /></DarkRoom>; }
