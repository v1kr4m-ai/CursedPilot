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

