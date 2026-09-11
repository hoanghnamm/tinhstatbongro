import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { Jersey } from '../ui/Jersey';
import { Col, Row } from '../ui/Row';
import { useMetrics } from '../../theme/metrics';
import { LS_CAPS, LS_TIGHT, PALETTE, fNum, fUi, ls } from '../../theme/tokens';
import { ThemeProvider } from '../../theme/useTheme';

/**
 * THE BOARD, IN MINIATURE, ON THE STEP THAT OPENS THE REAL ONE.
 *
 * ## IT IS THE LIGHT PALETTE, DELIBERATELY, INSIDE A DARK ROOM
 *
 * `PALETTE` is declared here rather than inherited, and it is the whole point
 * of the picture. The board is the one screen in this app that is LIGHT — a
 * white floor read at arm's length in gym lighting, so walking onto it feels
 * like the lights coming up — and a scorer three steps into a dark onboarding
 * has no way of knowing that. Showing the board in the room's own near-black
 * would be teaching them the wrong thing about the screen they are about to
 * spend a night on. So it is a slab of the real board, full-bleed against the
 * dark, and the contrast between the two IS the explanation.
 *
 * `ThemeProvider` rather than a wall of hexes: `Jersey` calls `useTheme()`
 * internally, and it draws the plate the picker hands over one tap later.
 *
 * ## IT IS A PICTURE AND NOT THE BOARD
 *
 * Nothing here presses, nothing reads a store and no number is real. The court
 * is drawn straight rather than through `CourtSvg`, and that is not a copy of
 * the geometry contract: `CourtSvg` renders lit zones off `ui.zone`, hit
 * regions, marks and a live tap, none of which exist on a page with no game
 * behind it. What is drawn here is the five LINES a scorer recognises the floor
 * by — the lane, the arc, the restricted circle, the backboard, the two lane
 * extensions — at the same 792x521 viewBox everything else in the app speaks.
 * If the real floor's geometry moves, this picture is not wrong; it is a
 * drawing of a basketball court.
 *
 * ## IT CARRIES NO NUMBERS, AND IT USED TO
 *
 * Three numbered chips rode on it — on the three keys, on the rail and on the
 * footer — each drawn a second time at the head of its own line underneath, so
 * that the picture and the list read as one thing. THE LIST IS GONE: the step
 * hands off to the WALKTHROUGH now, which teaches those four the only way that
 * actually holds, by having the scorer do them on the real board. A chip
 * pointing at a line that is no longer under it is a pointer at nothing, so
 * `Badge` and `Taps` went with the lines. What is left here is the one thing
 * the tour cannot say before it opens: this is what the screen LOOKS like.
 *
 * ## A RAIL ROW IS A JERSEY AND ITS FOULS, AND NOT A POINTS COLUMN
 *
 * The `12 pts` beside each plate was cut. This step is teaching WHERE A STAT
 * GOES IN, and a per-player total is a number that comes OUT — read on the box
 * score, not tapped on the rail. Five of them down the right edge also made the
 * rail the busiest block in a picture whose subject is the floor.
 */

/** The viewBox everything in this app draws a floor in. */
const VB = '0 0 792 521';

/** The two flanking columns, as a share of the picture's width. The real board
 *  computes these off the window; here they only have to LOOK like the board,
 *  and a fraction keeps the picture the same shape on every phone. */
const COL = 0.13;

/** How tall the whole slab is, as a share of the window. Big enough to read the
 *  jersey plates, small enough that the headline, its sentence and the two
 *  verbs under it are all on the step without it scrolling. */
const ART_H = 0.19;

/* ---- the pieces ---------------------------------------------------- */

/** One cell of a flanking column: opaque, edgeless, sitting in a 1px seam. */
function Key({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PALETTE.surface,
      }}
    >
      {children}
    </View>
  );
}

