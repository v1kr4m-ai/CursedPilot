import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { SideOfTurn } from '../types';

interface SaveConfirmModalProps {
  onClose: () => void;
  onConfirm: (metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }) => void;
  defaultValues: {
    tableName: string;
    ownSpeed: number;
    rudder: string;
    side: SideOfTurn;
  };
}

const SaveConfirmModal: React.FC<SaveConfirmModalProps> = ({ onClose, onConfirm, defaultValues }) => {
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    tableName: defaultValues.tableName || 'New Calculation Profile',
    ownSpeed: String(defaultValues.ownSpeed || 15),
    rudder: String(defaultValues.rudder || '20'),
    side: defaultValues.side || SideOfTurn.STARBOARD
  });

  // Keep table name updated beautifully when speed, rudder, or side is typed/changed to keep default descriptive
  const [isCustomName, setIsCustomName] = useState(false);

  useEffect(() => {
    if (!isCustomName) {
      const cleanSide = formData.side.toUpperCase();
      setFormData(prev => ({
        ...prev,
        tableName: `${prev.ownSpeed || 0}kts-${prev.rudder || 0}deg-${cleanSide}-PROFILE`
      }));
    }
  }, [formData.ownSpeed, formData.rudder, formData.side, isCustomName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFloat(formData.ownSpeed);

    if (isNaN(s)) {
      setError("Please check that Own Speed is a valid number.");
      return;
    }

    if (s <= 0) {
      setError("Own Speed must be a positive number.");
      return;
    }

    if (!formData.rudder.trim()) {
      setError("Rudder angle cannot be empty.");
      return;
    }

    onConfirm({
      tableName: formData.tableName.trim() || `${s}kts-${formData.rudder}deg-${formData.side.toUpperCase()}-PROFILE`,
      ownSpeed: s,
      rudder: formData.rudder.trim(),
      side: formData.side
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError(null);
    if (e.target.name === 'tableName') {
      setIsCustomName(true);
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-3 uppercase text-blue-400">
            <Save className="w-5 h-5 text-blue-500" />
            Save Profile to Library
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1 col-span-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Own Speed (kts)</label>
               <input 
                 required 
                 name="ownSpeed" 
                 type="text" 
                 inputMode="decimal" 
                 value={formData.ownSpeed} 
                 onChange={handleChange} 
                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-blue-500" 
               />
             </div>
             <div className="space-y-1 col-span-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rudder (deg)</label>
               <input 
                 required 
                 name="rudder" 
                 type="text" 
                 value={formData.rudder} 
                 onChange={handleChange} 
                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-blue-500" 
               />
             </div>
             <div className="space-y-1 col-span-1">
               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Turn Side</label>
               <select 
                 name="side" 
                 value={formData.side} 
                 onChange={handleChange} 
                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-bold text-xs text-white focus:outline-none focus:border-blue-500"
               >
                 <option value={SideOfTurn.STARBOARD}>STBD (Starboard)</option>
                 <option value={SideOfTurn.PORT}>PORT</option>
               </select>
             </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Save profile as</label>
              {isCustomName && (
                <button 
                  type="button" 
                  onClick={() => setIsCustomName(false)} 
                  className="text-[8px] text-blue-500 font-bold uppercase tracking-wider hover:underline"
                >
                  Reset to default name
                </button>
              )}
            </div>
            <input 
              required 
              name="tableName" 
              type="text" 
              value={formData.tableName} 
              onChange={handleChange} 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm text-yellow-400 outline-none focus:ring-2 focus:ring-blue-500/50" 
              placeholder="e.g. 15kts-20deg-STARBOARD-PROFILE" 
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 border border-slate-800 hover:bg-slate-900 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-grow py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all"
            >
              Confirm & Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveConfirmModal;
