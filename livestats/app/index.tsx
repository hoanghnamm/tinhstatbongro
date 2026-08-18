import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanelHost } from '../components/panels/PanelHost';
import { Btn, Row as BtnRow } from '../components/panels/shell';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import type { Options } from '../constants/options';
import { mmss, ord, pct } from '../lib/format';
import { ROSTER_CAP, STARTERS } from '../lib/roster';
import { totals } from '../lib/stats';
import { useGameStore } from '../store/gameStore';
import { useRosterStore } from '../store/rosterStore';
import { useByIdLookup } from '../store/selectors';
import { useUiStore } from '../store/uiStore';
import { useMetrics } from '../theme/metrics';
import { LS_BTN, LS_LABEL, fNum, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/** One column, centred, in both orientations. Landscape is where the cap bites. */
const COL = 420;

/**
 * The three skins the switcher offers. `auto` is the shipped default and stays
 * first — dropping it would make "follow the system" unreachable, which is a
 * regression dressed as a simplification. The two frosted skins are still not
 * exposed; they never were.
 */
const SKINS: { key: Options['skin']; label: string }[] = [
  { key: 'auto', label: 'AUTO' },
  { key: 'light', label: 'LIGHT' },
  { key: 'dark', label: 'DARK' },
];

/** 'MY TEAM' → 'MT'. The crest is a monogram, so it takes two letters at most. */
const monogram = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/* ---- the card's pieces ---------------------------------------------
 * A band, then a run of cells divided by 1px seams — the same construction the
 * panel grids use, and for the same reason: a rule-coloured parent showing
 * through 1px gaps, so the cells must be opaque and edgeless.
 *
 * The rows take their height from their CONTENT rather than from `flex:1`,
 * because this card sits in a column sized by what is in it and a `flex:1`
 * child of one of those collapses to nothing.
 *
 * They are module-level components on purpose: declared inside `HomeScreen`
 * they would be a new type on every render, and the clock ticking once a second
 * would remount the whole card under it.
 * ------------------------------------------------------------------ */

function Band({ label, note }: { label: string; note?: ReactNode }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Row
      gap={m.s2}
      style={{
        paddingVertical: m.s2,
        paddingHorizontal: m.s3,
        backgroundColor: t.surface2,
        borderBottomWidth: 1,
        borderBottomColor: t.rule,
      }}
    >
      <Text
        style={{
          fontFamily: fNum(500),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
      {!!note && <View style={{ marginLeft: 'auto' }}>{note}</View>}
    </Row>
  );
}

function Cell({
  value,
  label,
  tone,
  big = false,
}: {
  value: string | number;
  label: string;
  /** ink only — a cell keeps its opaque surface, or it eats its own seam */
  tone?: string;
  big?: boolean;
}) {
  const m = useMetrics();
  const t = useTheme();
  const fs = big ? m.fs2xl : m.fsXl;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        paddingVertical: big ? m.s3 : m.s2,
        backgroundColor: t.surface,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fNum(700),
          fontSize: fs,
          lineHeight: fs * 1.1,
          color: tone ?? t.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fUi(600),
          fontSize: m.fsXs,
          letterSpacing: ls(m.fsXs, LS_LABEL),
          color: t.ink2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** A run of cells with the seam showing between them. */
function Seam({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Row align="stretch" gap={1} style={{ backgroundColor: t.rule }}>
      {children}
    </Row>
  );
}

export default function HomeScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();

  const roster = useRosterStore((s) => s.players.length);
  const players = useByIdLookup();
  const team = useGameStore((s) => s.team.name);
  const score = useGameStore((s) => s.score);
  const oppScore = useGameStore((s) => s.oppScore);
  const period = useGameStore((s) => s.period);
  const remaining = useGameStore((s) => s.remaining);
  const running = useGameStore((s) => s.running);
  const ended = useGameStore((s) => s.ended);
  const played = useGameStore((s) => s.events.length > 0);
  const skin = useGameStore((s) => s.options.skin);
  const setOption = useGameStore((s) => s.setOption);
  const open = useUiStore((s) => s.open);

  const inProgress = played && !ended;
  const enough = roster >= STARTERS;
  const T = totals(players);

  const newGame = () => {
    // losing a live game to a mis-tap is the worst thing this screen can do
    if (inProgress) open({ kind: 'newGame' });
    else router.push('/start');
  };

  const crest = Math.round(m.fs4xl * 1.35);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s2,
        paddingBottom: safe.bottom + m.s3,
        paddingLeft: safe.left + m.s5,
        paddingRight: safe.right + m.s5,
      }}
    >
      {/* the skin switcher takes the corner the reference gives the avatar:
          out of the column, so it never pushes the wordmark off centre */}
      <Row justify="flex-end" style={{ flexGrow: 0, flexShrink: 0 }}>
        <Row
          align="stretch"
          gap={1}
          style={{
            backgroundColor: t.rule,
            borderRadius: m.rSm,
            overflow: 'hidden',
            flexGrow: 0,
            flexShrink: 0,
          }}
        >
          {SKINS.map((s) => {
            const on = skin === s.key;
            return (
              <Press
                key={s.key}
                onPress={() => setOption('skin', s.key)}
                accessibilityLabel={`${s.label.toLowerCase()} theme`}
                style={{
                  minHeight: m.tap,
                  paddingHorizontal: m.s3,
                  alignItems: 'center',
                  justifyContent: 'center',
                  // the selected cell is the one inverted surface on this
                  // screen, so it carries BOTH halves of the pair
                  backgroundColor: on ? t.accent : t.surface,
                }}
                pressedStyle={on ? undefined : { backgroundColor: t.surface2 }}
              >
                <Text
                  style={{
                    fontFamily: fNum(on ? 700 : 500),
                    fontSize: m.fsXs,
                    letterSpacing: ls(m.fsXs, LS_LABEL),
                    color: on ? t.accentInk : t.ink2,
                  }}
                >
                  {s.label}
                </Text>
              </Press>
            );
          })}
        </Row>
      </Row>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: m.spLg,
        }}
      >
        <Col style={{ width: '100%', maxWidth: COL }} align="stretch" gap={m.sp}>
          {/* ---- identity ------------------------------------------- */}
          <Col align="center" gap={m.s3} style={{ marginBottom: m.s2 }}>
            <View
              style={{
                width: crest,
                height: crest,
                flexGrow: 0,
                flexShrink: 0,
                borderRadius: crest / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.ink,
              }}
            >
              <Text
                style={{
                  fontFamily: fNum(700),
                  fontSize: crest * 0.42,
                  lineHeight: crest * 0.5,
                  letterSpacing: ls(crest * 0.42, LS_BTN),
                  color: t.surface,
                }}
              >
                {monogram(team)}
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(700),
                fontSize: m.fs2xl,
                lineHeight: m.fs2xl * 1.1,
                letterSpacing: ls(m.fs2xl, LS_BTN),
                color: t.ink,
              }}
            >
              HOOPLOG
            </Text>

            <Text
              numberOfLines={1}
              style={{
                fontFamily: fNum(500),
                fontSize: m.fsSm,
                letterSpacing: ls(m.fsSm, LS_LABEL),
                color: t.ink2,
              }}
            >
              {team}
            </Text>
          </Col>

          {/* ---- the game card -------------------------------------- */}
          <View
            style={{
              borderWidth: 1,
              borderColor: t.rule,
              borderRadius: m.r,
              overflow: 'hidden',
              backgroundColor: t.surface,
            }}
          >
            <Band
              label={ended ? 'FINAL' : played ? `${ord(period).toUpperCase()} QUARTER` : 'NO GAME YET'}
              note={
                <Row gap={m.s2}>
                  {/* the live dot borrows the court's mark colour — the one hue
                      no skin spends anywhere else, and it already means "now" */}
                  {running && (
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        flexGrow: 0,
                        flexShrink: 0,
                        backgroundColor: t.mark,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontFamily: fNum(500),
                      fontSize: m.fsXs,
                      color: played ? t.ink2 : t.ink3,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {played ? mmss(remaining) : '--:--'}
                  </Text>
                </Row>
              }
            />

            <Seam>
              <Cell
                big
                value={score}
                label="US"
                tone={score > oppScore ? t.accent : t.ink}
              />
              <Cell
                big
                value={oppScore}
                label="THEM"
                tone={oppScore > score ? t.accent : t.ink}
              />
            </Seam>

            <Band label={ended ? 'LAST GAME' : 'THIS GAME'} />

            {/* the reference's six, in its order: the three rates on top and
                the three counts under them */}
            <Col gap={1} style={{ backgroundColor: t.rule }}>
              <Seam>
                <Cell value={T.pts} label="POINTS" />
                <Cell value={pct(T.fgm, T.fga)} label="FG%" />
                <Cell value={pct(T.ftm, T.fta)} label="FT%" />
              </Seam>
              <Seam>
                <Cell value={T.reb} label="REBOUNDS" />
                <Cell value={T.ast} label="ASSISTS" />
                <Cell value={T.to} label="TURNOVERS" />
              </Seam>
            </Col>
          </View>

          {/* ---- the way on ----------------------------------------- */}
          {inProgress && (
            <BtnRow>
              <Btn label="RESUME GAME" variant="solid" onPress={() => router.push('/game')} />
            </BtnRow>
          )}

          <BtnRow>
            <Btn label="NEW GAME" variant="accent" disabled={!enough} onPress={newGame} />
          </BtnRow>

          <BtnRow>
            <Btn label="MY TEAM" variant="surface" onPress={() => router.push('/team')} />
          </BtnRow>

          <Text
            accessibilityLiveRegion="polite"
            style={{
              marginTop: m.s1,
              textAlign: 'center',
              fontFamily: fNum(500),
              fontSize: m.fsSm,
              letterSpacing: ls(m.fsSm, LS_LABEL),
              color: t.ink2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {enough ? `${roster}/${ROSTER_CAP} PLAYERS` : `NEED AT LEAST ${STARTERS} PLAYERS`}
          </Text>
        </Col>
      </ScrollView>

      <PanelHost />
    </View>
  );
}
