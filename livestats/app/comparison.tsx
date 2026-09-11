import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AfterTimeouts, CompareTable, PlayerImpact, WhatChanged } from '../components/stats/Compare';
import { PickField, PickOption, type Subject } from '../components/stats/Pick';
import { Bloom } from '../components/ui/Bloom';
import { DarkRoom } from '../components/ui/DarkRoom';
import { Locked } from '../components/ui/Locked';
import { Press } from '../components/ui/Press';
import { Col, Row } from '../components/ui/Row';
import { useLocked } from '../hooks/useGate';
import { useActiveSquad } from '../hooks/useActiveSquad';
import { useSavedRows, type SavedGame } from '../hooks/useSavedGames';
import { squadIdOf } from '../lib/squads';
import { periodRows, playerImpact, poolNote, teamComparison, timeoutRun } from '../lib/analysis';
import { dayMonthLabel, numDateLabel, outcomeOf, summaryKind } from '../lib/history';
import { competitionLabel, opponentLabel } from '../lib/team';
import { useMetrics } from '../theme/metrics';
import { LS_LABEL, LS_TITLE, fUi, ls } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * ONE GAME AGAINST THE REST OF THE SEASON — the COMPARISON.
 *
 * It was THE LAST GAME's analysis and it is now any game's comparison, which
 * is one change and not two: the arithmetic never cared which game it was
 * handed, and the page was the only thing insisting the answer was the newest
 * row on the shelf. A scorer looking at Saturday's win is as often asking
 * *were we better than we were in the cup game* as *were we better than usual*,
 * and those are the same question with a different baseline.
 *
 * TWO FIELDS AND NO PANEL. The STATS tab this page is opened from mounts no
 * `<PanelHost />` at all, so choosing is a STATE of this page: a field opens,
 * the blocks below it stand down, and the list of games IS the page until one
 * is picked. A modal system added to that room for one screen would be a
 * second one to keep in step with the board's.
 *
 * IT IS A PAGE AND NOT A SHEET, the same call `app/settings.tsx` and
 * `app/paywall.tsx` are — a table you read, compare and scroll.
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

/** The baseline that is not a game: every other official game, averaged. */
const AVERAGE = 'average';

/** A saved game, drawn the shelf's way — the one shape both fields print. */
const subjectOf = (row: SavedGame, long: boolean): Subject => {
  const opponent = row.summary.opponent ?? row.game.opponent ?? '';
  // THE RAW STRING IS TESTED, not the label. `competitionLabel` answers
  // `Unfiled`, which is right on a shelf that has to print something in a
  // column and wrong here, where the tail is a list of the things that are
  // KNOWN about this game — a gap named is worse than a gap left out.
  const raw = row.game.competition ?? '';
  const date = long ? numDateLabel(row.summary.endedAt) : dayMonthLabel(row.summary.endedAt);
  return {
    line: opponent ? `vs ${opponentLabel(opponent)}` : 'Game',
    tail: [raw.trim() ? competitionLabel(raw) : '', date].filter(Boolean).join(' · '),
    mark: outcomeOf(row.summary),
    us: row.summary.score,
    them: row.summary.oppScore,
  };
};

