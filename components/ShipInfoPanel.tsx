import React, { useState } from 'react';
import { Camera, ChevronDown, ExternalLink, Pencil, Pin, Star, Trash2 } from 'lucide-react';
import { Ship, ShipInfo } from '../types';
import { ShipWiki } from '../services/shipLookup';
import { formatCommissioned } from '../data/fleet';
import { fileToSmallJpeg } from '../services/photo';
import { shownFields } from '../data/customFields';
import ShipPhoto from './ShipPhoto';

interface Props {
  ship: Ship;
  wiki: ShipWiki | null;
  lookup: 'idle' | 'loading' | 'none';
  isMine: boolean;
  isPinned: boolean;
  onToggleMine: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onPhoto: (dataUrl: string | undefined) => void;
}

const KEY_FACTS: [string, keyof ShipInfo][] = [['Class', 'shipClass'], ['Pennant', 'pennant'], ['Builder', 'builder'], ['Commissioned', 'commissioned'], ['Status', 'status']];
const MORE_FACTS: [string, keyof ShipInfo][] = [
  ['Displacement', 'displacement'], ['Length', 'length'], ['Beam', 'beam'], ['Draught', 'draught'], ['Speed', 'speed'],
  ['Complement', 'complement'], ['Propulsion', 'propulsion'], ['Armament', 'armament'], ['Sensors', 'sensors'], ['Aircraft', 'aircraft'], ['Notes', 'notes'],
];

const ShipInfoPanel: React.FC<Props> = ({ ship, wiki, lookup, isMine, isPinned, onToggleMine, onTogglePin, onEdit, onPhoto }) => {
  const [more, setMore] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const info = ship.info;
  const value = (k: keyof ShipInfo) => (k === 'commissioned' ? formatCommissioned(info?.[k]) : (info?.[k] ?? '').toString().trim());
  const key = KEY_FACTS.filter(([, k]) => value(k));
  const extra = MORE_FACTS.filter(([, k]) => value(k));
  const mine = shownFields(ship, 'details').filter(f => f.value.trim());

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { onPhoto(await fileToSmallJpeg(f)); setPhotoError(null); } catch (err) { setPhotoError(err instanceof Error ? err.message : String(err)); }
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <ShipPhoto ship={ship} wiki={wiki} className="aspect-[16/9]">
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-4 bottom-3 text-[10px] font-bold uppercase tracking-widest text-white/90 bg-black/30 backdrop-blur px-2.5 py-1 rounded-full">{ship.type}</span>
        <div className="absolute right-3 top-3 flex gap-2">
          <label className="p-2 bg-black/35 backdrop-blur rounded-full text-white cursor-pointer active:scale-95" title="Use your own photo" aria-label="Use your own photo">
            <Camera size={16} /><input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
          </label>
          {ship.photo && <button onClick={() => onPhoto(undefined)} className="p-2 bg-black/35 backdrop-blur rounded-full text-white active:scale-95" title="Remove your photo" aria-label="Remove your photo"><Trash2 size={16} /></button>}
        </div>
      </ShipPhoto>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={onToggleMine} aria-pressed={isMine} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${isMine ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            <Star size={14} className={isMine ? 'fill-current' : ''} />{isMine ? 'My Ship' : 'Set as My Ship'}
          </button>
          <button onClick={onTogglePin} aria-pressed={isPinned} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${isPinned ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>
            <Pin size={14} className={isPinned ? 'fill-current' : ''} />{isPinned ? 'Pinned' : 'Pin'}
          </button>
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border bg-white text-slate-500 border-slate-200 ml-auto"><Pencil size={14} />Edit details</button>
        </div>
        {photoError && <p className="text-xs font-bold text-red-500">{photoError}</p>}

        {wiki ? (
          <div>
            <p className="text-sm text-slate-600 leading-relaxed">{wiki.extract}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1.5">
              From Wikipedia (CC BY-SA){wiki.imageTitle && wiki.imageTitle !== wiki.title && !ship.photo ? <>{` · picture from “${wiki.imageTitle}”`}</> : null}{wiki.page && <>{' · '}<a href={wiki.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-500">read more <ExternalLink size={10} /></a></>}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-medium">
            {lookup === 'loading' ? 'Looking up a description and picture…' : 'No description saved yet. A short description and picture are fetched from Wikipedia when you are online, then kept for offline use.'}
          </p>
        )}

        {key.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {key.map(([label, k]) => (
              <div key={k} className={k === 'shipClass' || k === 'builder' ? 'col-span-2' : ''}>
                <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</dt>
                <dd className="text-sm font-bold text-slate-800">{value(k)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <button onClick={onEdit} className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-xs font-bold text-slate-400">Add class, pennant, builder and more</button>
        )}

        {extra.length + mine.length > 0 && (
          <div>
            <button onClick={() => setMore(m => !m)} aria-expanded={more} className="flex items-center gap-1 text-xs font-bold text-blue-600">
              {more ? 'Hide' : 'Show'} full details <ChevronDown size={14} className={`transition-transform ${more ? 'rotate-180' : ''}`} />
            </button>
            {more && (
              <dl className="mt-3 space-y-3">
                {extra.map(([label, k]) => (
                  <div key={k}><dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</dt><dd className="text-sm text-slate-700 font-medium">{value(k)}</dd></div>
                ))}
                {mine.map(f => (
                  <div key={f.id}><dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</dt><dd className="text-sm text-slate-700 font-medium whitespace-pre-line">{f.value}</dd></div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ShipInfoPanel;
