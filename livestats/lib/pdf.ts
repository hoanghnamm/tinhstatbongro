/**
 * THE EXPORTED GAME — one printable sheet, built as a string of HTML.
 *
 * It is a plain function over a `GameState`, on the same side of the line as
 * `box.ts` and `actions.ts`: nothing here touches a file, a store or React, so
 * `npm run check` exercises it without a device. The screen that offers the
 * button hands the string to `expo-print`, and that call is the only part of
 * the export that needs a phone.
 *
 * WHAT IS IN IT IS THE WHOLE GAME AND ONLY THE WHOLE GAME. The button sits at
 * the foot of TEAM / ALL, which is the one place on the stats screen looking at
 * the entire game, and the sheet says the same: the box score, the team line,
 * the floor, every zone and every play in the order it happened. A quarter is
 * a thing you read on screen with a toggle; a document with four box scores in
 * it is four documents.
 *
 * The layout is the one every scorer already knows — a FIBA box score — with
 * the one difference this app has always had: THERE IS ONE TEAM. The other
 * side is a single integer, so where a FIBA sheet prints a second roster this
 * one prints their score, their quarters, and the two scoreboard numbers a
 * single integer can honestly support.
 *
 * The floor is drawn from `lib/court.ts`'s own strings, the same ones
 * `CourtSvg` draws, because a second copy of the partition is the one thing
 * that file exists to prevent.
 */
import { FOUL_KINDS, ZONE_LABEL } from '../constants/game';
import { PALETTE, withAlpha } from '../theme/tokens';
import {
  BREAK_WINDOW,
  freeThrowsIn,
  periodsOf,
  report,
  shotsIn,
  zoneRows,
  type Report,
  type ShotMark,
} from './box';
import { COURT_H, COURT_LINES, COURT_W, FT_SPOT, RIM, ZONE_PATHS } from './court';
import { describe } from './describe';
import { mmss, pct } from './format';
import { numDateLabel } from './history';
import { appeared } from './season';
import { efficiency, efg, plusMinus, ts } from './stats';
import { competitionLabel, opponentLabel } from './team';
import type { GameEvent, GameState, Player } from '../types';

/* ------------------------------------------------------------------ *
 * The small print
 * ------------------------------------------------------------------ */

/** Every string on the sheet is typed by the scorer, so every one goes through this. */
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

/** Q1–Q4, then overtimes — the same labels the split strip prints. */
export const periodLabel = (p: number): string => (p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `OT${p - 4}`);

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The name to print for a player, which is never blank. */
const nameOf = (p: Player): string => p.name.trim() || `Player ${p.number}`;

