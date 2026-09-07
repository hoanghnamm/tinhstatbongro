import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AfterTimeouts, CompareTable, WhatChanged } from '../components/stats/Compare';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { GlowText } from '../components/ui/GlowText';
import { Locked } from '../components/ui/Locked';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { useLocked } from '../hooks/useGate';
import { useSavedRows, type SavedGame } from '../hooks/useSavedGames';
import { teamComparison, timeoutRun } from '../lib/analysis';
import { numDateLabel, outcomeOf, summaryKind } from '../lib/history';
import { competitionLabel, opponentLabel } from '../lib/team';
import { useMetrics } from '../theme/metrics';
import {
  LS_CAPS,
  LS_LABEL,
  LS_MICRO,
  LS_TIGHT,
  LS_TITLE,
  fNum,
  fUi,
  ls,
} from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * THE LAST GAME AGAINST THE RUN BEHIND IT.
 *
 * IT IS A PAGE AND NOT A SHEET, and that is the same call `app/settings.tsx`
 * and `app/paywall.tsx` are: every panel in this app is ONE DECISION made with
 * the game in front of you, and this is a table you read, compare and scroll.
 * The STATS tab it is opened from mounts no `<PanelHost />` at all — a modal
 * system added to that room for one screen would be a second one to keep in
 * step with the board's.
 *
 * IT READS THE GAMES ITSELF rather than taking them through the route. A
 * season of thirty games does not go in a query param, and the alternative —
 * `player/[id]`'s JSON blob — is a copy of the shelf travelling through a URL.
 * `useSavedRows` is the same one effect the STATS tab already runs, so opening
 * this page costs the same thirty reads that screen just paid, on a screen
 * nobody opens during a possession.
 *
 * AND IT GUARDS ITSELF. Every route in reaches it from behind the season gate
 * already; a page that trusts its callers is one new caller away from being a
 * hole in the wall, which is the argument `competition.tsx` and `player/[id]`
 * both carry.
 */
function AnalysisScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const gated = useLocked('season');

  const rows = useSavedRows();

  // THE SEASON'S OWN GAMES, in the season's own order. A practice keeps its
  // box score and stays out of the form guide, exactly as it stays out of the
  // season line — the tab this page is opened from has already made that split
  // and would disagree with it here otherwise.
  const official = useMemo<SavedGame[] | null>(
    () => (rows ? rows.filter((r) => summaryKind(r.summary) !== 'practice') : null),
    [rows],
  );

  const last = official?.[0] ?? null;
  const comparison = useMemo(
    () => (official ? teamComparison(official.map((r) => r.game)) : null),
    [official],
  );

  // THE LAST GAME AGAINST ITSELF, and it is memoised beside the comparison
  // for the same reason: it walks the whole log.
  const run = useMemo(() => (last ? timeoutRun(last.game) : null), [last]);

  const outcome = last ? outcomeOf(last.summary) : null;
  const opponent = last?.summary.opponent ?? last?.game.opponent ?? '';
  // THE RAW STRING IS TESTED, not the label. `competitionLabel` answers
  // `Unfiled`, which is right on a shelf that has to print something in a
  // column and wrong here, where the line is a list of the things that are
  // known about this game — a gap named is worse than a gap left out.
  const raw = last?.game.competition ?? '';
  const competition = raw.trim() ? competitionLabel(raw) : '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.bg,
        paddingTop: safe.top + m.s2,
        paddingLeft: safe.left + m.s4,
        paddingRight: safe.right + m.s4,
      }}
    >
      {/* first child, outside the padded flow: it runs edge to edge under the
          safe-area inset, which is what makes it a bloom and not a band */}
      <Bloom />

      <Row gap={m.s2} style={{ minHeight: m.tap, flexGrow: 0, flexShrink: 0 }}>
        <Press
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/season'))}
          accessibilityLabel="back"
          style={{
            width: m.tap,
            minHeight: m.tap,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: m.rSm,
          }}
          pressedStyle={{ backgroundColor: t.surface2 }}
        >
          <Svg width={m.fsLg} height={m.fsLg} viewBox="0 0 24 24">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={t.ink}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Press>
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            minWidth: 0,
            ...fUi(700),
            fontSize: m.fsXl,
            letterSpacing: ls(m.fsXl, LS_TITLE),
            color: t.ink,
          }}
        >
          Last game
        </Text>
      </Row>

      {gated ? (
        <Col justify="center" style={{ flex: 1 }}>
          <Locked
            gate="season"
            blurb="How the last game went against the run of games before it."
          />
        </Col>
      ) : !comparison || !last ? (
        <Col align="center" justify="center" gap={m.s2} style={{ flex: 1 }}>
          <Text
            style={{
              ...fUi(500),
              fontSize: m.fsMd,
              letterSpacing: ls(m.fsMd, LS_LABEL),
              color: t.ink3,
            }}
          >
            {official === null ? 'Reading games…' : 'No official games yet'}
          </Text>
        </Col>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: m.s4, paddingBottom: safe.bottom + m.s6 }}
        >
          <Col gap={m.s5}>
            {/* ── WHICH GAME THIS IS, and a way into it ──────────────────
                It NAMES the game rather than merely dating it, because a
                comparison with no subject is six numbers about nothing — and
                it is a press, because the very next question after "we scored
                six more than usual" is "against whom, exactly". It goes to the
                saved game's own page, which is where the box score and the
                play log already are.

                THE SCORE IS OURS-THEN-THEIRS with `accent` on OUR number, the
                same split the shelf makes on every row and for the same
                reason: two figures beside a dash need one of them marked, or
                the reader has to remember which end they are. `W`/`L` rides at
                the end of the date line in accent and `danger`, again as the
                shelf does. */}
            <Press
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: last.id } })}
              accessibilityLabel={`open ${opponent ? opponentLabel(opponent) : 'the last game'}`}
              style={{ paddingVertical: m.s2 }}
              pressedStyle={{ opacity: 0.6 }}
            >
              <Row gap={m.s3}>
                <Col style={{ flex: 1, minWidth: 0 }} gap={2}>
                  <Text
                    numberOfLines={1}
                    style={{
                      ...fUi(600),
                      fontSize: m.fsLg,
                      letterSpacing: ls(m.fsLg, LS_LABEL),
                      color: t.ink,
                    }}
                  >
                    {opponent ? `vs ${opponentLabel(opponent)}` : 'Last game'}
                  </Text>
                  <Row gap={m.s2} style={{ minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        minWidth: 0,
                        ...fUi(400),
                        fontSize: m.fsXs,
                        letterSpacing: ls(m.fsXs, LS_MICRO),
                        color: t.ink3,
                      }}
                    >
                      {[competition, numDateLabel(last.summary.endedAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {!!outcome && (
                      <GlowText
                        style={{
                          ...fUi(700),
                          fontSize: m.fsXs,
                          letterSpacing: ls(m.fsXs, LS_CAPS),
                          color: outcome === 'W' ? t.accent : t.danger,
                        }}
                      >
                        {outcome}
                      </GlowText>
                    )}
                  </Row>
                </Col>

                <Row gap={m.s2} style={{ flexGrow: 0, flexShrink: 0 }}>
                  <GlowText
                    style={{
                      ...fNum(700),
                      fontSize: m.fsXl,
                      letterSpacing: ls(m.fsXl, LS_TIGHT),
                      color: t.accent,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {last.summary.score}
                  </GlowText>
                  <Text
                    style={{
                      ...fNum(500),
                      fontSize: m.fsSm,
                      color: t.ink3,
                    }}
                  >
                    —
                  </Text>
                  <Text
                    style={{
                      ...fNum(700),
                      fontSize: m.fsXl,
                      letterSpacing: ls(m.fsXl, LS_TIGHT),
                      color: t.ink,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {last.summary.oppScore}
                  </Text>
                  <Svg width={m.fsMd} height={m.fsMd} viewBox="0 0 24 24">
                    <Path
                      d="M9 5l7 7-7 7"
                      stroke={t.ink3}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </Row>
              </Row>
            </Press>

            <Col gap={m.s2}>
              <SectionLabel>Against the average</SectionLabel>
              <CompareTable comparison={comparison} />
            </Col>

            <Col gap={m.s2}>
              <SectionLabel>What changed?</SectionLabel>
              <WhatChanged highlights={comparison.highlights} />
            </Col>

            {/* ── AND THE ONE BLOCK THAT IS NOT ABOUT THE OTHER GAMES ────
                A timeout is the only thing on that board a COACH did, and
                the question it asks is whether the team came out of it
                playing better — which is a question about this game against
                itself, not against the run behind it. It sits under the two
                blocks that ARE the run for that reason, and it draws its own
                sentence when the game left nothing to measure. */}
            <Col gap={m.s2}>
              <SectionLabel>After timeouts</SectionLabel>
              <AfterTimeouts run={run} timeouts={last.game.timeouts ?? 0} />
            </Col>
          </Col>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * A block's own name, and it sits OUTSIDE whatever it names — the same
 * construction `Section` uses on the stats screen, without the `Card` that one
 * wraps its children in. Nothing on this page is in a card.
 */
function SectionLabel({ children }: { children: string }) {
  const m = useMetrics();
  const t = useTheme();
  return (
    <Text
      style={{
        ...fUi(600),
        fontSize: m.fsSm,
        letterSpacing: ls(m.fsSm, LS_LABEL),
        color: t.ink2,
      }}
    >
      {children}
    </Text>
  );
}

/** The palette and the status bar, from the same wrapper the tab group uses. */
export default function Analysis() {
  return (
    <DarkRoom>
      <AnalysisScreen />
    </DarkRoom>
  );
}