/** A column of them — the OPP buttons on one side, PF/FT/RB on the other. */
function KeyColumn({ w, children }: { w: number; children: ReactNode }) {
  return (
    <Col
      gap={1}
      style={{
        width: w,
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: PALETTE.rule,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {children}
    </Col>
  );
}

/** The code a key carries, at the board's own weight. */
function KeyCode({ label, fs }: { label: string; fs: number }) {
  return (
    <Text
      style={{
        ...fNum(600),
        fontSize: fs,
        letterSpacing: ls(fs, LS_TIGHT),
        color: PALETTE.ink,
        fontVariant: ['tabular-nums'],
      }}
    >
      {label}
    </Text>
  );
}

/** The caption under a code — OPP, POSS. The light half of the pair. */
function KeyCaption({ label, fs }: { label: string; fs: number }) {
  return (
    <Text
      style={{
        ...fUi(400),
        fontSize: fs,
        letterSpacing: ls(fs, LS_CAPS),
        color: PALETTE.ink2,
      }}
    >
      {label}
    </Text>
  );
}

/** The 1px rule between two cells of the footer's middle block. */
function Hair() {
  return <View style={{ width: 1, backgroundColor: PALETTE.rule, marginVertical: 6 }} />;
}

/** One of the five foul pips under a rail row's points: filled once used. */
function Pip({ on, d }: { on: boolean; d: number }) {
  return (
    <View
      style={{
        width: d,
        height: d,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: d / 2,
        borderWidth: on ? 0 : 1,
        borderColor: PALETTE.ink3,
        backgroundColor: on ? PALETTE.ink : 'transparent',
      }}
    />
  );
}

/** The five the rail shows: a jersey and their fouls. */
const RAIL = [
  { number: 1, fouls: 2 },
  { number: 2, fouls: 1 },
  { number: 3, fouls: 3 },
  { number: 4, fouls: 0 },
  { number: 5, fouls: 0 },
];

/* ---- the picture --------------------------------------------------- */

export function MiniBoard() {
  const m = useMetrics();

  // THE SLAB RUNS EDGE TO EDGE, so it takes the width it is GIVEN and the
  // window is only what the parts inside it are proportioned against. Setting
  // a hard `m.win.w` here was the first version and it overflows by the
  // safe-area inset on any device that has one — the caller steps this out of
  // its own padding, which is not the same number.
  const w = m.win.w;
  const h = Math.round(m.win.h * ART_H);
  const pad = 5;
  const col = Math.round(w * COL);
  const gap = 4;

  const railW = Math.round(w * 0.28);
  const courtH = Math.round(h * 0.7);
  const ftrH = h - courtH - gap - pad * 2;

  // the plate takes the rail row's height the way the real rail's does
  const plateH = Math.round((courtH - 4) / RAIL.length) - 4;
  const plateW = Math.round(plateH * 1.15);

  return (
    <ThemeProvider value={PALETTE}>
      <View style={{ width: '100%', padding: pad, backgroundColor: PALETTE.bg }}>
        <Row gap={gap} align="stretch" style={{ height: h - pad * 2 }}>
          {/* the court and the footer under it — the board's own left block */}
          <Col gap={gap} style={{ flex: 1, minWidth: 0 }}>
            <Row gap={gap} align="stretch" style={{ height: courtH, flexShrink: 0 }}>
              {/* THE OPPONENT, WHICH IS ONE NUMBER AND THREE BUTTONS. It is the
                  whole of the other side's model, and showing it early is what
                  stops a scorer looking for an opponent roster. */}
              <KeyColumn w={col}>
                {['+1', '+2', '+3'].map((label) => (
                  <Key key={label}>
                    <KeyCode label={label} fs={m.fsSm} />
                    <KeyCaption label="OPP" fs={m.fs2xs * 0.8} />
                  </Key>
                ))}
              </KeyColumn>

              {/* ---- THE FLOOR ---- */}
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Svg
                  width="100%"
                  height={courtH}
                  viewBox={VB}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                >
                  <Rect x={0} y={0} width={792} height={521} fill={PALETTE.court} />
                  <G
                    fill="none"
                    stroke={PALETTE.courtLine}
                    strokeWidth={7}
                    strokeLinejoin="round"
                  >
                    {/* the lane, the free-throw circle, the arc, the board, the rim */}
                    <Path d="M277 0 L277 276 L513 276 L513 0" />
                    <Circle cx={395} cy={276} r={95} />
                    <Path d="M68 0 L68 203.7 A352 352 0 0 0 724 203.7 L724 0" />
                    <Path d="M344 44 L448 44" />
                    <Circle cx={396} cy={76} r={17} />
                  </G>
                  {/* the two lane extensions, which are what separate a wing
                      from the top — quieter, because they are not painted as
                      hard on a real floor either */}
                  <G fill="none" stroke={PALETTE.courtLine} strokeWidth={4} opacity={0.45}>
                    <Path d="M310 276 L187 521" />
                    <Path d="M480 276 L603 521" />
                  </G>
                  {/* three makes, two misses and the live tap under the arc */}
                  <Circle cx={243} cy={196} r={17} fill={PALETTE.accent} />
                  <Circle cx={556} cy={311} r={17} fill={PALETTE.accent} />
                  <Circle cx={352} cy={150} r={17} fill={PALETTE.accent} />
                  <Circle cx={646} cy={146} r={17} fill={PALETTE.markMiss} />
                  <Circle cx={180} cy={330} r={17} fill={PALETTE.markMiss} />
                  <Circle
                    cx={396}
                    cy={392}
                    r={20}
                    fill="none"
                    stroke={PALETTE.mark}
                    strokeWidth={9}
                  />
                </Svg>
              </View>

              {/* THE THREE KEYS, on the edge the setting puts them */}
              <KeyColumn w={col}>
                {['PF', 'FT', 'RB'].map((label) => (
                  <Key key={label}>
                    <KeyCode label={label} fs={m.fsSm} />
                  </Key>
                ))}
              </KeyColumn>
            </Row>

            {/* ---- THE FOOTER: four parts, 1 / 2 / 1 ---- */}
            <View style={{ height: ftrH, flexShrink: 0 }}>
              <Row
                gap={1}
                align="stretch"
                style={{
                  flex: 1,
                  backgroundColor: PALETTE.rule,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <Key>
                  <KeyCode label="UNDO" fs={m.fs2xs} />
                </Key>

                {/* THE READOUT TAKES DOUBLE, and inside it the split is
                    weighted the way the real footer's is: the score is six
                    digits where the clock is four, so an even split starves it */}
                <Row align="stretch" style={{ flex: 2, backgroundColor: PALETTE.surface }}>
                  <Row gap={2} justify="center" style={{ flex: 1.25 }}>
                    <Text
                      style={{
                        ...fNum(700),
                        fontSize: m.fsSm,
                        letterSpacing: ls(m.fsSm, LS_TIGHT),
                        color: PALETTE.ink,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      42
                    </Text>
                    <Text style={{ ...fUi(500), fontSize: m.fs2xs, color: PALETTE.ink3 }}>—</Text>
                    <Text
                      style={{
                        ...fNum(700),
                        fontSize: m.fsSm,
                        letterSpacing: ls(m.fsSm, LS_TIGHT),
                        color: PALETTE.ink2,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      38
                    </Text>
                  </Row>
                  <Hair />
                  {/* RUNNING IS `live`, AND STOPPED IS `danger` — the clock's
                      state is carried by the ink and not by a fill, which is
                      the one thing about the footer worth saying in a picture */}
                  <Row justify="center" style={{ flex: 0.95 }}>
                    <Text
                      style={{
                        ...fNum(700),
                        fontSize: m.fsSm,
                        letterSpacing: ls(m.fsSm, LS_TIGHT),
                        color: PALETTE.live,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      07:24
                    </Text>
                  </Row>
                  <Hair />
                  <Row justify="center" style={{ flex: 0.8 }}>
                    <Text
                      style={{
                        ...fNum(700),
                        fontSize: m.fs2xs * 1.2,
                        letterSpacing: ls(m.fs2xs, LS_CAPS),
                        color: PALETTE.ink,
                      }}
                    >
                      Q2
                    </Text>
                  </Row>
                </Row>

                <Key>
                  <KeyCode label="14" fs={m.fs2xs * 1.2} />
                  <KeyCaption label="POSS" fs={m.fs2xs * 0.8} />
                </Key>
              </Row>
            </View>
          </Col>

          {/* ---- THE RAIL, DOWN THE WHOLE RIGHT EDGE ---- */}
          <View style={{ width: railW, flexGrow: 0, flexShrink: 0 }}>
            <Col
              gap={1}
              style={{
                flex: 1,
                backgroundColor: PALETTE.rule,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              {RAIL.map((p) => (
                <Row
                  key={p.number}
                  gap={m.s1 + 2}
                  style={{
                    flex: 1,
                    paddingHorizontal: 3,
                    backgroundColor: PALETTE.surface,
                  }}
                >
                  <Jersey number={p.number} w={plateW} h={plateH} />
                  <Col align="center" justify="center" style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={2}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Pip key={i} on={i < p.fouls} d={4} />
                      ))}
                    </Row>
                  </Col>
                </Row>
              ))}
            </Col>
          </View>
        </Row>
      </View>
    </ThemeProvider>
  );
}
