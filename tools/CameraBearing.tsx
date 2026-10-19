import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';
import { watchCompass } from '../services/position';
import { circularMean, relativeTo, trueFromMagnetic } from './sensors';
import { bearing } from './kit';

// Bearing by camera: the phone's back camera is the sight, a crosshair marks the centre, and the phone's compass gives the
// bearing of whatever is under it. Magnetic bearing -> true (with the variation) -> relative to the ship's head.
// The phone compass is magnetic and steel on a ship throws it off, so this is a quick estimate to check against the
// ship's compass or gyro repeater, not a substitute.

export interface MarkedBearing { magnetic: number; trueBearing: number | null; off: number | null; side: 'Port' | 'Starboard' | null }

const SPAN_MS = 1000;      // the mark averages the last second of readings

export const CameraBearing: React.FC<{ shipHead: number | null; variation: number | null; onUse?: (m: MarkedBearing) => void; onClose: () => void }> = ({ shipHead, variation, onUse, onClose }) => {
  const video = useRef<HTMLVideoElement>(null);
  const recent = useRef<{ t: number; h: number }[]>([]);
  const [live, setLive] = useState<{ heading: number; beta: number | null } | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);
  const [marked, setMarked] = useState<MarkedBearing & { spread: number } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null, cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) setCamError('This phone will not give the app its camera.');
    else navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(s => { if (cancelled) { s.getTracks().forEach(t => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } })
      .catch(() => setCamError('The camera could not be opened. Allow the app to use the camera in the phone settings.'));
    const stop = watchCompass(s => { const t = performance.now(); recent.current = [...recent.current.filter(x => t - x.t < SPAN_MS), { t, h: s.heading }]; setLive(s); }, setCompassError);
    return () => { cancelled = true; stop(); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const mark = () => {
    const hs = recent.current.map(x => x.h);
    if (!hs.length) return;
    const m = circularMean(hs), tb = variation === null ? null : trueFromMagnetic(m.mean, variation);
    const rel = tb !== null && shipHead !== null ? relativeTo(tb, shipHead) : null;
    setMarked({ magnetic: m.mean, spread: m.spread, trueBearing: tb, off: rel ? rel.off : null, side: rel ? rel.side : null });
  };
  const upright = live?.beta == null || live.beta >= 55;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col" role="dialog" aria-label="Bearing by camera">
      <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      {/* crosshair */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/70" /><div className="absolute top-1/2 left-0 right-0 h-px bg-white/70" />
        <div className="absolute left-1/2 top-1/2 w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500" />
      </div>
      <div className="relative z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-xs font-bold">
          <div className="text-2xl tabular-nums">{live ? `${Math.round(live.heading).toString().padStart(3, '0')}°M` : '---'}</div>
          <div className="opacity-80">{variation !== null && live ? `${bearing(trueFromMagnetic(live.heading, variation)).replace('°', '')}°T · ` : ''}magnetic, from the phone compass</div>
        </div>
        <button onClick={onClose} aria-label="Close the camera" className="p-3 rounded-full bg-white/20 active:scale-95"><X size={22} /></button>
      </div>
      <div className="relative z-10 mt-auto p-3 space-y-2 bg-gradient-to-t from-black/80 to-transparent">
        {camError && <p className="text-xs font-bold text-amber-300">{camError} You can still read the compass bearing above.</p>}
        {compassError && <p className="text-xs font-bold text-amber-300">{compassError}</p>}
        {!upright && <p className="text-xs font-bold text-amber-300">Hold the phone upright, with the camera pointing at the ship.</p>}
        {variation === null && <p className="text-[11px] font-medium text-white/70">Enter the variation to get the true and relative bearings.</p>}
        {marked && (
          <div className="p-3 rounded-2xl bg-white/15 backdrop-blur text-sm font-bold space-y-0.5">
            <div className="flex justify-between"><span className="opacity-80 font-semibold">Magnetic</span><span>{bearing(marked.magnetic)}</span></div>
            {marked.trueBearing !== null && <div className="flex justify-between"><span className="opacity-80 font-semibold">True</span><span>{bearing(marked.trueBearing)}</span></div>}
            {marked.off !== null && marked.side && <div className="flex justify-between"><span className="opacity-80 font-semibold">Relative</span><span>{marked.side === 'Port' ? 'Red' : 'Green'} {String(Math.round(marked.off)).padStart(3, '0')}</span></div>}
            {marked.spread > 3 && <div className="text-xs text-amber-300">Unsteady by about ±{Math.round(marked.spread)}°: hold still and mark again.</div>}
            {marked.trueBearing !== null && shipHead === null && <div className="text-xs text-white/70">Enter the ship's head for the relative bearing.</div>}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={mark} disabled={!live} className="flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl bg-blue-600 text-white font-bold active:scale-95 disabled:opacity-40"><Camera size={20} />Mark bearing</button>
          {marked && onUse && marked.off !== null && <button onClick={() => { onUse(marked); onClose(); }} className="px-4 rounded-2xl bg-white text-slate-900 font-bold active:scale-95">Use it</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
};
