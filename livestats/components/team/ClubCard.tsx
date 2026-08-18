import { Text, View } from 'react-native';

import { useTeamStore } from '../../store/teamStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Card, Seam } from '../stats/parts';
import { Crest } from '../ui/Crest';
import { Icon, PENCIL } from '../ui/Icon';
import { Press } from '../ui/Press';
import { Col } from '../ui/Row';

/**
 * One of the two bench cells. It is a NAME, not a number, so it takes `fUi` and
 * puts the label on top — the stats screen's `Tile` is the other way round
 * because a headline number is what is being read there and here it is a
 * person. `—` when unset, and unset is the common case: most scorers keeping
 * stats for their own club ARE the coach.
 */
function Coach({ label, name }: { label: string; name: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Col
      gap={2}
      style={{
        flex: 1,
        minWidth: 0,
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        backgroundColor: t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          fontFamily: fUi(600),
          fontSize: m.fsMd,
          color: name ? t.ink : t.ink3,
        }}
      >
        {name || '—'}
      </Text>
    </Col>
  );
}

/**
 * THE CLUB CARD — the half of "my team" that is not a list of people.
 *
 * Crest, name, and the two coaches under a seam. On the TEAM tab the whole top
 * row opens the editor, because the crest is the thing a scorer reaches for
 * when they want to change the crest; the pencil is there so the row reads as
 * editable rather than merely tappable, exactly as it is on a player row.
 *
 * `readOnly` is the NEW GAME picker, and it is the same card because it is the
 * same fact — who this board belongs to. What it is NOT there is a way in: a
 * club is renamed on the team screen, not thirty seconds before tip-off with a
 * scoresheet in the other hand, and a rename mid-picker would change the name
 * this game is about to be filed under. Without the press the pencil goes too,
 * or the card would promise an editor that never opens.
 */
export function ClubCard({ readOnly = false }: { readOnly?: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const club = useTeamStore((s) => s.profile);
  const open = useUiStore((s) => s.open);

  const face = {
    minHeight: m.tap,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: m.s3,
    padding: m.s3,
    backgroundColor: t.surface,
  };

  const inside = (
    <>
      <Crest name={club.name} uri={club.logoUri} size={Math.round(m.fs2xl * 1.4)} />

      <Col style={{ flexShrink: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontFamily: fNum(700),
            fontSize: m.fsXl,
            letterSpacing: ls(m.fsXl, LS_BTN),
            color: t.ink,
          }}
        >
          {club.name.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fUi(500),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_LABEL),
            color: t.ink3,
          }}
        >
          {readOnly ? 'PLAYING TONIGHT' : club.logoUri ? 'TAP TO EDIT' : 'TAP TO ADD A CREST'}
        </Text>
      </Col>

      {!readOnly && (
        <View style={{ marginLeft: 'auto', flexGrow: 0, flexShrink: 0 }}>
          <Icon d={PENCIL} size={m.fsMd} color={t.ink3} />
        </View>
      )}
    </>
  );

  return (
    <Card>
      {readOnly ? (
        <View style={face}>{inside}</View>
      ) : (
        <Press
          onPress={() => open({ kind: 'editTeam' })}
          accessibilityLabel="edit team name, crest and coaches"
          style={face}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          {inside}
        </Press>
      )}

      <View style={{ height: 1, backgroundColor: t.rule }} />

      <Seam>
        <Coach label="HEAD COACH" name={club.coach} />
        <Coach label="ASSISTANT" name={club.assistant} />
      </Seam>
    </Card>
  );
}
