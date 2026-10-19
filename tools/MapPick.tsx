import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, X } from 'lucide-react';
import { getPosition } from '../services/position';
import * as nav from './navMath';

// Pick a position from a map. The map is OpenStreetMap, so it needs the internet: it is a road-and-coast map, NOT a nautical
// chart, and a picked point is only as good as the tap. For an object that matters, take the position from the chart.
// The position is returned in decimal degrees (south and west negative).

const INDIA: [number, number] = [15, 78];

export const MapPick: React.FC<{ title: string; start?: { lat: number; lon: number } | null; onPick: (lat: number, lon: number) => void; onClose: () => void }> = ({ title, start, onPick, onClose }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(start ?? null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const place = (lat: number, lon: number) => {
    setPicked({ lat, lon });
    if (!map.current) return;
    if (marker.current) marker.current.setLatLng([lat, lon]);
    else marker.current = L.circleMarker([lat, lon], { radius: 9, color: '#dc2626', weight: 3, fillColor: '#fecaca', fillOpacity: 0.7 }).addTo(map.current);
  };

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(start ? [start.lat, start.lon] : INDIA, start ? 12 : 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' })
      .on('tileerror', () => setNote('The map tiles could not be loaded: the map needs the internet. You can type the position instead.'))
      .addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    map.current = m;
    if (start) place(start.lat, start.lon);
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const here = async () => {
    setBusy(true); setNote(null);
    try { const p = await getPosition(); map.current?.setView([p.lat, p.lon], 13); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-white flex flex-col" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <button onClick={onClose} aria-label="Close the map" className="p-2 rounded-full bg-slate-100 active:scale-95"><X size={20} /></button>
      </div>
      <div ref={box} className="flex-1 min-h-0" />
      <div className="p-3 border-t border-slate-200 space-y-2">
        {note && <p className="text-xs font-bold text-amber-600">{note}</p>}
        <p className="text-xs font-bold text-slate-700">{picked ? `${nav.formatCoord(picked.lat, 'lat')}  ${nav.formatCoord(picked.lon, 'lon')}` : 'Tap the map to place the object.'}</p>
        <p className="text-[10px] text-slate-400 font-medium">OpenStreetMap is not a nautical chart. For an object you will fix by, take its position from the chart.</p>
        <div className="flex gap-2">
          <button onClick={here} disabled={busy} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-blue-200 text-blue-600 text-xs font-bold active:scale-95 disabled:opacity-50"><Crosshair size={16} />{busy ? '…' : 'My position'}</button>
          <button onClick={() => { if (picked) { onPick(picked.lat, picked.lon); onClose(); } }} disabled={!picked} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95 disabled:opacity-40">Use this position</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Decimal degrees as the text the latitude and longitude boxes take: "51 28.50 N". */
export function coordText(deg: number, kind: 'lat' | 'lon'): string {
  const hemi = kind === 'lat' ? (deg < 0 ? 'S' : 'N') : (deg < 0 ? 'W' : 'E');
  const a = Math.abs(deg);
  let d = Math.floor(a), m = Math.round((a - d) * 6000) / 100;
  if (m >= 60) { d += 1; m = 0; }
  return `${d} ${m.toFixed(2)} ${hemi}`;
}
