import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Ship } from '../types';
import { ShipWiki } from '../services/shipLookup';
import { formatCommissioned } from '../data/fleet';
import { calibrationSummaries } from '../data/summaries';
import ShipPhoto from './ShipPhoto';

/** The dashboard's headline card: the user's current ship. */
const MyShipHero: React.FC<{ ship: Ship; wiki: ShipWiki | null; onOpen: () => void }> = ({ ship, wiki, onOpen }) => {
  const facts: [string, string][] = ([
    ['Length', ship.particulars.lengthOverall ? `${ship.particulars.lengthOverall} m` : ''],
    ['Displacement', ship.particulars.displacement ? `${ship.particulars.displacement.toLocaleString()} t` : ''],
    ['Speed', ship.info?.speed ?? ''],
    ['Commissioned', formatCommissioned(ship.info?.commissioned)],
  ] as [string, string][]).filter(([, v]) => v);
  const recorded = calibrationSummaries(ship).filter(x => x.count > 0);

  return (
    <button onClick={onOpen} className="w-full text-left bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden active:scale-[0.99] transition-transform">
      <ShipPhoto ship={ship} wiki={wiki} className="aspect-[16/10]">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="absolute left-4 top-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white bg-blue-600/90 px-3 py-1 rounded-full">My Ship</span>
        <div className="absolute left-4 right-4 bottom-4 text-white">
          <h2 className="text-2xl font-bold leading-tight drop-shadow">{ship.name}</h2>
          <p className="text-xs font-semibold text-white/80 mt-0.5">{[ship.info?.pennant, ship.info?.shipClass || ship.type].filter(Boolean).join(' · ')}</p>
        </div>
      </ShipPhoto>
      <div className="p-5 space-y-4">
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map(([k, v]) => <div key={k}><dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k}</dt><dd className="text-sm font-bold text-slate-800">{v}</dd></div>)}
          </dl>
        )}
        {recorded.length > 0 ? (
          <ul className="space-y-2 border-t border-slate-100 pt-3">
            {recorded.map(x => (
              <li key={x.id} className="text-xs">
                <span className="font-bold text-slate-700">{x.title}</span> <span className="text-slate-300">· {x.count}</span>
                {x.latest && <span className="block text-slate-400 font-medium truncate">{x.latest}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 font-medium border-t border-slate-100 pt-3">No calibration data recorded yet.</p>
        )}
        <p className="flex items-center justify-end text-xs font-bold text-blue-600">Open ship <ChevronRight size={14} /></p>
      </div>
    </button>
  );
};

export default MyShipHero;
