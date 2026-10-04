import React, { useMemo, useEffect, useCallback } from 'react';
import { ManeuverType, SideOfTurn, TurningDataPoint } from '../types';
import { Play, RotateCcw, Activity, SlidersHorizontal, AlertCircle } from 'lucide-react';

interface ManeuverFormProps {
  onSubmit: (params: {
    type: ManeuverType;
    angles: number[];
    guideSpeed: number;
    tableId: { speed: number; rudder: string; side: SideOfTurn; tableName: string };
    offsets?: { advance: number; transfer: number };
  }) => void;
  onExport: (format: 'svg' | 'jpg') => void;
  onZoom: (type: 'in' | 'out' | 'reset') => void;
  onSaveAsTable: () => void;
  loading: boolean;
  turningData: TurningDataPoint[];
  hasResult: boolean;
  yardScale: number;

  // Controlled Shared States
  type: ManeuverType;
  setType: (type: ManeuverType) => void;
  baseAngle: string;
  setBaseAngle: (angle: string) => void;
  distAngle1: string;
  setDistAngle1: (angle: string) => void;
  distAngle2: string;
  setDistAngle2: (angle: string) => void;
  guideSpeed: string;
  setGuideSpeed: (speed: string) => void;
  initialSide: SideOfTurn;
  setInitialSide: (side: SideOfTurn) => void;
  selectedTableKey: string;
  setSelectedTableKey: (key: string) => void;
  useOffsets: boolean;
  setUseOffsets: (use: boolean) => void;
  offAdv: string;
  setOffAdv: (adv: string) => void;
  offTrans: string;
  setOffTrans: (trans: string) => void;
}

