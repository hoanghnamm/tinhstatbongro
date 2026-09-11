import { PALETTE as p } from '../theme/tokens';
import type { GameEvent } from '../types';
import { COURT_W, COURT_H, COURT_LINES, RIM, FT_SPOT } from './court';

/** The same court and marks for both printable reports. */
export function pdfShotChart(events: GameEvent[]): string {
  const marks = events.flatMap(e => {
    if (e.type !== 'shot') return [];
    const x = e.position.x * COURT_W, y = e.position.y * COURT_H;
    return [e.result === 'made' ? `<circle cx="${x}" cy="${y}" r="8" fill="${p.accent}"/>`
      : `<path d="M${x-6} ${y-6}l12 12m0 -12l-12 12" stroke="${p.ink2}" stroke-width="3"/>`];
  }).join('');
  const ft = events.filter(e => e.type === 'freeThrow');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COURT_W} ${COURT_H}" role="img" aria-label="Shot chart"><rect width="${COURT_W}" height="${COURT_H}" fill="${p.court}"/>${COURT_LINES.map(d => `<path d="${d}" fill="none" stroke="${p.courtLine}" stroke-width="2"/>`).join('')}<circle cx="${RIM.cx}" cy="${RIM.cy}" r="${RIM.r}" fill="${p.courtLine}"/>${marks}${ft.length ? `<circle cx="${FT_SPOT.x*COURT_W}" cy="${FT_SPOT.y*COURT_H}" r="9" fill="${p.live}"/>` : ''}</svg>`;
}