function ComparisonScreen() {
  const m = useMetrics();
  const t = useTheme();
  const safe = useSafeAreaInsets();
  const gated = useLocked('season');

  const rows = useSavedRows();
  const { squad } = useActiveSquad();

  // ONE TEAM'S SEASON, in the season's own order, and BOTH filters matter.
  //
  // The team's, because the baseline is "every other official game" and a
  // club's other teams played in other competitions against other opposition:
  // measuring Saturday's first team against the second team's average is not a
  // comparison, it is two samples in one column.
  //
  // Official, because a practice keeps its box score and stays out of the
  // comparison exactly as it stays out of the season line — the tab this page
  // is opened from has already made that split and would disagree with it here
  // otherwise.
  const official = useMemo<SavedGame[] | null>(
    () =>
      rows
        ? rows.filter(
            (r) =>
              squadIdOf(r.summary) === (squad?.id ?? '') &&
              summaryKind(r.summary) !== 'practice',
          )
        : null,
    [rows, squad],
  );

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string>(AVERAGE);
  const [open, setOpen] = useState<'game' | 'base' | null>(null);

  // THE NEWEST GAME UNTIL SOMEBODY SAYS OTHERWISE, and it resolves rather than
  // being seeded into state: the games arrive after the first render, and an
  // id stashed in an effect would be a second copy of the same answer that can
  // go stale when a game is deleted from MATCHES.
  const subject = official?.find((r) => r.id === pickedId) ?? official?.[0] ?? null;

  const others = useMemo(
    () => (official && subject ? official.filter((r) => r.id !== subject.id) : []),
    [official, subject],
  );

  // A BASELINE THAT NO LONGER EXISTS FALLS BACK TO THE AVERAGE rather than
  // holding an id nothing answers to — picking the compared game as the
  // subject is the ordinary way to reach that state, and a page that emptied
  // itself over it would be a page that punishes a normal tap.
  const base = baseId === AVERAGE ? null : (others.find((r) => r.id === baseId) ?? null);
  const pool = useMemo(
    () => (base ? [base.game] : others.map((r) => r.game)),
    [base, others],
  );

  const comparison = useMemo(
    () => (subject ? teamComparison(subject.game, pool) : null),
    [subject, pool],
  );
  const periods = useMemo(
    () => (subject ? periodRows(subject.game, pool) : null),
    [subject, pool],
  );
  const impact = useMemo(
    () => (subject ? playerImpact(subject.game, pool) : []),
    [subject, pool],
  );

  // THE GAME AGAINST ITSELF, and it is memoised beside the rest for the same
  // reason: it walks the whole log.
  const run = useMemo(() => (subject ? timeoutRun(subject.game) : null), [subject]);

  // the baseline column's head. `Avg` when it is every other official game; the
  // DATE when it is one of them, which ties the column to the row above it
  const head = base ? dayMonthLabel(base.summary.endedAt) : 'Avg';
  const note = base ? '' : poolNote(comparison?.baseGames ?? 0);

  const baseSubject: Subject = base
    ? subjectOf(base, true)
    : {
        line: 'Team average',
        tail: `${others.length} other official game${others.length === 1 ? '' : 's'}`,
      };

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
          Comparison
        </Text>
      </Row>

      {gated ? (
        <Col justify="center" style={{ flex: 1 }}>
          <Locked
            gate="season"
            blurb="How one game went against the average of the season — or against another game."
          />
        </Col>
      ) : !comparison || !subject ? (
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
            {/* ── WHICH GAME, AND AGAINST WHAT ───────────────────────────
                Two fields, one over the other, each drawing the game it holds
                the way the shelf draws every row. The comparison below them is
                whatever these two say it is. */}
            <Col gap={m.s2}>
              <PickField
                label="GAME"
                subject={subjectOf(subject, true)}
                open={open === 'game'}
                onPress={() => setOpen(open === 'game' ? null : 'game')}
              />
              <PickField
                label="AGAINST"
                subject={baseSubject}
                open={open === 'base'}
                onPress={() => setOpen(open === 'base' ? null : 'base')}
              />
            </Col>

            {open === 'game' ? (
              <Col>
                {official!.map((r, i) => (
                  <PickOption
                    key={r.id}
                    subject={subjectOf(r, false)}
                    on={r.id === subject.id}
                    first={i === 0}
                    onPress={() => {
                      setPickedId(r.id);
                      setOpen(null);
                    }}
                  />
                ))}
              </Col>
            ) : open === 'base' ? (
              <Col>
                <PickOption
                  subject={{
                    line: 'Team average',
                    tail: `${others.length} other official game${others.length === 1 ? '' : 's'}`,
                  }}
                  on={base === null}
                  first
                  onPress={() => {
                    setBaseId(AVERAGE);
                    setOpen(null);
                  }}
                />
                {others.map((r) => (
                  <PickOption
                    key={r.id}
                    subject={subjectOf(r, false)}
                    on={r.id === base?.id}
                    first={false}
                    onPress={() => {
                      setBaseId(r.id);
                      setOpen(null);
                    }}
                  />
                ))}
              </Col>
            ) : (
              <>
                {/* ── WHAT MOVED, before the tables that show it ──────────
                    The same reading order the STATS tab's TEAM slice has:
                    what stands out, and then the numbers it stood out of. */}
                <Col gap={m.s2}>
                  <SectionLabel>What changed?</SectionLabel>
                  <WhatChanged highlights={comparison.highlights} />
                </Col>

                {comparison.groups.map((g) => (
                  <Col key={g.key} gap={m.s2}>
                    <SectionLabel>{g.title}</SectionLabel>
                    <CompareTable
                      rows={g.rows}
                      base={head}
                      /* THE POOLING NOTE IS PRINTED ONCE, and under SHOOTING,
                         because that is the block where pooling and meaning are
                         two different numbers. A note under all eight tables is
                         the same sentence eight times. */
                      note={g.key === 'shooting' ? note : undefined}
                    />

                    {/* the period table rides under SCORING, which is the
                        block it is a breakdown of */}
                    {g.key === 'scoring' && !!periods && (
                      <Col gap={m.s2} style={{ paddingTop: m.s3 }}>
                        <SectionLabel>Points by period</SectionLabel>
                        <CompareTable rows={periods} base={head} />
                      </Col>
                    )}
                  </Col>
                ))}

                {/* ── WHO PLAYED ABOVE OR BELOW THEIR OWN NORMAL ─────────
                    Every player against THEMSELVES, in the game's own order,
                    with nothing ranked. */}
                <Col gap={m.s2}>
                  <SectionLabel>Players</SectionLabel>
                  <PlayerImpact rows={impact} />
                </Col>

                {/* ── AND THE ONE BLOCK THAT IS NOT ABOUT THE OTHER GAMES ─
                    A timeout is the only thing on that board a COACH did, and
                    the question it asks is whether the team came out of it
                    playing better — which is a question about this game
                    against itself, not against the season. It sits under
                    everything that IS the season for that reason, and it draws
                    its own sentence when the game left nothing to measure. */}
                <Col gap={m.s2}>
                  <SectionLabel>After timeouts</SectionLabel>
                  <AfterTimeouts run={run} timeouts={subject.game.timeouts ?? 0} />
                </Col>
              </>
            )}
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
export default function Comparison() {
  return (
    <DarkRoom>
      <ComparisonScreen />
    </DarkRoom>
  );
}
