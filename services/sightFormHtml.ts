// The filled Admiralty Sight Form (NP 98) as a printable page: one form per sight in the line order of the printed
// form, then the plotting data and the cross-check. Open it in a browser and print or save as PDF. Pure; checked by
// `node tools/sightForm.check.ts`.
import type { FormRow, FormSet, SightForm } from '../tools/sightForm.ts';
import { distNm } from '../tools/sightForm.ts';

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SECTIONS: { name: string; from: number; to: number }[] = [
  { name: 'Section 2', from: 1, to: 3 },
  { name: 'Section 3: time', from: 4, to: 9 },
  { name: 'Section 4: Nautical Almanac', from: 10, to: 20 },
  { name: 'Section 5: Sight Reduction Tables', from: 21, to: 25 },
  { name: 'Section 6: altitude', from: 26, to: 31 },
  { name: 'Section 7: intercept and position', from: 32, to: 37 },
];

const rowHtml = (r: FormRow) =>
  `<tr><td class="n">${r.n}</td><td class="l">${esc(r.label)}</td><td class="v">${esc(r.value)}</td><td class="v2">${esc(r.value2 ?? '')}</td><td class="note">${esc(r.note ?? '')}</td></tr>`;

function formHtml(f: SightForm): string {
  const body = SECTIONS.map(s => `<tbody><tr class="sec"><th colspan="5">${esc(s.name)}</th></tr>${f.rows.filter(r => r.n >= s.from && r.n <= s.to).map(rowHtml).join('')}</tbody>`).join('');
  return `<section class="form">
<h1>SIGHT FORM (NP 98)</h1><p class="sub">${esc(f.title)}</p>
<table class="head"><tr><td>From <b>${esc(f.header.from)}</b></td><td>to <b>${esc(f.header.to)}</b></td></tr><tr><td>Co. <b>${esc(f.header.co)}</b> &nbsp; Spd. <b>${esc(f.header.spd)}</b> kts</td><td>H.E. <b>${esc(f.header.he)}</b></td></tr></table>
<table class="rows">${body}</table>
${f.notes.map(n => `<p class="fine">${esc(n)}</p>`).join('')}
</section>`;
}

const deg = (v: number, kind: 'lat' | 'lon') => {
  const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  const mm = Math.round(m * 10) / 10, dd = mm >= 60 ? d + 1 : d, shown = mm >= 60 ? 0 : mm;
  return `${dd}° ${shown.toFixed(1).padStart(4, '0')}' ${kind === 'lat' ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E')}`;
};

export function sightFormsHtml(set: FormSet, meta: { title: string; ship?: string }, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const plot = set.plot.map(p => `<tr><td>${esc(p.label)}</td><td>${esc(deg(p.ap.lat, 'lat'))} ${esc(deg(p.ap.lon, 'lon'))}</td><td>${p.zn.toFixed(1)}° T</td><td>${Math.abs(p.intercept).toFixed(1)}' ${p.intercept >= 0 ? 'towards' : 'away'}</td><td>${esc(deg(p.point.lat, 'lat'))} ${esc(deg(p.point.lon, 'lon'))}</td></tr>`).join('');
  const cross = set.fixForm && set.fixDirect
    ? `<tr><td>By the sight forms (chosen positions)</td><td>${esc(deg(set.fixForm.lat, 'lat'))} &nbsp; ${esc(deg(set.fixForm.lon, 'lon'))}</td></tr>
<tr><td>By direct calculation from the DR (cross-check)</td><td>${esc(deg(set.fixDirect.lat, 'lat'))} &nbsp; ${esc(deg(set.fixDirect.lon, 'lon'))}</td></tr>
<tr><td>Difference</td><td>${distNm(set.fixForm, set.fixDirect).toFixed(2)} nm</td></tr>`
    : '<tr><td colspan="2">No position: the lines do not cross.</td></tr>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} - sight forms</title>
<style>
  body{font-family:system-ui,Roboto,Arial,sans-serif;color:#0f172a;margin:0;padding:16px;font-size:12px;background:#fff}
  .form,.plot{max-width:720px;margin:0 auto 28px;page-break-after:always;break-after:page}
  .plot{page-break-after:auto;break-after:auto}
  h1{text-align:center;font-size:17px;margin:0;text-decoration:underline} .sub{text-align:center;color:#475569;margin:2px 0 8px}
  table{border-collapse:collapse;width:100%} .head td{border:1px solid #0f172a;padding:4px 8px}
  .rows th{background:#e2e8f0;text-align:left;font-size:10px;letter-spacing:.04em;padding:3px 6px;border:1px solid #0f172a;border-bottom:0}
  .rows td{border:1px solid #94a3b8;padding:3px 6px;vertical-align:top} .rows tbody{border:2px solid #0f172a}
  .rows{table-layout:fixed} .rows td{overflow-wrap:anywhere}
  td.n{width:6%;text-align:right;color:#475569} td.l{width:29%;font-weight:600} td.v{width:27%;font-variant-numeric:tabular-nums;font-weight:700}
  td.v2{width:17%;font-variant-numeric:tabular-nums;font-weight:700} td.note{width:21%;color:#64748b;font-size:10px}
  @media(max-width:560px){body{padding:6px;font-size:11px} .rows td{padding:2px 3px}}
  .fine{font-size:10px;color:#64748b;margin:6px 0 0}
  .plot h2{font-size:14px;margin:0 0 6px} .plot table{margin-bottom:14px} .plot th,.plot td{border:1px solid #94a3b8;padding:4px 6px;text-align:left}
  .plot th{background:#f1f5f9;font-size:10px} .warn{background:#fffbeb;border:1px solid #fcd34d;color:#92400e;padding:6px 8px;margin:6px 0}
  @media print{body{padding:0} .form,.plot{margin:0;max-width:none} @page{size:A4;margin:12mm}}
</style></head><body>
${set.forms.map(f => formHtml(f)).join('')}
<section class="plot">
<h2>Plotting data and cross-check${meta.ship ? ` - ${esc(meta.ship)}` : ''}</h2>
<table><thead><tr><th>Line</th><th>Chosen position</th><th>Azimuth</th><th>Intercept</th><th>Point on the position line</th></tr></thead><tbody>${plot}</tbody></table>
<p class="fine">Plot each intercept from the chosen position along the azimuth, towards or away from the Sun, and draw the position line at right angles through that point. Carry the first line forward by the run.</p>
<table><thead><tr><th>Observed position</th><th></th></tr></thead><tbody>${cross}</tbody></table>
${set.warnings.map(w => `<div class="warn">${esc(w)}</div>`).join('')}
<p class="fine">Prepared ${day} by Cursed Pilot. The figures are calculated, not taken from the Nautical Almanac or the Sight Reduction Tables, so check them against the books where it matters.</p>
</section>
</body></html>`;
}