/** `19/08/2026 15:32` — when the SHEET was made, which is not when the game was. */
const stampLabel = (ms: number): string => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${numDateLabel(ms)} ${hh}:${mm}`;
};

/** What the sheet is filed under: the competition, or the word PRACTICE. */
export const reportTitle = (g: GameState): string =>
  g.kind === 'practice' ? 'PRACTICE' : competitionLabel(g.competition);

/**
 * The name the file is saved and shared under.
 *
 * DIACRITICS ARE FOLDED, NOT DROPPED: `KHÁNH HÒA` is `KHANH-HOA` and not
 * `KH-NH-H-A`. A name typed in Vietnamese is perfectly good on the sheet and is
 * a coin toss in a file name once it has been through a mail client, a Drive
 * upload and whatever the receiving phone does to it — but a scorer still has
 * to recognise the file in a list, so the letters survive and only the marks
 * come off. Everything left outside `[A-Za-z0-9_]` folds to a dash.
 */
export function reportFileName(g: GameState, at: number = Date.now()): string {
  const slug = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\w]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const d = new Date(at);
  const day = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const who = slug(`${g.team.name} vs ${g.opponent || 'opponent'}`) || 'game';
  return `HOOPLOG-${who}-${day}.pdf`;
}

/* ------------------------------------------------------------------ *
 * The quarters
 *
 * The board's own counters are the truth about the WHOLE game and say nothing
 * about when a point happened, so the period line is walked off the log. It is
 * its own walk rather than four calls to `report()`: this one needs both sides
 * and neither of the two things `linesFor` reconstructs.
 * ------------------------------------------------------------------ */

export interface PeriodScore {
  period: number;
  us: number;
  them: number;
}

export function periodScores(g: GameState): PeriodScore[] {
  const rows: PeriodScore[] = periodsOf(g).map((period) => ({ period, us: 0, them: 0 }));
  const at = new Map(rows.map((r) => [r.period, r]));
  for (const e of g.events) {
    const r = at.get(e.period);
    if (!r) continue;
    if (e.type === 'oppPoint') r.them += e.value;
    else if ((e.type === 'shot' || e.type === 'freeThrow') && e.result === 'made') r.us += e.value;
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * The floor, as print
 * ------------------------------------------------------------------ */

const courtBase = (): string =>
  `<rect x="0" y="0" width="${COURT_W}" height="${COURT_H}" fill="${PALETTE.court}"/>`;

const courtLines = (): string =>
  COURT_LINES.map(
    (d) => `<path d="${d}" fill="none" stroke="${PALETTE.courtLine}" stroke-width="2"/>`,
  ).join('') +
  `<circle cx="${RIM.cx}" cy="${RIM.cy}" r="${RIM.r}" fill="${PALETTE.courtLine}"/>`;

/**
 * THE FLOOR: every shot where it was taken, and ONE red dot for the free
 * throws however many were taken, because every one of them is logged at the
 * same coordinate. The same grammar the board's own chart uses.
 */
function shotChart(shots: ShotMark[], ft: { m: number; a: number }): string {
  const r = 9;
  const dots = shots
    .map(
      (s) =>
        `<circle cx="${(s.x * COURT_W).toFixed(1)}" cy="${(s.y * COURT_H).toFixed(1)}" r="${r}" fill="${
          s.made ? PALETTE.accent : PALETTE.markMiss
        }" stroke="${s.made ? PALETTE.accent : PALETTE.ink3}" stroke-width="1.5"/>`,
    )
    .join('');
  const line =
    ft.a > 0
      ? `<circle cx="${FT_SPOT.x * COURT_W}" cy="${FT_SPOT.y * COURT_H}" r="${r}" fill="${PALETTE.danger}"/>`
      : '';
  return `<svg viewBox="0 0 ${COURT_W} ${COURT_H}" class="court">${courtBase()}${courtLines()}${dots}${line}</svg>`;
}

/**
 * BY ZONE: the same marks, bucketed. Opacity carries the percentage and starts
 * at 0.18 rather than 0 — a zone shot five times and missed five times is not
 * the same thing as a zone never shot from.
 */
function zoneChart(rep: Report): string {
  const heat = zoneRows(rep.zones).reduce<Record<string, string>>((acc, r) => {
    if (r.a > 0) acc[r.zone] = withAlpha(PALETTE.accent, 0.18 + 0.52 * (r.m / r.a));
    return acc;
  }, {});
  const fills = ZONE_PATHS.map((z) =>
    heat[z.zone] ? `<path d="${z.d}" fill="${heat[z.zone]}"/>` : '',
  ).join('');
  return `<svg viewBox="0 0 ${COURT_W} ${COURT_H}" class="court">${courtBase()}${fills}${courtLines()}</svg>`;
}

/* ------------------------------------------------------------------ *
 * The tables
 * ------------------------------------------------------------------ */

const BOX_HEAD = `
  <tr>
    <th rowspan="2" class="n">No</th>
    <th rowspan="2" class="l">Name</th>
    <th rowspan="2">Min</th>
    <th colspan="2">Field Goals</th>
    <th colspan="2">2 Points</th>
    <th colspan="2">3 Points</th>
    <th colspan="2">Free Throws</th>
    <th colspan="3">Rebounds</th>
    <th rowspan="2">AS</th><th rowspan="2">TO</th><th rowspan="2">ST</th><th rowspan="2">BS</th>
    <th colspan="2">Fouls</th>
    <th rowspan="2">+/-</th><th rowspan="2">EF</th><th rowspan="2">PTS</th>
  </tr>
  <tr>
    <th>M/A</th><th>%</th><th>M/A</th><th>%</th><th>M/A</th><th>%</th><th>M/A</th><th>%</th>
    <th>OR</th><th>DR</th><th>TOT</th><th>PF</th><th>FD</th>
  </tr>`;

