import { PALETTE as p } from '../theme/tokens';
import type { GameState, RosterPlayer } from '../types';
import { pdfShotChart } from './pdfChart';
import { mmss, pct } from './format';
import { appeared, season } from './season';
import { efficiency, plusMinus, totals, efg, ts } from './stats';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number): string => Number.isInteger(n) ? String(n) : n.toFixed(1);

/** Games arrive newest first from the profile's season/competition scope. */
export function playerReportData(games: GameState[], id: string, roster: RosterPlayer[]) {
  const played = games.filter(g => g.players.some(player => player.id === id && appeared(player)));
  const line = season(played, roster, 'totals').lines.find(player => player.id === id);
  return line ? { line, latest: played[0], games: played.length } : null;
}

export function playerReportFileName(name: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return `HOOPLOG-player-${slug || 'report'}.pdf`;
}

/** Pure printable player profile. No game log or explanatory side notes. */
export function playerReportHtml(games: GameState[], id: string, roster: RosterPlayer[]): string {
  const data = playerReportData(games, id, roster);
  if (!data) throw new Error('No player appearances to export');
  const { line, latest, games: gp } = data;
  const s = line.stats;
  const name = line.name.trim() || `Player ${line.number}`;
  const avg = (v: number) => num(Math.round(v / gp * 10) / 10);
  const rows = (items: [string, number][]) => items.map(([label, value]) => `<tr><td>${label}</td><td>${num(value)}</td><td>${avg(value)}</td></tr>`).join('');
  const table = (title: string, items: [string, number][]) => `<section><h2>${title}</h2><table><thead><tr><th>Stat</th><th>Total</th><th>Per game</th></tr></thead><tbody>${rows(items)}</tbody></table></section>`;
  const events = latest.events.filter(e => e.playerId === id);
  const ft = events.filter(e => e.type === 'freeThrow');
  const court = pdfShotChart(events);
  const shooting = ([['FG', s.fgMade, s.fgAttempted], ['2PT', s.twoMade, s.twoAttempted], ['3PT', s.threeMade, s.threeAttempted], ['FT', s.ftMade, s.ftAttempted]] as [string, number, number][])
    .map(([label, made, attempted]) => `<tr><td>${label}</td><td>${made}/${attempted}</td><td>${avg(made)}/${avg(attempted)}</td><td>${pct(made, attempted)}</td></tr>`).join('');
  const t = totals([line]);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)} - Player report</title><style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:${p.ink};background:white;font:11px Arial,sans-serif;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}header{border-top:3px solid ${p.accent};padding-top:14px;margin-bottom:18px}.brand{color:${p.ink2};font-size:10px}h1{font-size:29px;line-height:1.2;margin:10px 0 6px;overflow-wrap:anywhere}h1 span{color:${p.accent}}.meta{color:${p.ink2};overflow-wrap:anywhere;line-height:1.5}h2{font-size:12px;margin:0 0 9px;font-weight:600}section{break-inside:avoid}.headline{display:flex;border-top:1px solid ${p.rule};border-bottom:1px solid ${p.rule};padding:12px 0;margin-bottom:18px}.headline div{flex:1}.headline b{display:block;font-size:23px;margin-bottom:3px}.headline span{color:${p.ink2};font-size:10px}.chart{width:54%;margin:0 auto}svg{display:block;width:100%;height:auto}.legend{display:flex;justify-content:center;gap:22px;margin:8px 0 18px;font-size:10px}.made{color:${p.accent}}.ft{color:${p.live}}.columns{display:flex;gap:24px;margin-top:16px}.columns section{flex:1;min-width:0}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:4px 0;text-align:right;border-bottom:1px solid ${p.rule}}th{font-weight:400;color:${p.ink2}}th:first-child,td:first-child{text-align:left}td:first-child{padding-right:10px}footer{margin-top:14px;color:${p.ink2};font-size:9px}.rates{display:flex;gap:24px;margin-top:10px;color:${p.ink2}}
  </style></head><body><header><div class="brand">hooplog / Player report</div><h1><span>#${line.number}</span> ${esc(name)}</h1><div class="meta">${esc(latest.team.name)} · ${gp} game${gp === 1 ? '' : 's'} · Season totals and per-game averages</div></header>
  <div class="headline">${[['PPG', avg(s.points)], ['RPG', avg(s.offensiveRebounds+s.defensiveRebounds)], ['APG', avg(s.assists)], ['FG%', pct(s.fgMade,s.fgAttempted)], ['3PT%', pct(s.threeMade,s.threeAttempted)]].map(([label,value]) => `<div><b>${value}</b><span>${label}</span></div>`).join('')}</div>
  <section><h2>Latest game shot chart · ${esc(latest.opponent || 'Opponent')}</h2><div class="chart">${court}</div><div class="legend"><span class="made">● Made</span><span>× Missed</span><span class="ft">● FT ${ft.filter(e => e.type === 'freeThrow' && e.result === 'made').length}/${ft.length}</span></div>${!events.some(e => e.type === 'shot' || e.type === 'freeThrow') ? '<div class="meta">No shots recorded in this game</div>' : ''}</section>
  <section><h2>Season shooting</h2><table><thead><tr><th>Shot</th><th>Made / attempted</th><th>Per game</th><th>Percentage</th></tr></thead><tbody>${shooting}</tbody></table><div class="rates"><span>eFG% ${efg(t)}</span><span>TS% ${ts(t)}</span><span>AS/TO ${s.turnovers ? (s.assists/s.turnovers).toFixed(2) : '-'}</span><span>MIN ${mmss(s.secondsPlayed)} total / ${mmss(Math.round(s.secondsPlayed/gp))} per game</span></div></section>
  <div class="columns">${table('Scoring and possession', [['Points',s.points],['Offensive rebounds',s.offensiveRebounds],['Defensive rebounds',s.defensiveRebounds],['Total rebounds',s.offensiveRebounds+s.defensiveRebounds],['Assists',s.assists],['Turnovers',s.turnovers],['Steals',s.steals],['Blocks',s.blocks],['Efficiency',efficiency(s)],['Plus-minus',plusMinus(s)]])}${table('Fouls and floor time', [['Personal fouls',s.fouls],['Fouls drawn',s.foulsDrawn],['Technical fouls',s.technicals],['Flagrant fouls',s.flagrants],['Offensive fouls',s.offensiveFouls],['Shooting fouls',s.shootingFouls],['Free throw trips',s.ftTrips],['Points for on court',s.onCourtPoints ?? 0],['Points against on court',s.onCourtOppPoints ?? 0],['Games started',games.filter(g => g.players.some(player => player.id === id && player.starter)).length]])}</div>
  </body></html>`;
}
