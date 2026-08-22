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
 * the entire game, and the sheet says the same: the box score, the team line
 * and every zone. A quarter is a thing you read on screen with a toggle; a
 * document with four box scores in it is four documents.
 *
 * The layout is the one every scorer already knows — a FIBA box score — with
 * the one difference this app has always had: THERE IS ONE TEAM. The other
 * side is a single integer, so where a FIBA sheet prints a second roster this
 * one prints their score, their quarters, and the two scoreboard numbers a
 * single integer can honestly support.
 *
 * IT DRAWS NO FLOOR AND CARRIES NO PLAY LOG, and both were on it. The two
 * courts and the play-by-play are things you READ — a chart to look at and a
 * hundred rows to scroll — and the screen is where you look at them, on a
 * page that can scroll and a floor that can be tapped. The sheet is the
 * scorebook: the numbers, in the shape a scorer already knows. What survives
 * of the floor is the ZONE TABLE, because a shooting split is a number.
 */
import { FOUL_KINDS, ZONE_LABEL } from '../constants/game';
import { PALETTE } from '../theme/tokens';
import { BREAK_WINDOW, periodsOf, report, zoneRows, type Report } from './box';
import { mmss, pct, periodLabel } from './format';
import { numDateLabel } from './history';
import { appeared } from './season';
import { efficiency, efg, plusMinus, ts } from './stats';
import { competitionLabel, opponentLabel } from './team';
import type { GameState, Player } from '../types';

/* ------------------------------------------------------------------ *
 * The small print
 * ------------------------------------------------------------------ */

/** Every string on the sheet is typed by the scorer, so every one goes through this. */
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );

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
  .zones { width: 46%; min-width: 210px; }

  .cols { display: flex; gap: 8px; align-items: flex-start; }
  .cols > * { flex: 1; min-width: 0; }
  .kv { margin-bottom: 6px; }
  .kv td.v { width: 56px; font-weight: 700; }
  .kv td.s { width: 42px; color: ${PALETTE.ink2}; }
  .kv th { letter-spacing: 0.09em; text-transform: uppercase; }

  .legend { margin-top: 8px; font-size: 7.5px; color: ${PALETTE.ink2}; line-height: 1.7; }
  .legend b { color: ${PALETTE.ink}; }
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
      .map((q) => `<th>${periodLabel(q.period, g.periods)}</th>`)
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

<h2>By zone</h2>
<table class="zones">
  <thead><tr><th class="l">Zone</th><th>M/A</th><th>%</th></tr></thead>
  <tbody>${zoneTable}</tbody>
</table>

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
  unplayed tail to whoever was on the floor. A <b>free throw</b> is logged at the centre of the line
  and carries no zone: it is not a field-goal attempt, so no zone counts it.
</div>

</body></html>`;
}
