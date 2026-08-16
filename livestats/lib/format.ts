export const mmss = (s: number): string =>
  String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export const ord = (n: number): string =>
  n + ['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10];

export const pct = (m: number, a: number): string => (a ? Math.round((m / a) * 100) + '%' : '-');
export const pct1 = (m: number, a: number): string => (a ? ((m / a) * 100).toFixed(1) + '%' : '-');
