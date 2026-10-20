import React from 'react';
import { Ship } from '../types';
import { Field, Grid, Panel, Result, Seg, SideToggle, Warn, bearing, useForm, useMemory } from './kit';
import { PlayBar, mmss, usePlayer } from './PlayBar';
import { shipParams } from './shipParams';
import { OwnFormula } from './OwnFormula';
import { apparentWind, flyingCourses, signed, trueWind, turnBetween } from './flyingCorpen';

// Flying Corpen: the true wind, the wind on deck, and the course and speed that give the helicopter the wind over the deck it
// needs. The picture plays the turn onto the flying course. The sums are in flyingCorpen.ts.

type Side = 'Port' | 'Starboard';
const FIELDS = ['wf', 'ws', 'rel', 'as', 'crs', 'spd', 'wod', 'wodmax', 'wang', 'maxspd'] as const;
const ROT = 90;       // degrees a minute the picture turns the ship at (a steady 1.5 degrees a second)

const relName = (rel: number) => (Math.abs(rel) < 0.5 || Math.abs(Math.abs(rel) - 180) < 0.5 ? String(Math.round(Math.abs(rel))).padStart(3, '0') : `${rel > 0 ? 'Green' : 'Red'} ${String(Math.round(Math.abs(rel))).padStart(3, '0')}`);
const SIZE = 300, C = SIZE / 2, R = 118;
const at = (bearingDeg: number, r: number) => ({ x: C + Math.sin((bearingDeg * Math.PI) / 180) * r, y: C - Math.cos((bearingDeg * Math.PI) / 180) * r });

/** An arrow along a bearing from outside the circle in to near the ship: the wind arriving from that bearing. */
const WindArrow: React.FC<{ from: number; length: number; color: string; dash?: boolean; label?: string }> = ({ from, length, color, dash, label }) => {
  const a = at(from, R * 0.95), b = at(from, R * 0.95 - length), l = at(from, R * 0.95 + 11);
  const wing = (s: number) => { const d = ((from + 180 + s) * Math.PI) / 180; return { x: b.x + Math.sin(d) * 8, y: b.y - Math.cos(d) * 8 }; };
  return (
    <g stroke={color} strokeWidth={2.2} fill="none" strokeDasharray={dash ? '4 3' : undefined} strokeLinecap="round">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <polyline points={`${wing(-25).x},${wing(-25).y} ${b.x},${b.y} ${wing(25).x},${wing(25).y}`} strokeDasharray="" />
      {label && <text x={l.x} y={l.y + 3} fontSize={8.5} fontWeight={700} fill={color} stroke="none" textAnchor="middle">{label}</text>}
    </g>
  );
};

