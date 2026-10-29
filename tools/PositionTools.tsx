import React from 'react';
import { Field, Grid, Panel, Result, Seg, Warn, bearing, useForm, useMemory } from './kit';
import { parseCoord } from './navMath';
import { decimalDegrees, degMinSec, degMinutes, greatCircle, greatCircleDestination, hoursMinutes, rhumb, rhumbDestination } from './positions';

// Two tabs of the Bearings & Positions tool: a latitude or longitude written three ways, and the distance and bearing between two positions
// (great circle and rhumb line), or the position reached from one. The sums are in positions.ts.

const COORD_HINT = 'e.g. 12 30.5 N, 12.508, 12°30\'30"N';
const nm = (v: number) => `${v < 10 ? v.toFixed(2) : v.toFixed(1)} nm`;
const withKm = (v: number) => `${nm(v)} (${(v * 1.852).toFixed(v * 1.852 < 100 ? 1 : 0)} km)`;
const typedCoord = (s: string, kind: 'lat' | 'lon') => (s.trim() === '' ? null : parseCoord(s, kind));
const bad = (s: string, kind: 'lat' | 'lon') => s.trim() !== '' && parseCoord(s, kind) === null;
const BAD_NOTE = 'A latitude is up to 90° and a longitude up to 180°. Write degrees, minutes and seconds with spaces or symbols, and N, S, E or W (or a minus sign).';

// ---- Latitude and longitude, three ways --------------------------------------------------------------------------
export const LatLongTool: React.FC = () => {
  const f = useForm('latlong', ['lat', 'lon'] as const);
  const lat = typedCoord(f.v.lat, 'lat'), lon = typedCoord(f.v.lon, 'lon');
  const rows = (v: number, kind: 'lat' | 'lon'): [string, string][] => [['Degrees', decimalDegrees(v, kind)], ['Degrees, minutes', degMinutes(v, kind)], ['Degrees, minutes, seconds', degMinSec(v, kind)]];
  return (
    <div className="space-y-2">
      <Panel title="Latitude and longitude" note="Type a position any way you like; it is shown as decimal degrees, degrees and minutes, and degrees, minutes and seconds. Either box can be left empty.">
        <Field label="Latitude" text hint={COORD_HINT} {...f.bind('lat')} invalid={bad(f.v.lat, 'lat')} />
        <Field label="Longitude" text hint={COORD_HINT} {...f.bind('lon')} invalid={bad(f.v.lon, 'lon')} />
        {(bad(f.v.lat, 'lat') || bad(f.v.lon, 'lon')) && <Warn>{BAD_NOTE}</Warn>}
        {lat !== null && <Result rows={rows(lat, 'lat').map(([k, v]) => [`Lat · ${k}`, v] as [string, string])} />}
        {lon !== null && <Result rows={rows(lon, 'lon').map(([k, v]) => [`Long · ${k}`, v] as [string, string])} />}
      </Panel>
    </div>
  );
};

// ---- Distance and bearing between positions, or a position from a course and distance -----------------------------
export const PositionCalcTool: React.FC = () => {
  const [mode, setMode] = useMemory<'between' | 'from'>('pos:mode', 'between');
  return (
    <div className="space-y-2">
      <Seg value={mode} onChange={v => setMode(v as 'between' | 'from')} options={[['between', 'Between two positions'], ['from', 'From a position']]} />
      {mode === 'between' ? <Between /> : <From />}
    </div>
  );
};