/**
 * One player's row. A player who never took the floor prints DNP across the
 * twenty-one number columns, as a FIBA sheet does — a line of zeros and a line
 * of dashes both read as a bad night rather than as no night.
 */
function boxRow(p: Player): string {
  const s = p.stats;
  const no = `${p.starter ? '*' : ''}${p.number}`;
  const name = esc(nameOf(p));
  if (!appeared(p))
    return `<tr><td class="n">${no}</td><td class="l">${name}</td><td class="dnp" colspan="21">DNP</td></tr>`;
  const cells: (string | number)[] = [
    mmss(s.secondsPlayed),
    `${s.fgMade}/${s.fgAttempted}`,
    pct(s.fgMade, s.fgAttempted),
    `${s.twoMade}/${s.twoAttempted}`,
    pct(s.twoMade, s.twoAttempted),
    `${s.threeMade}/${s.threeAttempted}`,
    pct(s.threeMade, s.threeAttempted),
    `${s.ftMade}/${s.ftAttempted}`,
    pct(s.ftMade, s.ftAttempted),
    s.offensiveRebounds,
    s.defensiveRebounds,
    s.offensiveRebounds + s.defensiveRebounds,
    s.assists,
    s.turnovers,
    s.steals,
    s.blocks,
    s.fouls,
    s.foulsDrawn,
    signed(plusMinus(s)),
    round1(efficiency(s)),
    s.points,
  ];
  return `<tr><td class="n">${no}</td><td class="l">${name}</td>${cells
    .map((c) => `<td>${c}</td>`)
    .join('')}</tr>`;
}

function boxTotals(rep: Report): string {
  const T = rep.team;
  const cells: (string | number)[] = [
    mmss(T.sec),
    `${T.fgm}/${T.fga}`,
    pct(T.fgm, T.fga),
    `${T.twom}/${T.twoa}`,
    pct(T.twom, T.twoa),
    `${T.tpm}/${T.tpa}`,
    pct(T.tpm, T.tpa),
    `${T.ftm}/${T.fta}`,
    pct(T.ftm, T.fta),
    T.oreb,
    T.dreb,
    T.reb,
    T.ast,
    T.to,
    T.st,
    T.bs,
    T.pf,
    T.fd,
    signed(rep.us - rep.them),
    round1(T.ef),
    rep.us,
  ];
  return `<tr class="tot"><td colspan="2" class="l">Totals</td>${cells
    .map((c) => `<td>${c}</td>`)
    .join('')}</tr>`;
}

const kv = (label: string, value: string | number, sub: string = ''): string =>
  `<tr><td class="l">${label}</td><td class="v">${value}</td><td class="s">${sub}</td></tr>`;

const block = (title: string, rows: string): string =>
  `<table class="kv"><thead><tr><th colspan="3" class="l">${title}</th></tr></thead><tbody>${rows}</tbody></table>`;

/* ------------------------------------------------------------------ *
 * The play log
 *
 * OLDEST FIRST, which is the one place this document deliberately disagrees
 * with the screen. The board's list is newest first because a scorer is
 * checking what just happened; a sheet is read start to finish. It is cut into
 * periods for the same reason — a quarter is where a reader looks something up.
 * ------------------------------------------------------------------ */

