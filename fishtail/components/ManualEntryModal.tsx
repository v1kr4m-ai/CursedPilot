
import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { TurningDataPoint, SideOfTurn } from '../types';

interface ManualEntryModalProps {
  onClose: () => void;
  onSubmit: (point: TurningDataPoint) => void;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ onClose, onSubmit }) => {
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tableName: 'New Tactical Table',
    heading: '',
    advance: '',
    transfer: '',
    time: '',
    ownSpeed: '15',
    rudder: '20',
    side: SideOfTurn.STARBOARD
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(formData.heading);
    const a = parseFloat(formData.advance);
    const tr = parseFloat(formData.transfer);
    const t = parseFloat(formData.time);
    const s = parseFloat(formData.ownSpeed);

    if (isNaN(h) || isNaN(a) || isNaN(tr) || isNaN(t) || isNaN(s)) {
      setError("Please ensure all numeric fields are filled correctly.");
      return;
    }

    if (t < 0 || s < 0) {
      setError("Time and Speed must be positive numeric values.");
      return;
    }

    onSubmit({
      id: crypto.randomUUID(),
      tableName: formData.tableName || "Unnamed Table",
      heading: h,
      advance: a,
      transfer: tr,
      time: t,
      ownSpeed: s,
      rudder: formData.rudder,
      side: formData.side
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-3 uppercase">
            <Save className="w-5 h-5 text-blue-500" />
            Manual Data Entry
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Table Name</label>
            <input required name="tableName" type="text" value={formData.tableName} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Frigate 15kts 20deg" />
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Own Spd</label>
               <input required name="ownSpeed" type="text" inputMode="decimal" value={formData.ownSpeed} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-bold text-xs" />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rudder</label>
               <input required name="rudder" type="text" value={formData.rudder} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-bold text-xs" />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Side</label>
               <select name="side" value={formData.side} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-bold text-xs">
                 <option value={SideOfTurn.STARBOARD}>STBD</option>
                 <option value={SideOfTurn.PORT}>PORT</option>
               </select>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Heading (°)</label>
              <input required name="heading" type="text" inputMode="decimal" value={formData.heading} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Advance (yds)</label>
              <input required name="advance" type="text" inputMode="decimal" value={formData.advance} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transfer (yds)</label>
              <input required name="transfer" type="text" inputMode="decimal" value={formData.transfer} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Time (sec)</label>
              <input required name="time" type="text" inputMode="decimal" value={formData.time} onChange={handleChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold outline-none" />
            </div>
          </div>

          <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all">Save to tactical library</button>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryModal;