const ManeuverForm: React.FC<ManeuverFormProps> = ({
  onSubmit,
  onExport,
  onZoom,
  onSaveAsTable,
  loading,
  turningData,
  hasResult,
  yardScale,

  // Controlled Props
  type,
  setType,
  baseAngle,
  setBaseAngle,
  distAngle1,
  setDistAngle1,
  distAngle2,
  setDistAngle2,
  guideSpeed,
  setGuideSpeed,
  initialSide,
  setInitialSide,
  selectedTableKey,
  setSelectedTableKey,
  useOffsets,
  setUseOffsets,
  offAdv,
  setOffAdv,
  offTrans,
  setOffTrans
}) => {
  const availableTables = useMemo(() => {
    const map = new Map();
    turningData.forEach(d => {
      const key = `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
      if (!map.has(key)) map.set(key, { speed: d.ownSpeed, rudder: d.rudder, side: d.side, tableName: d.tableName });
    });
    return Array.from(map.values());
  }, [turningData]);

  const angleError = useMemo(() => {
    if (type === ManeuverType.DISTORTED) {
      const a1 = parseFloat(distAngle1);
      const a2 = parseFloat(distAngle2);
      if (isNaN(a1) || a1 <= 0 || a1 > 180) return "Angle 1 must be 0-180°";
      if (isNaN(a2) || a2 <= 0 || a2 > 180) return "Angle 2 must be 2-180°";
    } else {
      const a = parseFloat(baseAngle);
      if (isNaN(a) || a <= 0 || a > 180) return "Angle must be 0-185°";
    }
    return null;
  }, [type, baseAngle, distAngle1, distAngle2]);

  const triggerCalculation = useCallback(() => {
    if (!selectedTableKey || angleError) return;
    
    const [speedS, rudderS, sideS, tableName] = selectedTableKey.split('|');
    const tableId = { 
      speed: parseFloat(speedS), 
      rudder: rudderS, 
      side: sideS as SideOfTurn,
      tableName
    };

    let angles: number[] = [];
    const isSTBD = initialSide === SideOfTurn.STARBOARD;

    if (type === ManeuverType.HALF) {
      const angle = parseFloat(baseAngle);
      angles = isSTBD ? [angle, -angle] : [-angle, angle];
    } else if (type === ManeuverType.FULL) {
      const angle = parseFloat(baseAngle);
      angles = isSTBD ? [angle, -2 * angle, angle] : [-angle, 2 * angle, -angle];
    } else if (type === ManeuverType.DISTORTED) {
      const a1 = parseFloat(distAngle1);
      const a2 = parseFloat(distAngle2);
      angles = isSTBD ? [a1, -(a1 + a2), a2] : [-a1, (a1 + a2), -a2];
    }

    const offsets = useOffsets ? {
      advance: parseFloat(offAdv) || 0,
      transfer: parseFloat(offTrans) || 0
    } : undefined;

    onSubmit({ 
      type, 
      angles, 
      guideSpeed: parseFloat(guideSpeed), 
      tableId,
      offsets
    });
  }, [
    selectedTableKey, 
    type, 
    baseAngle, 
    distAngle1, 
    distAngle2, 
    guideSpeed, 
    initialSide, 
    useOffsets, 
    offAdv, 
    offTrans, 
    onSubmit, 
    angleError
  ]);

  useEffect(() => {
    const timer = setTimeout(triggerCalculation, 20);
    return () => clearTimeout(timer);
  }, [
    baseAngle, 
    distAngle1, 
    distAngle2, 
    guideSpeed, 
    initialSide, 
    type, 
    selectedTableKey, 
    useOffsets, 
    offAdv, 
    offTrans, 
    triggerCalculation
  ]);

  return (
    <div className="glass rounded-3xl p-8 border border-slate-800 space-y-6 bg-slate-950/40">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black flex items-center gap-3 tracking-tight uppercase text-blue-400">
          <RotateCcw className="w-6 h-6" />
          Data Card
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-green-500 font-black animate-pulse">
          <Activity className="w-3 h-3" /> LIVE
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Turning Data</label>
          <select 
            required
            value={selectedTableKey}
            onChange={(e) => setSelectedTableKey(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-black text-xs text-white"
          >
            <option value="" disabled>-- Select Table --</option>
            {availableTables.map(t => (
              <option key={`${t.speed}|${t.rudder}|${t.side}|${t.tableName}`} value={`${t.speed}|${t.rudder}|${t.side}|${t.tableName}`}>
                {t.tableName} ({t.speed}kts)
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Guide Speed (kts)</label>
          <input required type="number" value={guideSpeed} onChange={(e) => setGuideSpeed(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white text-center" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['Half', 'Full', 'Distorted'].map((l, i) => {
            const mType = [ManeuverType.HALF, ManeuverType.FULL, ManeuverType.DISTORTED][i];
            return (
              <button key={l} type="button" onClick={() => setType(mType)} className={`py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${type === mType ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{l}</button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Side</label>
          <div className="grid grid-cols-2 h-[46px] bg-slate-900 rounded-xl border border-slate-800 p-1">
            <button type="button" onClick={() => setInitialSide(SideOfTurn.STARBOARD)} className={`rounded-lg text-[10px] font-black uppercase transition-all ${initialSide === SideOfTurn.STARBOARD ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'text-slate-600'}`}>STBD</button>
            <button type="button" onClick={() => setInitialSide(SideOfTurn.PORT)} className={`rounded-lg text-[10px] font-black uppercase transition-all ${initialSide === SideOfTurn.PORT ? 'bg-slate-800 text-red-400 border border-slate-700' : 'text-slate-600'}`}>PORT</button>
          </div>
        </div>

        {type === ManeuverType.DISTORTED ? (
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Angle 1 (°)</label>
              <input type="number" value={distAngle1} onChange={(e) => setDistAngle1(e.target.value)} className={`w-full bg-slate-900 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white text-center ${angleError && distAngle1 ? 'border-red-500' : 'border-slate-800'}`} />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Angle 2 (°)</label>
              <input type="number" value={distAngle2} onChange={(e) => setDistAngle2(e.target.value)} className={`w-full bg-slate-900 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white text-center ${angleError && distAngle2 ? 'border-red-500' : 'border-slate-800'}`} />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Maneuver Angle (°)</label>
            <input type="number" value={baseAngle} onChange={(e) => setBaseAngle(e.target.value)} className={`w-full bg-slate-900 border rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white text-center ${angleError ? 'border-red-500' : 'border-slate-800'}`} />
          </div>
        )}

        {angleError && (
          <div className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase animate-in fade-in">
            <AlertCircle className="w-3 h-3" /> {angleError}
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useOffsets} onChange={(e) => setUseOffsets(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Tactical Offsets</span>
            </label>
          </div>
          
          {useOffsets && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest">Adv (+/- yds)</label>
                <input type="text" inputMode="decimal" value={offAdv} onChange={(e) => setOffAdv(e.target.value)} className="w-full bg-slate-905 border border-slate-800 rounded-lg p-2 font-bold text-xs outline-none focus:border-blue-500 text-white text-center" />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest">Trans (+/- yds)</label>
                <input type="text" inputMode="decimal" value={offTrans} onChange={(e) => setOffTrans(e.target.value)} className="w-full bg-slate-905 border border-slate-800 rounded-lg p-2 font-bold text-xs outline-none focus:border-blue-500 text-white text-center" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={loading || availableTables.length === 0 || !!angleError}
            className={`w-full h-[60px] rounded-2xl font-black text-[11px] uppercase tracking-widest border-2 transition-all duration-500 flex items-center justify-center gap-3 ${loading ? 'border-blue-400 text-blue-400 animate-pulse' : (angleError ? 'border-slate-800 text-slate-700 cursor-not-allowed opacity-50' : 'border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white shadow-xl shadow-blue-600/10')}`}
          >
            <Play className="w-4 h-4" />
            {loading ? 'Processing...' : 'Ready for Plotting'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManeuverForm;