function plays(g: GameState): string {
  const byId = (id: string): Player | undefined => g.players.find((p) => p.id === id);
  const row = (e: GameEvent): string => {
    const p = e.playerId ? byId(e.playerId) : undefined;
    // an oppPoint's `value` is THEIR points, so the type is checked first
    const value = e.type !== 'oppPoint' && 'value' in e ? e.value : 0;
    return `<tr><td class="n">${e.gameClock}</td><td class="n">${p ? p.number : '—'}</td><td class="l">${esc(
      p ? nameOf(p) : opponentLabel(g.opponent),
    )}</td><td class="l">${esc(describe(e, byId))}</td><td class="n">${
      value ? `+${value}` : ''
    }</td></tr>`;
  };

  const tables = periodsOf(g)
    .map((period) => {
      const rows = g.events.filter((e) => e.period === period);
      if (!rows.length) return '';
      return `<table class="log"><thead><tr><th colspan="5" class="l">${periodLabel(
        period,
      )}</th></tr><tr><th class="n">Clock</th><th class="n">No</th><th class="l">Player</th><th class="l">Play</th><th class="n">Pts</th></tr></thead><tbody>${rows
        .map(row)
        .join('')}</tbody></table>`;
    })
    .join('');

  return tables || '<div class="legend">No plays were recorded.</div>';
}

/* ------------------------------------------------------------------ *
 * The sheet
 * ------------------------------------------------------------------ */

const CSS = `
  * { box-sizing: border-box; }
  @page { size: A4 portrait; margin: 12mm 9mm; }
  body {
    margin: 0;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Roboto, Arial, sans-serif;
    font-size: 9px; color: ${PALETTE.ink};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
  }
  h1 { margin: 2px 0 0; font-size: 16px; letter-spacing: 0.01em; }
  h2 {
    margin: 13px 0 4px; font-size: 10px; letter-spacing: 0.09em;
    text-transform: uppercase; color: ${PALETTE.ink2};
    border-bottom: 1px solid ${PALETTE.ink}; padding-bottom: 2px;
  }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .head .right {
    margin-left: auto; text-align: right;
    color: ${PALETTE.ink2}; font-size: 8px; line-height: 1.6;
  }
  .kicker { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: ${PALETTE.ink2}; }
  .score { margin-top: 4px; font-size: 20px; font-weight: 700; }
  .score .us { color: ${PALETTE.accent}; }
  .sep { color: ${PALETTE.ink3}; font-weight: 400; padding: 0 5px; }
  .quarters { margin-top: 1px; color: ${PALETTE.ink2}; }
  .note { margin-top: 3px; color: ${PALETTE.ink2}; font-style: italic; }

  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid ${PALETTE.rule}; padding: 2px 3px; text-align: center; }
  th { background: ${PALETTE.surface2}; font-weight: 700; font-size: 7.5px; letter-spacing: 0.05em; }
  td { font-size: 8.5px; }
  td.l, th.l { text-align: left; }
  .box td.l { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
  .box .tot td { background: ${PALETTE.surface2}; font-weight: 700; }
  .box .dnp { color: ${PALETTE.ink3}; letter-spacing: 0.12em; }

  .cols { display: flex; gap: 8px; align-items: flex-start; }
  .cols > * { flex: 1; min-width: 0; }
  .kv { margin-bottom: 6px; }
  .kv td.v { width: 56px; font-weight: 700; }
  .kv td.s { width: 42px; color: ${PALETTE.ink2}; }
  .kv th { letter-spacing: 0.09em; text-transform: uppercase; }

  .court { width: 100%; height: auto; display: block; }
  .chart { border: 1px solid ${PALETTE.rule}; padding: 3px; }
  .cap { text-align: center; font-size: 7.5px; letter-spacing: 0.07em; color: ${PALETTE.ink2}; padding-top: 3px; }
  .key { display: flex; gap: 9px; justify-content: center; padding-top: 4px; font-size: 7.5px; color: ${PALETTE.ink2}; }
  .key i { display: inline-block; width: 7px; height: 7px; border-radius: 7px; margin-right: 3px; }

  .log { margin-bottom: 7px; page-break-inside: auto; }
  .log tr { page-break-inside: avoid; }
  .log thead { display: table-header-group; }
  .legend { margin-top: 8px; font-size: 7.5px; color: ${PALETTE.ink2}; line-height: 1.7; }
  .legend b { color: ${PALETTE.ink}; }
  .break { page-break-before: always; }
`;