const Between: React.FC = () => {
  const f = useForm('pos', ['alat', 'alon', 'blat', 'blon', 'speed'] as const);
  const a = { lat: typedCoord(f.v.alat, 'lat'), lon: typedCoord(f.v.alon, 'lon') }, b = { lat: typedCoord(f.v.blat, 'lat'), lon: typedCoord(f.v.blon, 'lon') };
  const speed = f.n('speed');
  const ready = a.lat !== null && a.lon !== null && b.lat !== null && b.lon !== null;
  const A = ready ? { lat: a.lat!, lon: a.lon! } : null, B = ready ? { lat: b.lat!, lon: b.lon! } : null;
  const gc = A && B ? greatCircle(A, B) : null, rh = A && B ? rhumb(A, B) : null;
  const time = (d: number) => (speed !== null && speed > 0 ? ` · ${hoursMinutes(d / speed)}` : '');
  const anyBad = bad(f.v.alat, 'lat') || bad(f.v.alon, 'lon') || bad(f.v.blat, 'lat') || bad(f.v.blon, 'lon');
  return (
    <>
      <Panel title="From" note="Positions as on the chart; hemisphere letters or a minus sign.">
        <Grid><Field label="Latitude" text hint={COORD_HINT} {...f.bind('alat')} invalid={bad(f.v.alat, 'lat')} /><Field label="Longitude" text hint={COORD_HINT} {...f.bind('alon')} invalid={bad(f.v.alon, 'lon')} /></Grid>
      </Panel>
      <Panel title="To">
        <Grid><Field label="Latitude" text hint={COORD_HINT} {...f.bind('blat')} invalid={bad(f.v.blat, 'lat')} /><Field label="Longitude" text hint={COORD_HINT} {...f.bind('blon')} invalid={bad(f.v.blon, 'lon')} /></Grid>
        <Field label="Speed (optional, for the time)" unit="kn" {...f.bind('speed')} />
        {anyBad && <Warn>{BAD_NOTE}</Warn>}
      </Panel>
      {ready && !gc && <Warn>The two positions are the same.</Warn>}
      {gc && (
        <Result rows={[
          ['Great circle', `${withKm(gc.distance)}${time(gc.distance)}`],
          ['  initial course', bearing(gc.initial)], ['  final course', bearing(gc.final)],
          ...(rh ? [['Rhumb line', `${withKm(rh.distance)}${time(rh.distance)}`] as [string, string], ['  constant course', bearing(rh.course)] as [string, string]] : []),
        ]} />
      )}
      {gc && rh && (
        <Panel title="Mercator sailing" closed note="The rhumb line cuts every meridian at the same angle, so it is the course to steer without altering. The great circle is the shortest way, but its course changes along the way.">
          <Result inline rows={[
            ['Difference of latitude', `${Math.abs(rh.dLat).toFixed(1)}′ ${rh.dLat >= 0 ? 'N' : 'S'}`],
            ['Difference of longitude', `${Math.abs(rh.dLong).toFixed(1)}′ ${rh.dLong >= 0 ? 'E' : 'W'}`],
            ['Departure', `${Math.abs(rh.departure).toFixed(1)} nm ${rh.departure >= 0 ? 'E' : 'W'}`],
            ['Rhumb line longer than the great circle by', `${(rh.distance - gc.distance).toFixed(2)} nm`],
          ]} />
        </Panel>
      )}
      <p className="text-[10px] text-slate-400 font-medium leading-snug">Worked on a sphere with a nautical mile for each minute of arc. The spheroid differs by a few tenths of a percent: for a fix that matters, use the tables.</p>
    </>
  );
};

const From: React.FC = () => {
  const f = useForm('posfrom', ['lat', 'lon', 'crs', 'dist', 'speed'] as const);
  const [method, setMethod] = useMemory<'rhumb' | 'gc'>('pos:method', 'rhumb');
  const lat = typedCoord(f.v.lat, 'lat'), lon = typedCoord(f.v.lon, 'lon'), crs = f.n('crs'), dist = f.n('dist'), speed = f.n('speed');
  const ready = lat !== null && lon !== null && crs !== null && dist !== null && dist >= 0;
  const out = ready ? (method === 'rhumb' ? rhumbDestination({ lat: lat!, lon: lon! }, crs!, dist!) : greatCircleDestination({ lat: lat!, lon: lon! }, crs!, dist!)) : null;
  return (
    <>
      <Panel title="Start" note="The position reached by steering a course for a distance.">
        <Grid><Field label="Latitude" text hint={COORD_HINT} {...f.bind('lat')} invalid={bad(f.v.lat, 'lat')} /><Field label="Longitude" text hint={COORD_HINT} {...f.bind('lon')} invalid={bad(f.v.lon, 'lon')} /></Grid>
        <Grid><Field label="Course" unit="°T" sensor="course" {...f.bind('crs')} /><Field label="Distance" unit="nm" {...f.bind('dist')} /></Grid>
        <Field label="Speed (optional, for the time)" unit="kn" {...f.bind('speed')} />
        <Seg value={method} onChange={v => setMethod(v as 'rhumb' | 'gc')} options={[['rhumb', 'Rhumb line (constant course)'], ['gc', 'Great circle (initial course)']]} />
        {(bad(f.v.lat, 'lat') || bad(f.v.lon, 'lon')) && <Warn>{BAD_NOTE}</Warn>}
      </Panel>
      {ready && !out && <Warn>That track runs over a pole: shorten the distance or change the course.</Warn>}
      {out && (
        <Result rows={[
          ['Latitude', degMinutes(out.lat, 'lat')], ['Longitude', degMinutes(out.lon, 'lon')],
          ['Degrees', `${decimalDegrees(out.lat, 'lat')}, ${decimalDegrees(out.lon, 'lon')}`],
          ...(speed !== null && speed > 0 ? [['Time', hoursMinutes(dist! / speed)] as [string, string]] : []),
        ]} />
      )}
    </>
  );
};
