import { Text, View } from 'react-native';

import { FOULS } from '../../constants/game';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useGameStore } from '../../store/gameStore';
import { useOnBench, usePlayer } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { fNum } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Press } from '../ui/Press';
import { Btn, Empty, Note, PTitle, Row, Stack } from './shell';

/**
 * The one list that is not a tile grid: after a disqualification the question
 * is who replaces them, and the bench is short enough to read as rows.
 *
 * IT IS ALSO THE ONE PANEL A SCORER MAY NOT WALK AWAY FROM. A fouled-out player
 * used to sit in the rail dimmed for as long as they were left there, so the
 * column said five while the floor had four on it; the fifth foul opens this
 * and, while there is anybody on the bench, the scrim and the hardware back
 * button do nothing (see `owesSub` and `PanelHost`). That is not a trap, it is
 * the rule: a team with substitutes available has to field five.
 *
 * What it owes in exchange is a way out of a MIS-TAP, and there is exactly one
 * honest one. `fresh` means the foul that put them out is still the top of the
 * undo stack — the panel was opened by the foul itself — so UNDO THE FOUL takes
 * back that foul and nothing else. Reached later from a dimmed row it is false
 * and no such button is drawn, because the thing undo would pop then is
 * whatever the scorer did last, which is not this.
 *
 * The bench being EMPTY is the other way it lets go: there is nobody to bring
 * on, the team really is playing short, and CLOSE says so.
 */
export function FouledOutPanel({ playerId, fresh }: { playerId: string; fresh: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const p = usePlayer(playerId);
  const pool = useOnBench();
  const substitute = useGameStore((s) => s.substitute);
  const undo = useGameStore((s) => s.undo);
  const reset = useUiStore((s) => s.reset);

  useAnnounce(p ? `number ${p.number} has fouled out` : '');
  if (!p) return null;

  const short = pool.length === 0;

  return (
    <>
      <PTitle title={`#${p.number} has fouled out`} kind={`${FOULS} fouls`} tone="bad" />
      <Note>
        {short
          ? `${p.name} is off the court and cannot come back on. The bench is empty, so you are playing short.`
          : `${p.name} is off the court and cannot come back on. Pick who comes on for them — the five have to be filled.`}
      </Note>
      <Stack>
        <View style={{ height: m.sp }} />
        {pool.map((q) => (
          <Press
            key={q.id}
            onPress={() => {
              substitute(playerId, q.id);
              reset();
            }}
            accessibilityLabel={`#${q.number} ${q.name}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: m.sp,
              minHeight: m.tap,
              padding: m.sp,
              borderWidth: 2,
              borderColor: t.line,
              borderRadius: m.r,
            }}
            pressedStyle={{ backgroundColor: t.surface2 }}
          >
            <Text
              style={{
                flexGrow: 0, flexShrink: 0,
                ...fNum(700), fontSize: m.fsXl, color: t.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {q.number}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
                ...fNum(500), fontSize: m.fsMd, color: t.ink,
              }}
            >
              {q.name}
            </Text>
          </Press>
        ))}
        {short ? <Empty>The bench is empty. You are playing short.</Empty> : null}
        {/* CLOSE is drawn only when there is nothing to pick, and UNDO THE FOUL
            only when the foul that opened this is still the top of the stack.
            One of the three answers is always available; none of them is "leave
            them standing in the five". */}
        {short || fresh ? (
          <Row>
            {short ? (
              <Btn label="Close" variant="solid" onPress={reset} />
            ) : (
              <Btn
                label="Undo the foul"
                variant="plain"
                onPress={() => {
                  undo();
                  reset();
                }}
              />
            )}
          </Row>
        ) : null}
      </Stack>
    </>
  );
}