/**
 * The whole sheet, as one HTML string.
 *
 * `at` is when the REPORT was made, not when the game was — a sheet printed
 * three weeks later says so on its own face, which is the only way a scorer
 * holding two copies can tell which is the later one.
 */
export function gameReportHtml(g: GameState, at: number = Date.now()): string {
  const rep = report(g, null);
  const T = rep.team;
  const a = rep.advanced;
  const margin = rep.us - rep.them;
  const qs = periodScores(g);
  const shots = shotsIn(g.events, null);
  const ft = freeThrowsIn(g.events, null);

  const quarterLine = qs.map((q) => `${q.us}-${q.them}`).join(', ');
  const foulSplit = T.tf + T.fl ? `${T.tf}T ${T.fl}F` : '';

  const zoneTable = zoneRows(rep.zones)
    .map(
      (r) =>
        `<tr><td class="l">${ZONE_LABEL[r.zone]}</td><td>${r.m}/${r.a}</td><td>${pct(r.m, r.a)}</td></tr>`,
    )
    .join('');

  const dqShorts = Object.values(FOUL_KINDS)
    .filter((k) => k.dq)
    .map((k) => k.short)
    .join(', ');

  return `<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><style>${CSS}</style></head><body>

<div class="head">
  <div>
    <div class="kicker">${esc(reportTitle(g))}</div>
    <h1>${esc(g.team.name)}<span class="sep">vs</span>${esc(opponentLabel(g.opponent))}</h1>
    <div class="score"><span class="us">${rep.us}</span><span class="sep">&ndash;</span>${rep.them}</div>
    <div class="quarters">(${quarterLine})</div>
    ${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}
  </div>
  <div class="right">
    <b>HOOPLOG BOX SCORE</b><br/>
    Periods played: ${qs.length}<br/>
    Report generated: ${stampLabel(at)}
  </div>
</div>

<h2>Scoring by period</h2>
<table>
  <thead>
    <tr><th class="l">Team</th>${qs
      .map((q) => `<th>${periodLabel(q.period)}</th>`)
      .join('')}<th>Total</th></tr>
  </thead>
  <tbody>
    <tr><td class="l">${esc(g.team.name)}</td>${qs
      .map((q) => `<td>${q.us}</td>`)
      .join('')}<td><b>${rep.us}</b></td></tr>
    <tr><td class="l">${esc(opponentLabel(g.opponent))}</td>${qs
      .map((q) => `<td>${q.them}</td>`)
      .join('')}<td><b>${rep.them}</b></td></tr>
  </tbody>
</table>

<h2>Box score &mdash; ${esc(g.team.name)}</h2>
<table class="box">
  <thead>${BOX_HEAD}</thead>
  <tbody>${g.players.map(boxRow).join('')}${boxTotals(rep)}</tbody>
</table>

<h2>Team</h2>
<div class="cols">
  <div>
    ${block(
      'Shooting',
      [
        kv('Field goals', `${T.fgm}/${T.fga}`, pct(T.fgm, T.fga)),
        kv('2 points', `${T.twom}/${T.twoa}`, pct(T.twom, T.twoa)),
        kv('3 points', `${T.tpm}/${T.tpa}`, pct(T.tpm, T.tpa)),
        kv('Free throws', `${T.ftm}/${T.fta}`, pct(T.ftm, T.fta)),
        kv('Effective FG%', efg(T)),
        kv('True shooting%', ts(T)),
      ].join(''),
    )}
    ${block(
      'Rebounds and ball',
      [
        kv('Offensive rebounds', T.oreb),
        kv('Defensive rebounds', T.dreb),
        kv('Total rebounds', T.reb),
        kv('Assists', T.ast),
        kv('Turnovers', T.to),
        kv('Steals', T.st),
        kv('Blocks', T.bs),
        kv('Personal fouls', T.pf, foulSplit),
        kv('Fouls drawn', T.fd),
        kv('Efficiency', round1(T.ef)),
        kv('Plus / minus', signed(margin)),
      ].join(''),
    )}
  </div>
  <div>
    ${block(
      'Where the points came from',
      [
        kv('Points', rep.us),
        kv('Points in the paint', a.paint, pct(a.paint, rep.us)),
        kv('Second chance points', a.secondChance, pct(a.secondChance, rep.us)),
        kv('Fast break points', a.fastBreak, pct(a.fastBreak, rep.us)),
        kv('Points from turnovers', a.offTurnovers, pct(a.offTurnovers, rep.us)),
        kv('Bench points', a.bench, pct(a.bench, rep.us)),
      ].join(''),
    )}
    ${block(
      'The scoreboard',
      [
        kv('Biggest lead', a.biggestLead, `${a.oppBiggestLead} them`),
        kv('Biggest scoring run', a.biggestRun, `${a.oppBiggestRun} them`),
        kv('Lead changes', a.leadChanges),
        kv('Times tied', a.timesTied),
        kv('Time with the lead', mmss(a.timeAhead)),
        kv('Possessions', g.possessions || '&mdash;'),
        kv('Points per possession', a.ppp === null ? '&mdash;' : a.ppp.toFixed(2)),
      ].join(''),
    )}
  </div>
</div>

<h2>The floor</h2>
<div class="cols">
  <div class="chart">
    ${shotChart(shots, ft)}
    <div class="key">
      <span><i style="background:${PALETTE.accent}"></i>MADE</span>
      <span><i style="background:${PALETTE.markMiss};border:1px solid ${PALETTE.ink3}"></i>MISS</span>
      <span><i style="background:${PALETTE.danger}"></i>FREE THROWS ${ft.m}/${ft.a}</span>
    </div>
    <div class="cap">EVERY SHOT, WHERE IT WAS TAKEN</div>
  </div>
  <div class="chart">
    ${zoneChart(rep)}
    <div class="cap">BY ZONE &mdash; THE DARKER THE FILL, THE HIGHER THE PERCENTAGE</div>
  </div>
  <div>
    <table>
      <thead><tr><th class="l">Zone</th><th>M/A</th><th>%</th></tr></thead>
      <tbody>${zoneTable}</tbody>
    </table>
    <div class="legend">
      A free throw is logged at the centre of the line and carries <b>no zone</b>: it is not a
      field-goal attempt, so no zone counts it.
    </div>
  </div>
</div>

<h2 class="break">Play by play</h2>
${plays(g)}

<div class="legend">
  <b>*</b> Game starter &nbsp; <b>DNP</b> Did not play &nbsp; <b>M/A</b> Made / attempted &nbsp;
  <b>OR</b> Offensive rebounds &nbsp; <b>DR</b> Defensive rebounds &nbsp; <b>TOT</b> Total rebounds &nbsp;
  <b>AS</b> Assists &nbsp; <b>TO</b> Turnovers &nbsp; <b>ST</b> Steals &nbsp; <b>BS</b> Blocks &nbsp;
  <b>PF</b> Personal fouls (${dqShorts}; ${FOUL_KINDS.technical.short} excluded) &nbsp;
  <b>FD</b> Fouls drawn &nbsp; <b>+/-</b> Plus / minus &nbsp; <b>EF</b> Efficiency &nbsp;
  <b>PTS</b> Points
  <br/>
  <b>Points from turnovers</b> is points scored after one of our steals &mdash; a steal is the only
  opponent turnover a one-team board hears about. <b>Second chance points</b> is points after one of
  our offensive rebounds, before the possession ends. <b>Fast break points</b> is points within
  ${BREAK_WINDOW} seconds of a steal or a defensive rebound, measured on the GAME CLOCK, so a clock
  left stopped makes it read high. <b>Minutes</b> are clock-driven, so a period ended early hands its
  unplayed tail to whoever was on the floor.
</div>

</body></html>`;
}
