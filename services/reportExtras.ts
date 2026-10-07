// Report sections that are more than a list of records: turning plots, the fishtail table, compass deviation card and
// EM log table. Pure; returns HTML text. Checked by `node services/vesselReport.check.ts`.
import type { Ship, TurningDataRow } from '../types.ts';
import { fishtailRow } from '../data/fishtails.ts';
import { coefficients, deviationTable, formatDev, readDeviations, worst } from '../tools/compassSwing.ts';
import { logPoints, signedKn } from '../tools/emLog.ts';

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const tbl = (header: string[], rows: (string | number)[][]) =>
  `<table><thead><tr>${header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

/** Turning circle: transfer across, advance up, both in yards. Empty when there are fewer than two points. */
export function turningPlotSvg(rows: TurningDataRow[]): string {
  const pts = rows.filter(r => r.advance > 0 || r.transfer > 0);
  if (pts.length < 2) return '';
  const W = 300, H = 260, P = 34;
  const xs = pts.map(p => p.transfer), ys = pts.map(p => p.advance);
  const minX = Math.min(0, ...xs), maxX = Math.max(...xs), minY = Math.min(0, ...ys), maxY = Math.max(...ys);
  const sx = (v: number) => P + ((v - minX) / (maxX - minX || 1)) * (W - 2 * P);
  const sy = (v: number) => H - P - ((v - minY) / (maxY - minY || 1)) * (H - 2 * P);
  const line = pts.map(p => `${sx(p.transfer).toFixed(1)},${sy(p.advance).toFixed(1)}`).join(' ');
  const dots = pts.map(p => `<circle cx="${sx(p.transfer).toFixed(1)}" cy="${sy(p.advance).toFixed(1)}" r="2.5" fill="#2563eb"/><text x="${(sx(p.transfer) + 4).toFixed(1)}" y="${(sy(p.advance) - 4).toFixed(1)}" font-size="8" fill="#475569">${esc(p.turnAmount)}&deg;</text>`).join('');
  return `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Turning circle plot"><line x1="${sx(0)}" x2="${sx(0)}" y1="${P / 2}" y2="${H - P / 2}" stroke="#cbd5e1"/><line x1="${P / 2}" x2="${W - P / 2}" y1="${sy(0)}" y2="${sy(0)}" stroke="#cbd5e1"/><text x="${W - P / 2}" y="${(sy(0) - 4).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8">transfer (yd)</text><text x="${(sx(0) + 4).toFixed(1)}" y="${P / 2 + 4}" font-size="8" fill="#94a3b8">advance (yd)</text><polyline points="${line}" fill="none" stroke="#2563eb" stroke-width="1.5"/>${dots}</svg>`;
}

export function fishtailsHtml(ship: Ship): string {
  if (!ship.fishtails.length) return '<p class="none">No records.</p>';
  const rows = ship.fishtails.map(fishtailRow).sort((a, b) => b.date.localeCompare(a.date));
  return tbl(['Date', 'Kind', 'Angle', 'Speed (kn)', 'Wheel (°)', 'Station', 'Side', 'Lateral (yd)', 'Drop (yd)'],
    rows.map(r => [r.date, r.kind, r.angle ? `${r.angle}°` : '-', r.speed ?? '-', r.wheel ?? '-', r.station, r.side || '-', r.lateral ?? '-', r.drop ?? '-']));
}

export function emLogHtml(ship: Ship): string {
  const pts = logPoints(ship.emLogCalibration);
  const others = ship.emLogCalibration.filter(r => !pts.some(p => p.id === r.id));
  if (!pts.length && !others.length) return '<p class="none">No records.</p>';
  return (pts.length ? tbl(['Date', 'Log (kn)', 'True (kn)', 'Error (kn)', 'Correction (kn)'], pts.map(p => [p.date, p.log, p.ref, signedKn(p.error), signedKn(-p.error)])) : '')
    + (others.length ? tbl(['Date', 'Details'], others.map(r => [r.date, r.value || r.description])) : '')
    + (pts.length ? '<p class="sub">Error is log minus true speed; add the correction to the log reading.</p>' : '');
}

function deviationSvg(points: { heading: number; dev: number }[]): string {
  const W = 300, H = 140, L = 30, B = 18, T = 8;
  const m = Math.max(2, Math.ceil(Math.max(...points.map(p => Math.abs(p.dev)))));
  const x = (h: number) => L + (h / 360) * (W - L - 8), y = (d: number) => T + ((m - d) / (2 * m)) * (H - T - B);
  const path = [...points, { heading: 360, dev: points[0].dev }].map((p, i) => `${i ? 'L' : 'M'}${x(p.heading).toFixed(1)},${y(p.dev).toFixed(1)}`).join(' ');
  return `<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Deviation curve">${[-m, 0, m].map(d => `<line x1="${L}" x2="${W - 8}" y1="${y(d)}" y2="${y(d)}" stroke="#cbd5e1"/><text x="${L - 3}" y="${y(d) + 3}" text-anchor="end" font-size="8" fill="#64748b">${d > 0 ? '+' : ''}${d}</text>`).join('')}${[0, 90, 180, 270, 360].map(h => `<text x="${x(h)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#64748b">${String(h % 360).padStart(3, '0')}</text>`).join('')}<path d="${path}" fill="none" stroke="#2563eb" stroke-width="1.5"/></svg>`;
}

export function compassHtml(ship: Ship): string {
  if (!ship.compassSwing.length) return '<p class="none">No records.</p>';
  return [...ship.compassSwing].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
    const c = coefficients(readDeviations(r.fields));
    const head = `<h3>${esc(r.date)} &middot; ${esc(r.value || r.description)}</h3>`;
    if (!c) return head;
    const w = worst(c);
    return `${head}${tbl(['A', 'B', 'C', 'D', 'E', 'Largest'], [[formatDev(c.A), formatDev(c.B), formatDev(c.C), formatDev(c.D), formatDev(c.E), `${formatDev(w.dev)} on ${String(w.heading).padStart(3, '0')}°`]])}${deviationSvg(deviationTable(c, 5))}`
      + tbl(['Compass heading', 'Deviation'], deviationTable(c, 30).map(p => [String(p.heading).padStart(3, '0') + '°', formatDev(p.dev)]))
      + '<p class="sub">Calculated from deviation on eight headings. E is deviation east (+). Check against the ship\'s official deviation card.</p>';
  }).join('');
}
