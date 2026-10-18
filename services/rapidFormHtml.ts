// The rapid star fix as a printable page: the chosen position, t0, and one line per star with its tabulated altitude
// and bearing, the observed altitude brought to t0, and the intercept; then the plotting data and the fix. Open it in
// a browser and print or save as PDF. Pure; checked by `node tools/fourStar.check.ts`.
import type { RapidResult } from '../tools/fourStar.ts';
import { targetTag } from '../tools/targets.ts';
import { calendarOf } from '../tools/sunEphemeris.ts';

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

const dm = (v: number) => {
  const a = Math.abs(v); let d = Math.floor(a), m = Math.round((a - d) * 600) / 10;
  if (m >= 60) { d += 1; m = 0; }
  return `${v < 0 ? '−' : ''}${d}° ${pad(Math.floor(m))}.${Math.round((m % 1) * 10)}'`;
};
const pos = (v: number, kind: 'lat' | 'lon') => `${dm(Math.abs(v))} ${kind === 'lat' ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E')}`;
const clock = (jd: number, zone: number) => {
  const [, , , f] = calendarOf(Math.round((jd + zone / 24) * 86400) / 86400 + 1e-9);
  const s = Math.floor(f * 86400);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const sgn = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}'`;

export interface RapidMeta {
  header: { from: string; to: string; co: string; spd: string; he: string };
  zone: number; zeroJd: number;
  /** the DR at zero time, shown for reference */
  dr: { lat: number; lon: number };
  ship?: string;
}

export function rapidFormHtml(r: RapidResult, m: RapidMeta, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const rows = r.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)} <span class="mut">${esc(targetTag(l.target))}</span></td><td>${esc(clock(l.jd, m.zone))}</td><td>${esc(dm(l.tabHc))}</td><td>${l.zn.toFixed(1)}°</td><td>${esc(dm(l.ho))}</td><td>${esc(sgn(l.rotation))}</td><td>${esc(dm(l.hoT0))}</td><td>${Math.abs(l.intercept).toFixed(1)}' ${l.intercept >= 0 ? 'to' : 'from'}</td><td>${Math.abs(l.residual).toFixed(2)} nm</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapid star fix</title>
<style>
  body{font-family:system-ui,Roboto,Arial,sans-serif;color:#0f172a;margin:0;padding:16px;font-size:12px;background:#fff}
  main{max-width:760px;margin:0 auto} h1{text-align:center;font-size:17px;margin:0;text-decoration:underline} .sub{text-align:center;color:#475569;margin:2px 0 8px}
  table{border-collapse:collapse;width:100%;margin:6px 0 10px} th,td{border:1px solid #94a3b8;padding:3px 5px;text-align:left;font-variant-numeric:tabular-nums}
  th{background:#e2e8f0;font-size:10px} .box td{border:1px solid #0f172a} .mut{color:#64748b} .fine{font-size:10px;color:#64748b} .warn{background:#fffbeb;border:1px solid #fcd34d;color:#92400e;padding:6px 8px;margin:6px 0}
  .wide{overflow-x:auto} b{font-weight:700}
  @media print{body{padding:0} @page{size:A4 landscape;margin:12mm}}
</style></head><body><main>
<h1>RAPID STAR FIX</h1><p class="sub">${m.ship ? `${esc(m.ship)} &middot; ` : ''}Four stars from one chosen position</p>
<table class="box"><tr><td>From <b>${esc(m.header.from)}</b></td><td>to <b>${esc(m.header.to)}</b></td></tr><tr><td>Co. <b>${esc(m.header.co)}</b> &nbsp; Spd. <b>${esc(m.header.spd)}</b> kts</td><td>H.E. <b>${esc(m.header.he)}</b></td></tr></table>
<table class="box">
<tr><td>D.R. at zero time</td><td><b>${esc(pos(m.dr.lat, 'lat'))} &nbsp; ${esc(pos(m.dr.lon, 'lon'))}</b></td><td>Stopwatch started</td><td><b>${esc(clock(m.zeroJd, m.zone))}</b> zone time (G.M.T. ${esc(clock(m.zeroJd, 0))})</td></tr>
<tr><td>Chosen position</td><td><b>${esc(pos(r.ap.lat, 'lat'))} &nbsp; ${esc(pos(r.ap.lon, 'lon'))}</b></td><td>t0 (zero + 2 min)</td><td><b>${esc(clock(r.t0Jd, m.zone))}</b> zone time</td></tr>
<tr><td>L.H.A. Aries at t0</td><td><b>${r.chosenLhaAries}°</b></td><td>Time of the observed position</td><td><b>${esc(clock(r.fixJd, m.zone))}</b></td></tr>
</table>
<div class="wide"><table><thead><tr><th>No.</th><th>Star</th><th>Zone time</th><th>Tab. alt. at t0</th><th>Zn</th><th>True alt. observed</th><th>Time corr.</th><th>True alt. at t0</th><th>Intercept</th><th>Fix misses by</th></tr></thead><tbody>${rows}</tbody></table></div>
<table class="box"><tr><td>Observed position</td><td><b>${r.fix ? `${esc(pos(r.fix.lat, 'lat'))} &nbsp; ${esc(pos(r.fix.lon, 'lon'))}` : 'the lines do not cross'}</b></td></tr></table>
<p class="fine">Plot each intercept from the one chosen position along its bearing, towards the star or away from it, draw the position line at right angles, carry each line to the time of the position by the run, and the stars' lines should meet. The time correction brings each altitude to t0 for the Earth's rotation: it is 0.25′ a second times cos Lat times sin Zn.</p>
${r.warnings.map(w => `<div class="warn">${esc(w)}</div>`).join('')}
<p class="fine">Prepared ${day} by Cursed Pilot. The tabulated altitudes are calculated for the chosen position, not taken from the Rapid Sight Reduction Tables, so they can differ from the book by about 0.1′ and 0.1°.</p>
</main></body></html>`;
}
