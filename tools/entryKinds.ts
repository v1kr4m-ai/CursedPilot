// Segmented entry boxes: the separators (° ′ : .) and the hemisphere / sign are already on screen, so the user types
// digits only. Each kind turns its boxes into the same text the old single field took ("15 20.5 N", "09:15:00",
// "+5:30"), so the parsers downstream (parseCoord, parseAngle, parseClock, ...) are unchanged.

export type EntryKind = 'lat' | 'lon' | 'angle' | 'time' | 'stopwatch' | 'zone' | 'watch';

export interface Part { len: number; suffix: string; ph: string; dec?: boolean }
export interface Kind { parts: Part[]; toggle?: [string, string]; parse(s: string): { n: string[]; t: 0 | 1 }; out(n: string[], t: 0 | 1): string }

const digits = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? [];

/** "15 20.5", "15", "15.34" or "15 20 30" -> [deg, min, tenths] strings */
function splitDm(s: string): string[] {
  const nums = digits(s);
  if (!nums.length) return ['', '', ''];
  let [d, m = '', sec = ''] = nums;
  if (d.includes('.')) { const v = parseFloat(d); d = String(Math.floor(v)); m = ((v - Math.floor(v)) * 60).toFixed(1); }
  else if (sec) m = (parseFloat(m) + parseFloat(sec) / 60).toFixed(2);
  const [mi, fr = ''] = m.split('.');
  return [d, mi, fr.replace(/0+$/, '')];
}
const dmOut = (n: string[]) => (n.every(x => x === '') ? '' : `${n[0] || '0'} ${n[1] || '0'}${n[2] ? `.${n[2]}` : ''}`);

const coord = (deg: number, hemi: [string, string], frac: number): Kind => ({
  parts: [{ len: deg, suffix: '°', ph: 'D'.repeat(deg) }, { len: 2, suffix: '.', ph: 'MM' }, { len: frac, suffix: '′', ph: 'm'.repeat(frac) }],
  toggle: hemi,
  parse: s => ({ n: splitDm(s), t: /^\s*-/.test(s) || new RegExp(`[${hemi[1][0]}]`, 'i').test(s) ? 1 : 0 }),
  out: (n, t) => (dmOut(n) === '' ? '' : `${dmOut(n)} ${hemi[t]}`),
});

/** The size of a typed position in degrees, from any of the ways it can be written ("15.3417", "15 20.5", "15 20 30"); null when empty. */
function totalDeg(s: string): number | null {
  const nums = digits(s).map(Number);
  if (!nums.length) return null;
  const [d, m = 0, sec = 0] = nums;
  return d + m / 60 + sec / 3600;
}
const trimZeros = (s: string) => s.replace(/0+$/, '');

/** Decimal degrees: [whole degrees, decimal places] */
const coordDeg = (deg: number, hemi: [string, string]): Kind => ({
  parts: [{ len: deg, suffix: '.', ph: 'D'.repeat(deg) }, { len: 5, suffix: '°', ph: 'ddddd' }],
  toggle: hemi,
  parse: s => {
    const nums = digits(s), t = /^\s*-/.test(s) || new RegExp(`[${hemi[1][0]}]`, 'i').test(s) ? 1 : 0;
    if (nums.length === 1) { const [w, f = ''] = nums[0].split('.'); return { n: [w, f.slice(0, 5)], t }; }   // as typed
    const v = totalDeg(s);
    if (v === null) return { n: ['', ''], t };
    const [w, f = ''] = v.toFixed(5).split('.');
    return { n: [w, trimZeros(f)], t };
  },
  out: (n, t) => (n.every(x => x === '') ? '' : `${n[0] || '0'}${n[1] ? `.${n[1]}` : ''} ${hemi[t]}`),
});

