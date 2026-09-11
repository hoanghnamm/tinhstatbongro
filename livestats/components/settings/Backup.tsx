import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { BACKUP_REFUSAL, backupFileName, countsOf, readBackup, type Backup } from '../../lib/backup';
import { FAULT_NOTE, onStorageFault, storageFault, type Fault } from '../../lib/fault';
import { numDateLabel } from '../../lib/history';
import { CAN_OPEN, openBackup, saveBackup } from '../../platform/backupFile';
import { applyBackup, makeBackup } from '../../store/backup';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_LABEL, LS_TIGHT, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Btn } from '../panels/shell';
import { Col, Row } from '../ui/Row';

/**
 * BACKUP — the fifth block on GAME SETTINGS, and the only one that is not a
 * switch.
 *
 * ## WHY IT IS ON THIS PAGE
 *
 * Because there is nowhere better and it does not deserve a room. It is not a
 * game rule, so it is not the board; it is not the club, so it is not TEAM; and
 * it is read once, acted on, and not looked at again for a month — which is the
 * definition of the page a scorer scrolls rather than the screen they score on.
 * It goes LAST, under the board's own behaviour, for the reason the whole page
 * is ordered: how often it is touched.
 *
 * ## THE TWO VERBS, AND ONLY ONE OF THEM ASKS
 *
 * Saving is safe, so it is one press. Restoring REPLACES the club, the roster
 * and every saved game on this device, so it is two: pick the file, then look
 * at what is in it and say yes. The second step DRAWS the backup rather than
 * describing it — how many games, and when it was written — which is the same
 * argument `PSubject` makes on the two game confirms. A scorer about to
 * overwrite a season should be looking at the season that is arriving.
 *
 * There is no paragraph under either button. This page carries no explanatory
 * lines and this block does not get an exception; the labels say what happens,
 * and `say()` reports what did — the one confirmation channel the rest of the
 * app already uses.
 *
 * ## THE ONE SENTENCE THAT DOES RENDER
 *
 * A standing storage fault, and it is not a hint under a field — it is an
 * alarm about the disk, printed where a scorer can act on it, with the button
 * that acts on it directly beneath. `hooks/useStorageFault.ts` raises the same
 * fault as a toast the moment it happens; a toast lives 2.6 seconds and this is
 * where it is still true an hour later.
 */
export function Backup() {
  const m = useMetrics();
  const t = useTheme();
  const say = useUiStore((s) => s.say);

  const [busy, setBusy] = useState(false);
  /** a file that has been read and understood, waiting to be said yes to */
  const [pending, setPending] = useState<Backup | null>(null);
  const [fault, setFault] = useState<Fault | null>(() => storageFault());

  useEffect(() => onStorageFault(setFault), []);

  const save = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const json = await makeBackup();
      const ok = await saveBackup(json, backupFileName());
      say(ok ? 'Backup saved' : 'The backup could not be saved', !ok);
    } catch {
      say('The backup could not be saved', true);
    } finally {
      setBusy(false);
    }
  };

  const open = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const raw = await openBackup();
      // a cancelled picker is not a failure and says nothing
      if (raw === null) return;
      const read = readBackup(raw);
      if ('fault' in read) {
        say(BACKUP_REFUSAL[read.fault], true);
        return;
      }
      setPending(read.backup);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (): Promise<void> => {
    if (busy || !pending) return;
    setBusy(true);
    const { games } = countsOf(pending);
    try {
      await applyBackup(pending);
      setPending(null);
      say(games === 1 ? 'Restored 1 game' : `Restored ${games} games`);
    } catch {
      say('The backup could not be restored', true);
    } finally {
      setBusy(false);
    }
  };

  const counts = pending ? countsOf(pending) : null;

  return (
    <Col gap={m.s3} style={{ padding: m.s3 }}>
      {!!fault && (
        <Text
          style={{
            ...fUi(600),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: t.danger,
          }}
        >
          {FAULT_NOTE[fault]}
        </Text>
      )}

      {counts ? (
        <>
          {/* THE SUBJECT OF THE DECISION, drawn rather than described: what is
              in the file, between two hairlines, with the count as the figure
              — the shelf row's own grammar. */}
          <Row
            gap={m.s2}
            style={{
              minWidth: 0,
              paddingVertical: m.s3,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: t.rule,
            }}
          >
            <Col gap={m.s1} style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...fUi(500),
                  fontSize: m.fsSm,
                  letterSpacing: ls(m.fsSm, LS_LABEL),
                  color: t.ink2,
                }}
              >
                {[counts.club && 'Club', counts.roster && 'Roster']
                  .filter(Boolean)
                  .join(' · ') || 'Saved games'}
              </Text>
              <Text numberOfLines={1} style={{ ...fUi(400), fontSize: m.fsXs, color: t.ink3 }}>
                {pending?.savedAt ? numDateLabel(pending.savedAt) : 'Undated'}
              </Text>
            </Col>

            <Text
              style={{
                flexShrink: 0,
                ...fNum(700),
                fontSize: m.fsXl,
                letterSpacing: ls(m.fsXl, LS_TIGHT),
                fontVariant: ['tabular-nums'],
                color: t.ink,
              }}
            >
              {counts.games}
            </Text>
          </Row>

          <Row gap={m.s2} align="stretch">
            <Col style={{ flex: 1 }}>
              <Btn label="Cancel" variant="plain" onPress={() => setPending(null)} />
            </Col>
            <Col style={{ flex: 1 }}>
              {/* it replaces the club, the roster and every saved game here */}
              <Btn
                label={busy ? 'Restoring…' : 'Replace everything'}
                variant="danger"
                disabled={busy}
                onPress={() => void restore()}
              />
            </Col>
          </Row>
        </>
      ) : (
        <Row gap={m.s2} align="stretch">
          <Col style={{ flex: 1 }}>
            <Btn
              label={busy ? 'Working…' : 'Save a backup'}
              variant="surface"
              disabled={busy}
              onPress={() => void save()}
            />
          </Col>
          {CAN_OPEN && (
            <Col style={{ flex: 1 }}>
              <Btn
                label="Restore from a file"
                variant="plain"
                disabled={busy}
                onPress={() => void open()}
              />
            </Col>
          )}
        </Row>
      )}
    </Col>
  );
}
