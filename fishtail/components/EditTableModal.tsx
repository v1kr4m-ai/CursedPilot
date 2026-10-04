
import React, { useState } from 'react';
import { X, Save, Plus, Trash2, AlertTriangle, Table } from 'lucide-react';
import { TurningDataPoint, SideOfTurn } from '../types';

interface EditTableModalProps {
  tableKey: string;
  tableName: string;
  speed: number;
  rudder: string;
  side: SideOfTurn;
  points: TurningDataPoint[];
  onClose: () => void;
  onSave: (metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }, points: TurningDataPoint[]) => void;
}

const EditTableModal: React.FC<EditTableModalProps> = ({ 
  tableKey, tableName, speed, rudder, side, points, onClose, onSave 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    tableName,
    ownSpeed: speed.toString(),
    rudder,
    side
  });
  
  const [localPoints, setLocalPoints] = useState<TurningDataPoint[]>(
    [...points].sort((a, b) => a.heading - b.heading)
  );

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setMetadata({ ...metadata, [e.target.name]: e.target.value });
  };

  const handlePointChange = (index: number, field: keyof TurningDataPoint, value: string) => {
    const updated = [...localPoints];
    const numVal = parseFloat(value);
    
    if (field === 'heading' || field === 'advance' || field === 'transfer' || field === 'time') {
      (updated[index] as any)[field] = isNaN(numVal) ? 0 : numVal;
    } else {
      (updated[index] as any)[field] = value;
    }
    setLocalPoints(updated);
  };

  const addPoint = () => {
    const lastPoint = localPoints[localPoints.length - 1];
    const newPoint: TurningDataPoint = {
      id: crypto.randomUUID(),
      tableName: metadata.tableName,
      heading: (lastPoint?.heading || 0) + 15,
      advance: lastPoint?.advance || 0,
      transfer: lastPoint?.transfer || 0,
      time: lastPoint?.time || 0,
      ownSpeed: parseFloat(metadata.ownSpeed),
      rudder: metadata.rudder,
      side: metadata.side
    };
    setLocalPoints([...localPoints, newPoint]);
  };

  const removePoint = (index: number) => {
    setLocalPoints(localPoints.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const s = parseFloat(metadata.ownSpeed);
    if (isNaN(s) || s < 0) {
      setError("Speed must be a positive number.");
      return;
    }
    if (localPoints.length === 0) {
      setError("Table must have at least one data point.");
      return;
    }
    onSave({
      tableName: metadata.tableName,
      ownSpeed: s,
      rudder: metadata.rudder,
      side: metadata.side
    }, localPoints);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
      <div className="glass w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Table className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Edit Tactical Profile</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Database Record Modification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Table Name</label>
              <input name="tableName" type="text" value={metadata.tableName} onChange={handleMetadataChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Speed (kts)</label>
              <input name="ownSpeed" type="number" value={metadata.ownSpeed} onChange={handleMetadataChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rudder (°)</label>
              <input name="rudder" type="text" value={metadata.rudder} onChange={handleMetadataChange} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Data Points</h3>
              <button onClick={addPoint} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-yellow-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all">
                <Plus className="w-4 h-4" /> Add Heading
              </button>
            </div>

            <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-900/30">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-950 text-slate-600 uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-4 py-3">Heading (°)</th>
                    <th className="px-4 py-3">Advance (yds)</th>
                    <th className="px-4 py-3">Transfer (yds)</th>
                    <th className="px-4 py-3">Time (sec)</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {localPoints.map((p, idx) => (
                    <tr key={p.id} className="group">
                      <td className="px-4 py-2">
                        <input type="text" inputMode="decimal" value={p.heading} onChange={e => handlePointChange(idx, 'heading', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-yellow-500 outline-none font-black text-blue-400 p-1" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" inputMode="decimal" value={p.advance} onChange={e => handlePointChange(idx, 'advance', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-yellow-500 outline-none p-1 text-slate-300 mono" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" inputMode="decimal" value={p.transfer} onChange={e => handlePointChange(idx, 'transfer', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-yellow-500 outline-none p-1 text-slate-300 mono" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" inputMode="decimal" value={p.time} onChange={e => handlePointChange(idx, 'time', e.target.value)} className="w-full bg-transparent border-b border-transparent focus:border-yellow-500 outline-none p-1 text-slate-500" />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removePoint(idx)} className="p-2 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-900/50 border-t border-slate-800 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">Cancel</button>
          <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2">
            <Save className="w-5 h-5" /> Update Library Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTableModal;