/** Degrees, minutes and seconds: [deg, min, sec with decimals] */
const coordDms = (deg: number, hemi: [string, string]): Kind => ({
  parts: [{ len: deg, suffix: '°', ph: 'D'.repeat(deg) }, { len: 2, suffix: '′', ph: 'MM' }, { len: 4, suffix: '″', ph: 'SS', dec: true }],
  toggle: hemi,
  parse: s => {
    const nums = digits(s), t = /^\s*-/.test(s) || new RegExp(`[${hemi[1][0]}]`, 'i').test(s) ? 1 : 0;
    if (nums.length === 3 && !nums[0].includes('.') && !nums[1].includes('.')) return { n: nums.slice(0, 3), t };   // as typed
    const v = totalDeg(s);
    if (v === null) return { n: ['', '', ''], t };
    let d = Math.floor(v), m = Math.floor((v - d) * 60), sec = Math.round(((v - d) * 60 - m) * 600) / 10;
    if (sec >= 60) { sec = 0; m += 1; }
    if (m >= 60) { m = 0; d += 1; }
    return { n: [String(d), String(m), String(sec)], t };
  },
  out: (n, t) => (n.every(x => x === '') ? '' : `${n[0] || '0'} ${n[1] || '0'} ${n[2] || '0'} ${hemi[t]}`),
});

/** How latitudes and longitudes are typed, the same in every tool: decimal degrees, degrees and minutes, or degrees, minutes and seconds. */
export type CoordFormat = 'd' | 'dm' | 'dms';
export const COORD_FORMATS: [CoordFormat, string][] = [['d', 'D.d°'], ['dm', 'D M.m′'], ['dms', 'D M S″']];
export const coordKind = (kind: 'lat' | 'lon', fmt: CoordFormat): Kind => {
  const deg = kind === 'lat' ? 2 : 3, hemi: [string, string] = kind === 'lat' ? ['N', 'S'] : ['E', 'W'];
  return fmt === 'd' ? coordDeg(deg, hemi) : fmt === 'dms' ? coordDms(deg, hemi) : KINDS[kind];
};

const pad2 = (s: string) => s.padStart(2, '0');
const hms = (s: string) => { const c = /^\s*(\d{2})(\d{2})(\d{2})?\s*$/.exec(s); return c ? [c[1], c[2], c[3] ?? ''] : ((s.match(/\d+/g) ?? []) as string[]).concat(['', '', '']).slice(0, 3); };

export const KINDS: Record<EntryKind, Kind> = {
  lat: coord(2, ['N', 'S'], 2),
  lon: coord(3, ['E', 'W'], 2),
  angle: { parts: [{ len: 3, suffix: '°', ph: 'DDD' }, { len: 2, suffix: '.', ph: 'MM' }, { len: 1, suffix: '′', ph: 'm' }], parse: s => ({ n: splitDm(s), t: 0 }), out: n => dmOut(n) },
  time: {
    parts: [{ len: 2, suffix: ':', ph: 'HH' }, { len: 2, suffix: ':', ph: 'MM' }, { len: 2, suffix: '', ph: 'SS' }],
    parse: s => ({ n: hms(s), t: 0 }),
    out: n => (n.every(x => x === '') ? '' : `${pad2(n[0])}:${pad2(n[1])}:${pad2(n[2])}`),
  },
  stopwatch: {
    parts: [{ len: 3, suffix: ':', ph: 'MM' }, { len: 2, suffix: '', ph: 'SS' }],
    parse: s => ({ n: ((s.match(/\d+/g) ?? []) as string[]).concat(['', '']).slice(0, 2), t: 0 }),
    out: n => (n.every(x => x === '') ? '' : `${n[0] || '0'}:${pad2(n[1])}`),
  },
  zone: {
    parts: [{ len: 2, suffix: ':', ph: 'HH' }, { len: 2, suffix: '', ph: 'MM' }],
    toggle: ['+ East', '− West'],
    parse: s => ({ n: ((s.match(/\d+/g) ?? []) as string[]).concat(['', '']).slice(0, 2), t: s.trim().startsWith('-') || s.trim().startsWith('−') ? 1 : 0 }),
    out: (n, t) => (n.every(x => x === '') ? '' : `${t ? '-' : '+'}${n[0] || '0'}:${pad2(n[1])}`),
  },
  watch: {
    parts: [{ len: 4, suffix: 's', ph: '0', dec: true }],
    toggle: ['Slow +', 'Fast −'],
    parse: s => ({ n: [(/\d+(?:\.\d+)?/.exec(s) ?? [''])[0]], t: /^\s*-|fast/i.test(s) ? 1 : 0 }),
    out: (n, t) => (n[0] === '' ? '' : `${t ? '-' : '+'}${n[0]}`),
  },
};

