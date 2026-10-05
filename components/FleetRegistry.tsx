import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pin, Search, Star, Trash2, X } from 'lucide-react';
import { Ship } from '../types';
import { CATEGORIES, FleetMeta, MAX_PINS, SORT_LABELS, SortKey, orderShips, togglePin, setMyShip } from '../data/fleet';

interface Props {
  ships: Ship[];
  meta: FleetMeta;
  onMeta: (m: FleetMeta) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const FleetRegistry: React.FC<Props> = ({ ships, meta, onMeta, onOpen, onDelete }) => {
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const { pinned, groups } = useMemo(() => orderShips(ships, meta, query), [ships, meta, query]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    ships.forEach(s => { c[s.type] = (c[s.type] ?? 0) + 1; });
    return c;
  }, [ships]);
  const shown = pinned.length + groups.reduce((n, g) => n + g.ships.length, 0);

  const pin = (e: React.MouseEvent, ship: Ship) => {
    e.stopPropagation();
    const r = togglePin(meta, ship.id);
    if (!r.ok) { setToast(`You can pin up to ${MAX_PINS} ships. Unpin one first.`); return; }
    onMeta(r.meta);
  };
  const mine = (e: React.MouseEvent, ship: Ship) => {
    e.stopPropagation();
    onMeta(setMyShip(meta, meta.myShipId === ship.id ? null : ship.id));
    if (meta.myShipId !== ship.id) setToast(`${ship.name} is now My Ship`);
  };

  const row = (ship: Ship) => {
    const isPinned = meta.pinned.includes(ship.id);
    const isMine = meta.myShipId === ship.id;
    const used = meta.usage[ship.id] ?? 0;
    return (
      <div key={ship.id} onClick={() => onOpen(ship.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(ship.id)}
        className={`flex items-center gap-2 pl-4 pr-2 py-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] ${isMine ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 truncate">{ship.name}</p>
          <p className="text-xs text-slate-400 font-medium truncate">
            {[ship.info?.pennant, ship.info?.shipClass].filter(Boolean).join(' · ') || ship.type}
            {used > 0 && <span className="text-slate-300">{` · opened ${used}×`}</span>}
          </p>
        </div>
        <button onClick={e => mine(e, ship)} aria-label={isMine ? 'Clear My Ship' : 'Set as My Ship'} aria-pressed={isMine} title="My Ship"
          className={`p-2 rounded-full transition-colors ${isMine ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}><Star size={18} className={isMine ? 'fill-current' : ''} /></button>
        <button onClick={e => pin(e, ship)} aria-label={isPinned ? 'Unpin' : 'Pin to top'} aria-pressed={isPinned} title="Pin to top"
          className={`p-2 rounded-full transition-colors ${isPinned ? 'text-blue-600' : 'text-slate-300 hover:text-blue-500'}`}><Pin size={18} className={isPinned ? 'fill-current' : ''} /></button>
        {!ship.catalog && (
          <button onClick={e => { e.stopPropagation(); onDelete(ship.id); }} aria-label="Delete vessel" className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={17} /></button>
        )}
        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </div>
    );
  };

  const chip = (label: string, active: boolean, onClick: () => void, n?: number) => (
    <button key={label} onClick={onClick} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
      {label}{n !== undefined && <span className={active ? 'text-blue-200' : 'text-slate-300'}> {n}</span>}
    </button>
  );

  return (
    <div className="p-6 pb-28 max-w-xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Fleet Registry</h1>
        <p className="text-sm text-slate-400 font-medium">{shown} of {ships.length} ships</p>
      </header>

      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
        <input type="text" placeholder="Search name, pennant or class" value={query} onChange={e => setQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 shadow-sm text-slate-900" />
        {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute inset-y-0 right-3 flex items-center text-slate-300"><X size={18} /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 mb-2" style={{ scrollbarWidth: 'none' }}>
        {chip('All', meta.category === null, () => onMeta({ ...meta, category: null }), ships.length)}
        {CATEGORIES.filter(c => counts[c]).map(c => chip(c, meta.category === c, () => onMeta({ ...meta, category: meta.category === c ? null : c }), counts[c]))}
      </div>

      <label className="flex items-center justify-end gap-2 mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
        Sort
        <select value={meta.sort} onChange={e => onMeta({ ...meta, sort: e.target.value as SortKey })}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 normal-case tracking-normal outline-none">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
        </select>
      </label>

      {pinned.length > 0 && (
        <section className="mb-5">
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2"><Pin size={13} className="fill-current" /> Pinned ({meta.pinned.length}/{MAX_PINS})</h2>
          <div className="space-y-2">{pinned.map(row)}</div>
        </section>
      )}

      {groups.map(g => (
        <section key={g.title || 'all'} className="mb-5">
          {g.title && <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">{g.title} <span className="text-slate-300">{g.ships.length}</span></h2>}
          <div className="space-y-2">{g.ships.map(row)}</div>
        </section>
      ))}

      {shown === 0 && <p className="text-center text-sm text-slate-400 font-medium py-12">No ships match.</p>}

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 px-4 py-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold rounded-full shadow-xl max-w-[90vw] text-center">{toast}</div>
      )}
    </div>
  );
};

export default FleetRegistry;
