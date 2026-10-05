import React from 'react';
import { Anchor, Database, PlusCircle, Ship as ShipIcon } from 'lucide-react';
import { AppView } from '../types';

/** The main navigation. Shown on the top-level screens; ship screens use their own back arrow. */
const BottomBar: React.FC<{ view: AppView; onHome: () => void; onFleet: () => void; onAdd: () => void; onData: () => void }> = ({ view, onHome, onFleet, onAdd, onData }) => {
  const items: { id: string; label: string; icon: React.ReactNode; active: boolean; onClick: () => void }[] = [
    { id: 'home', label: 'My Ship', icon: <Anchor size={22} />, active: view === 'home', onClick: onHome },
    { id: 'fleet', label: 'Fleet', icon: <ShipIcon size={22} />, active: view === 'select', onClick: onFleet },
    { id: 'add', label: 'Add Ship', icon: <PlusCircle size={22} />, active: view === 'add', onClick: onAdd },
    { id: 'data', label: 'Backup', icon: <Database size={22} />, active: false, onClick: onData },
  ];
  return (
    <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-xl mx-auto grid grid-cols-4">
        {items.map(i => (
          <button key={i.id} onClick={i.onClick} aria-current={i.active ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-95 ${i.active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {i.icon}{i.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomBar;
