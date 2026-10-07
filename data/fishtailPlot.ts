// A saved fishtail's track, kept as a few numbers on the record and drawn again as a small plot wherever it is shown.
// Pure; `node data/fishtailPlot.check.ts` checks it. Axes: x to starboard, y ahead of the start, yards. The guide
// runs straight up the y axis from the start.

export interface Plot { points: [number, number][]; guide: number }

/** Compact text for a record: the track's corner points and how far the guide went, rounded to whole yards. */
export function encodePlot(points: { x: number; y: number }[], guideDistance: number): string {
  return JSON.stringify({ p: points.map(q => [Math.round(q.x), Math.round(q.y)]), g: Math.round(guideDistance) });
}

/** Reads a saved plot back; anything malformed gives null (it came from storage or a backup file, so it is not trusted). */
export function decodePlot(text: string | undefined): Plot | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as { p?: unknown; g?: unknown };
    if (!Array.isArray(o.p) || o.p.length < 2 || o.p.length > 200 || typeof o.g !== 'number' || !Number.isFinite(o.g)) return null;
    const points: [number, number][] = [];
    for (const q of o.p) {
      if (!Array.isArray(q) || q.length !== 2 || !q.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
      points.push([q[0], q[1]]);
    }
    return { points, guide: o.g };
  } catch { return null; }
}

/** The plot as SVG markup (numbers only, so it is safe to insert as it is). Equal scale on both axes. */
export function plotSvg(plot: Plot, size = 260): string {
  const P = 26, W = size, H = size;
  const guideEnd: [number, number] = [0, plot.guide];
  const all = [...plot.points, guideEnd, [0, 0] as [number, number]];
  const xs = all.map(q => q[0]), ys = all.map(q => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 50);
  const k = (W - 2 * P) / span;
  const ox = P + ((W - 2 * P) - (maxX - minX) * k) / 2, oy = H - P - ((H - 2 * P) - (maxY - minY) * k) / 2;
  const sx = (v: number) => (ox + (v - minX) * k).toFixed(1), sy = (v: number) => (oy - (v - minY) * k).toFixed(1);
  const path = plot.points.map((q, i) => `${i ? 'L' : 'M'}${sx(q[0])},${sy(q[1])}`).join(' ');
  const end = plot.points[plot.points.length - 1];
  const text = (x: string, y: string, t: string, anchor = 'start') => `<text x="${x}" y="${y}" font-size="9" fill="#64748b" text-anchor="${anchor}">${t}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fishtail track">`
    + `<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(0)}" y2="${sy(plot.guide)}" stroke="#16a34a" stroke-width="2" stroke-dasharray="4 3"/>`
    + `<line x1="${sx(end[0])}" y1="${sy(end[1])}" x2="${sx(0)}" y2="${sy(plot.guide)}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 2"/>`
    + `<path d="${path}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>`
    + `<circle cx="${sx(0)}" cy="${sy(0)}" r="3.5" fill="#0f172a"/><circle cx="${sx(end[0])}" cy="${sy(end[1])}" r="4" fill="#2563eb"/><circle cx="${sx(0)}" cy="${sy(plot.guide)}" r="4" fill="#16a34a"/>`
    + text(sx(0), (parseFloat(sy(0)) + 14).toFixed(1), 'start', 'middle')
    + text((parseFloat(sx(0)) + 7).toFixed(1), (parseFloat(sy(plot.guide)) + 3).toFixed(1), 'guide')
    + text((parseFloat(sx(end[0])) + 7).toFixed(1), (parseFloat(sy(end[1])) + 3).toFixed(1), 'own ship')
    + `</svg>`;
}
