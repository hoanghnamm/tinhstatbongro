import { Text, View } from 'react-native';

import { mmss } from '../../lib/format';
import { appeared } from '../../lib/season';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_LABEL, LS_MICRO, fNum, fUi, ls } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { Row } from '../ui/Row';
import type { Totals } from '../../lib/stats';
import type { Player } from '../../types';

/**
 * THE PLAYERS, COMPACT — two lines a name, and no sideways scroll.
 *
 * The full box score is twenty columns and has to scroll horizontally, which
 * is the right answer for a scorer copying a sheet out and the wrong one for
 * anybody who just wants to know who played and how it went. So this is what
 * PLAYERS opens on, and the twenty columns are one tap behind it.
 *
 * IT IS TWO LINES RATHER THAN NINE COLUMNS. Nine numeric columns on a 320dp
 * phone leaves about eighty points for a name, which is not a name — it is an
 * ellipsis. Splitting the row puts the two figures anybody reads first (the
 * minutes and the points) beside the name at full size, and the five that
 * qualify them on a caption line under it, where they can be laid out as
 * labelled pairs and read in any order.
 *
 * FOULS ARE PROMINENT AND NOT PREDICTED. `PF` is drawn in `danger` when the
 * player is actually OUT and never on a count of five: how many fouls
 * disqualify is a property of the ruleset — `lib/actions.ts` owns it, and
 * `FOUL_KINDS` decides which fouls even count — so a screen that lit up at
 * five would be a second, wrong copy of a rule that already has an owner.
 *
 * A PLAYER WHO DID NOT PLAY SAYS SO. `appeared` is the same test the season
 * divides by, so a DNP here and a DNP in the averages are the same fact rather
 * than two thresholds that drift.
 */

/** One labelled figure on the caption line. */
function Cell({ code, value, tone }: { code: string; value: string | number; tone?: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Row gap={m.s1} style={{ flexGrow: 0, flexShrink: 0 }}>
      <Text
        style={{
          ...fUi(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_CAPS),
          color: t.ink3,
        }}
      >
        {code}
      </Text>
      <Text
        style={{
          ...fNum(600),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_MICRO),
          color: tone ?? t.ink2,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </Row>
  );
}

function PlayerRow({ p, first }: { p: Player; first: boolean }) {
  const m = useMetrics();
  const t = useTheme();
  const s = p.stats;
  const played = appeared(p);
  const out = p.status === 'out';

  return (
    <View
      style={{
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.rule,
        backgroundColor: t.surface,
      }}
    >
      <Row gap={m.s2}>
        <Text
          style={{
            width: m.fsMd * 1.7,
            flexGrow: 0,
            flexShrink: 0,
            ...fNum(700),
            fontSize: m.fsSm,
            color: t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {p.number}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            ...fUi(p.starter ? 600 : 500),
            fontSize: m.fsSm,
            letterSpacing: ls(m.fsSm, LS_LABEL),
            color: played ? t.ink : t.ink3,
          }}
        >
          {p.name}
        </Text>
        <Text
          style={{
            width: m.fsSm * 3.2,
            flexGrow: 0,
            flexShrink: 0,
            textAlign: 'right',
            ...fNum(500),
            fontSize: m.fsSm,
            color: t.ink2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {mmss(s.secondsPlayed)}
        </Text>
        <Text
          style={{
            width: m.fsMd * 1.9,
            flexGrow: 0,
            flexShrink: 0,
            textAlign: 'right',
            ...fNum(700),
            fontSize: m.fsMd,
            color: played ? t.ink : t.ink3,
            fontVariant: ['tabular-nums'],
          }}
        >
          {s.points}
        </Text>
      </Row>

      {played ? (
        <Row gap={m.s3} style={{ marginTop: 2, flexWrap: 'wrap' }}>
          <Cell code="FG" value={`${s.fgMade}-${s.fgAttempted}`} />
          <Cell code="REB" value={s.offensiveRebounds + s.defensiveRebounds} />
          <Cell code="AST" value={s.assists} />
          <Cell code="TO" value={s.turnovers} />
          {/* the one figure on this line that can carry a hue, and only once
              the GAME has already decided the player is out */}
          <Cell code="PF" value={s.fouls} tone={out ? t.danger : undefined} />
          {out && (
            <Text
              style={{
                ...fUi(600),
                fontSize: m.fsXs,
                letterSpacing: ls(m.fsXs, LS_CAPS),
                color: t.danger,
              }}
            >
              OUT
            </Text>
          )}
        </Row>
      ) : (
        <Text
          style={{
            marginTop: 2,
            ...fUi(500),
            fontSize: m.fsXs,
            letterSpacing: ls(m.fsXs, LS_CAPS),
            color: t.ink3,
          }}
        >
          DNP
        </Text>
      )}
    </View>
  );
}

export function PlayerSummary({ lines, team }: { lines: Player[]; team: Totals }) {
  const m = useMetrics();
  const t = useTheme();

  return (
    <View>
      {lines.map((p, i) => (
        <PlayerRow key={p.id} p={p} first={i === 0} />
      ))}

      {/* the totals row, on the caption strip's own ground so it reads as the
          foot of the table rather than as one more player */}
      <View
        style={{
          paddingVertical: m.s2,
          paddingHorizontal: m.s3,
          borderTopWidth: 1,
          borderTopColor: t.rule,
          backgroundColor: t.surface2,
        }}
      >
        <Row gap={m.s2}>
          <Text
            style={{
              flex: 1,
              minWidth: 0,
              ...fUi(600),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink2,
            }}
          >
            Team
          </Text>
          <Text
            style={{
              width: m.fsSm * 3.2,
              flexGrow: 0,
              flexShrink: 0,
              textAlign: 'right',
              ...fNum(500),
              fontSize: m.fsSm,
              color: t.ink2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {mmss(team.sec)}
          </Text>
          <Text
            style={{
              width: m.fsMd * 1.9,
              flexGrow: 0,
              flexShrink: 0,
              textAlign: 'right',
              ...fNum(700),
              fontSize: m.fsMd,
              color: t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {team.pts}
          </Text>
        </Row>
        <Row gap={m.s3} style={{ marginTop: 2, flexWrap: 'wrap' }}>
          <Cell code="FG" value={`${team.fgm}-${team.fga}`} />
          <Cell code="REB" value={team.reb} />
          <Cell code="AST" value={team.ast} />
          <Cell code="TO" value={team.to} />
          <Cell code="PF" value={team.pf} />
        </Row>
      </View>
    </View>
  );
}
