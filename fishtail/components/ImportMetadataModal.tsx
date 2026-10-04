
import React, { useState } from 'react';
import { X, Table, AlertTriangle } from 'lucide-react';
import { SideOfTurn } from '../types';

interface ImportMetadataModalProps {
  onClose: () => void;
  onSubmit: (metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }) => void;
}

const ImportMetadataModal: React.FC<ImportMetadataModalProps> = ({ onClose, onSubmit }) => {
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState('15');
  const [rudder, setRudder] = useState('20');
  const [side, setSide] = useState<SideOfTurn>(SideOfTurn.STARBOARD);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFloat(speed);
    if (isNaN(s) || s < 0) {
      setError("Speed must be a positive number.");
      return;
    }
    
    // Auto-generate table name strictly from parameters
    const autoName = `${s}kts-${rudder}deg-${side.toUpperCase()}`;
    
    onSubmit({
      tableName: autoName,
      ownSpeed: s,
      rudder,
      side
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
      <div className="glass w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-3 uppercase">
            <Table className="w-5 h-5 text-blue-500" />
            Table Identification
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-4 leading-relaxed">
            Specify the performance characteristics. The tactical profile name will be generated automatically based on your inputs.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold uppercase animate-in slide-in-from-top-1">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Own Speed (kts)</label>
              <input required type="number" value={speed} onChange={e => setSpeed(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rudder Angle (°)</label>
              <input required type="text" value={rudder} onChange={e => setRudder(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Side of Turn</label>
            <div className="grid grid-cols-2 h-[46px] bg-slate-900 rounded-xl border border-slate-800 p-1">
              <button type="button" onClick={() => setSide(SideOfTurn.STARBOARD)} className={`rounded-lg text-[10px] font-black uppercase transition-all ${side === SideOfTurn.STARBOARD ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'}`}>Starboard</button>
              <button type="button" onClick={() => setSide(SideOfTurn.PORT)} className={`rounded-lg text-[10px] font-black uppercase transition-all ${side === SideOfTurn.PORT ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600'}`}>Port</button>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]">Link and Save Table</button>
        </form>
      </div>
    </div>
  );
};

export default ImportMetadataModal;