export const FlyingCorpenTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const sp = shipParams(ship);
  const f = useForm('fly', FIELDS, { maxspd: sp.maxSpeed === undefined ? undefined : String(sp.maxSpeed) });
  const [src, setSrc] = useMemory<'true' | 'deck'>('fly:src', 'true');
  const [aside, setAside] = useMemory<Side>('fly:aside', 'Starboard');
  const [wside, setWside] = useMemory<Side>('fly:wside', 'Starboard');

  const crs = f.n('crs'), spd = f.n('spd');
  const wf = f.n('wf'), ws = f.n('ws'), rel = f.n('rel'), as = f.n('as');
  const tw = src === 'true' ? (wf !== null && ws !== null && ws >= 0 ? { from: wf, speed: ws } : null)
    : (crs !== null && spd !== null && rel !== null && as !== null && as >= 0 && rel >= 0 && rel <= 180 ? trueWind(crs, spd, aside === 'Port' ? -rel : rel, as) : null);

  const wod = f.n('wod'), wodMax = f.n('wodmax'), wang = f.n('wang') ?? 0, maxSpd = f.n('maxspd');
  const theta = wside === 'Port' ? -wang : wang;
  const sols = tw && wod !== null && wod > 0 && wang >= 0 && wang <= 180 ? flyingCourses(tw, wod, theta) : [];
  const best = sols[0] ?? null;
  const upper = tw && wodMax !== null && wod !== null && wodMax > wod ? flyingCourses(tw, wodMax, theta) : [];
  const check = tw && best && best.course !== null ? apparentWind(best.course, best.speed, tw) : null;
  const alter = best && best.course !== null && crs !== null ? turnBetween(crs, best.course) : null;

  // the turn onto the flying course, played
  const turn = alter ?? 0, turnMin = Math.max(Math.abs(turn) / ROT, 0.02);
  const player = usePlayer(turnMin, `${crs}|${spd}|${best?.course}|${best?.speed}`);
  const frac = Math.min(1, player.t / turnMin);
  const heading = best && best.course !== null && crs !== null ? crs + turn * frac : crs;
  const speedNow = best && spd !== null ? spd + (best.speed - spd) * frac : spd;
  const onDeck = tw && heading !== null && speedNow !== null ? apparentWind(heading, speedNow, tw) : null;

  return (
    <div className="space-y-2">
      <Panel title="Wind" note="The true wind is named by the direction it blows from. Give it, or let the tool work it out from the wind you measure on deck with the ship's course and speed.">
        <Seg value={src} onChange={v => setSrc(v as 'true' | 'deck')} options={[['true', 'I know the true wind'], ['deck', 'From the wind on deck']]} />
        {src === 'true' ? (
          <Grid><Field label="True wind from" unit="°T" {...f.bind('wf')} /><Field label="True wind speed" unit="kn" units {...f.bind('ws')} /></Grid>
        ) : (
          <>
            <SideToggle label="Wind on deck on the" value={aside} onChange={setAside} />
            <Grid><Field label="Angle off the bow" unit="°" {...f.bind('rel')} /><Field label="Wind on deck" unit="kn" units {...f.bind('as')} /></Grid>
          </>
        )}
        <Grid><Field label="Ship's course" unit="°T" sensor="course" {...f.bind('crs')} /><Field label="Ship's speed" unit="kn" sensor="speed" {...f.bind('spd')} /></Grid>
        {src === 'deck' && tw && <p className="text-xs font-medium text-slate-600">True wind: from <b>{bearing(tw.from)}</b> at <b>{tw.speed.toFixed(1)} kn</b>.</p>}
      </Panel>

      <Panel title="Wind over the deck needed" note="The wind the helicopter needs over the flight deck: its speed, and the angle off the bow it must come from (right ahead is 0). Take them from the aircraft's and the ship's flying limits. The tool gives the lowest speed that does it.">
        <Grid><Field label="Wind over deck" unit="kn" units {...f.bind('wod')} /><Field label="Up to (optional)" unit="kn" units {...f.bind('wodmax')} /></Grid>
        <SideToggle label="Wind from the" value={wside} onChange={setWside} />
        <Grid><Field label="Angle off the bow" unit="°" hint="0" {...f.bind('wang')} /><Field label="Ship's top speed" unit="kn" units {...f.bind('maxspd')} /></Grid>
        <div className="flex gap-1.5 flex-wrap">
          {[[0, 'Ahead'], [10, 'Green 10'], [10, 'Red 10'], [15, 'Green 15'], [15, 'Red 15'], [30, 'Green 30'], [30, 'Red 30']].map(([a, l]) => (
            <button type="button" key={l as string} onClick={() => { f.bind('wang').onChange(String(a)); setWside((l as string).startsWith('Red') ? 'Port' : 'Starboard'); }}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-600 active:scale-95">{l as string}</button>
          ))}
        </div>
      </Panel>

      {tw && wod !== null && sols.length === 0 && <Warn>The true wind ({tw.speed.toFixed(1)} kn) is too light to bring the deck wind from {relName(theta)}. Ask for a wind from nearer the bow, or less wind over the deck.</Warn>}
      {best && (
        <Result rows={[
          ['True wind', tw ? `from ${bearing(tw.from)} at ${tw.speed.toFixed(1)} kn` : ''],
          ['Flying course', best.course === null ? 'any course (no wind)' : bearing(best.course)],
          ['Speed', `${best.speed.toFixed(1)} kn${upper[0] && upper[0].course !== null && best.course !== null && Math.abs(signed(upper[0].course - best.course)) < 90 ? ` (to ${upper[0].speed.toFixed(1)} kn for ${wodMax} kn)` : ''}`],
          ...(check ? [['Wind on deck', `${relName(check.rel)} at ${check.speed.toFixed(1)} kn`] as [string, string]] : []),
          ...(alter !== null ? [['Alter from present course', `${alter >= 0 ? 'Starboard' : 'Port'} ${Math.abs(alter).toFixed(0)}°`] as [string, string]] : []),
          ...(best.downwind ? [['Note', 'running downwind: faster than the wind'] as [string, string]] : []),
        ]} />
      )}
      {best && maxSpd !== null && best.speed > maxSpd && <Warn>That needs {best.speed.toFixed(1)} kn, more than the ship's top speed of {maxSpd} kn: a lower wind over deck, or a different angle, is needed.</Warn>}
      {sols[1] && sols[1].course !== null && <Result tone="warn" rows={[['Other course that also works', `${bearing(sols[1].course)} at ${sols[1].speed.toFixed(1)} kn`]]} />}

      {best && best.course !== null && crs !== null && tw && heading !== null && (
        <Panel title="The turn onto the flying course">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="The ship, the true wind and the wind on deck" className="w-full max-w-xs mx-auto bg-slate-900 rounded-2xl">
            <circle cx={C} cy={C} r={R} fill="none" stroke="#16a34a" strokeOpacity={0.5} />
            {[0, 90, 180, 270].map(b => { const p = at(b, R + 10); return <text key={b} x={p.x} y={p.y + 3} fontSize={8} textAnchor="middle" fill="#86efac">{b === 0 ? 'N' : b === 90 ? 'E' : b === 180 ? 'S' : 'W'}</text>; })}
            {Array.from({ length: 36 }, (_, i) => i * 10).map(b => { const p = at(b, R), q = at(b, R - (b % 30 === 0 ? 7 : 3)); return <line key={b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#16a34a" strokeOpacity={0.6} />; })}
            {(() => { const a = at(heading + theta, R * 0.78), b = at(heading, 0); return <line x1={b.x} y1={b.y} x2={a.x} y2={a.y} stroke="#4ade80" strokeDasharray="3 3" strokeWidth={1.2} />; })()}
            <g transform={`rotate(${heading} ${C} ${C})`}><polygon points={`${C},${C - 26} ${C - 8},${C + 18} ${C + 8},${C + 18}`} fill="#fff" /></g>
            <WindArrow from={tw.from} length={48} color="#38bdf8" label="true" />
            {onDeck && <WindArrow from={onDeck.from} length={Math.min(70, 20 + onDeck.speed * 1.4)} color="#fb923c" label="on deck" />}
            <text x={6} y={SIZE - 6} fontSize={8} fill="#86efac">North-up · ship's head {bearing(heading)} · dashed: wanted wind on deck</text>
          </svg>
          <PlayBar player={player} totalMinutes={turnMin} label="The turn" />
          {onDeck && speedNow !== null && <p className="text-[10px] text-slate-500 font-medium leading-snug">T+{mmss(player.t)}: head {bearing(heading)}, {speedNow.toFixed(1)} kn; wind on deck {relName(onDeck.rel)} at {onDeck.speed.toFixed(1)} kn. The turn is shown at {ROT}° a minute with the speed changing steadily: allow for your ship's own turning and acceleration.</p>}
        </Panel>
      )}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">An aid. The flying course gives the wind over the deck; the Captain and the flight deck officer decide the ship's course and speed for flying, within the aircraft's and the ship's limits, and allow for the wind changing and for the sea state.</p>
      <OwnFormula id="flyingcorpen" unitHint="" vars={[{ name: 'D', label: 'true wind from (°T)', value: tw ? tw.from : null }, { name: 'S', label: 'true wind speed (kn)', value: tw ? tw.speed : null }, { name: 'W', label: 'wind over deck (kn)', value: wod }, { name: 'a', label: 'angle off bow (°)', value: theta }, { name: 'C', label: 'flying course (°T)', value: best && best.course !== null ? best.course : null }, { name: 'V', label: 'flying speed (kn)', value: best ? best.speed : null }]} />
    </div>
  );
};
