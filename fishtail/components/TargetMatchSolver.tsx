import React, { useState, useMemo, useEffect } from 'react';
import { 
  ManeuverType, 
  SideOfTurn, 
  TurningDataPoint, 
  STATION_PRESETS 
} from '../types';
import { 
  Target, 
  Compass, 
  Lightbulb, 
  HelpCircle, 
  Play, 
  ArrowRight, 
  SlidersHorizontal, 
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { interpolateData } from '../utils/interpolation';
import { calculateManeuverLocally } from '../utils/maneuverEngine';

interface TargetMatchSolverProps {
  turningData: TurningDataPoint[];
  selectedTableKey: string;
  setSelectedTableKey: React.Dispatch<React.SetStateAction<string>>;
  guideSpeed: string;
  setGuideSpeed: React.Dispatch<React.SetStateAction<string>>;
  initialSide: SideOfTurn;
  setInitialSide: React.Dispatch<React.SetStateAction<SideOfTurn>>;
  targetSep: string;
  setTargetSep: React.Dispatch<React.SetStateAction<string>>;
  targetDrop: string;
  setTargetDrop: React.Dispatch<React.SetStateAction<string>>;
  solverMode: 'direct' | 'station';
  setSolverMode: React.Dispatch<React.SetStateAction<'direct' | 'station'>>;
  initStationPreset: number;
  setInitStationPreset: React.Dispatch<React.SetStateAction<number>>;
  initStationBearing: string;
  setInitStationBearing: React.Dispatch<React.SetStateAction<string>>;
  initStationRange: string;
  setInitStationRange: React.Dispatch<React.SetStateAction<string>>;
  targetStationPreset: number;
  setTargetStationPreset: React.Dispatch<React.SetStateAction<number>>;
  targetStationBearing: string;
  setTargetStationBearing: React.Dispatch<React.SetStateAction<string>>;
  targetStationRange: string;
  setTargetStationRange: React.Dispatch<React.SetStateAction<string>>;
  onApplySolution: (solution: {
    type: ManeuverType;
    baseAngle: string;
    distAngle1: string;
    distAngle2: string;
    initialSide: SideOfTurn;
  }) => void;
}

const TargetMatchSolver: React.FC<TargetMatchSolverProps> = ({
  turningData,
  selectedTableKey,
  setSelectedTableKey,
  guideSpeed,
  setGuideSpeed,
  initialSide,
  setInitialSide,
  targetSep,
  setTargetSep,
  targetDrop,
  setTargetDrop,
  solverMode,
  setSolverMode,
  initStationPreset,
  setInitStationPreset,
  initStationBearing,
  setInitStationBearing,
  initStationRange,
  setInitStationRange,
  targetStationPreset,
  setTargetStationPreset,
  targetStationBearing,
  setTargetStationBearing,
  targetStationRange,
  setTargetStationRange,
  onApplySolution
}) => {
  const availableTables = useMemo(() => {
    const map = new Map();
    turningData.forEach(d => {
      const key = `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
      if (!map.has(key)) map.set(key, { speed: d.ownSpeed, rudder: d.rudder, side: d.side, tableName: d.tableName });
    });
    return Array.from(map.values());
  }, [turningData]);

  // Sync Station parameters into separation & drop in real time
  useEffect(() => {
    if (solverMode !== 'station') return;

    const b1 = STATION_PRESETS[initStationPreset].bearing === -1 
      ? parseFloat(initStationBearing) || 0 
      : STATION_PRESETS[initStationPreset].bearing;
    
    const r1 = parseFloat(initStationRange) || 0;

    const b2 = STATION_PRESETS[targetStationPreset].bearing === -1 
      ? parseFloat(targetStationBearing) || 0 
      : STATION_PRESETS[targetStationPreset].bearing;
    
    const r2 = parseFloat(targetStationRange) || 0;

    const rad1 = (b1 * Math.PI) / 180;
    const rad2 = (b2 * Math.PI) / 180;

    // x = r * sin(b), y = r * cos(b)
    const x1 = r1 * Math.sin(rad1);
    const y1 = r1 * Math.cos(rad1);

    const x2 = r2 * Math.sin(rad2);
    const y2 = r2 * Math.cos(rad2);

    const reqSep = Math.abs(x2 - x1);
    const reqDrop = y1 - y2;

    setTargetSep(Math.round(reqSep).toString());
    setTargetDrop(Math.round(reqDrop).toString());
  }, [solverMode, initStationPreset, initStationBearing, initStationRange, targetStationPreset, targetStationBearing, targetStationRange, setTargetSep, setTargetDrop]);

  // Core Tactical Reverse Solver algorithm (runs instantly in memory)
  const recommendations = useMemo(() => {
    if (!selectedTableKey) return [];
    
    const [speedS, rudderS, sideS, tableName] = selectedTableKey.split('|');
    const tableSubset = turningData.filter(d => 
      d.ownSpeed === parseFloat(speedS) && 
      d.rudder === rudderS && 
      d.side === sideS as SideOfTurn &&
      d.tableName === tableName
    );
    if (tableSubset.length === 0) return [];

    const activeGuideSpeed = parseFloat(guideSpeed) || 12;
    const isSTBD = initialSide === SideOfTurn.STARBOARD;
    const targetS = parseFloat(targetSep);
    const targetD = parseFloat(targetDrop);
    
    if (isNaN(targetS) || isNaN(targetD)) return [];

    const headings = tableSubset.map(d => d.heading);
    if (headings.length === 0) return [];
    const minH = Math.max(10, Math.min(...headings));
    const maxH = Math.min(125, Math.max(...headings));

    const candidates: Array<{
      type: ManeuverType;
      angleText: string;
      separation: number;
      drop: number;
      error: number;
      time: number;
      baseAngle?: number;
      angle1?: number;
      angle2?: number;
    }> = [];

    // 1. Evaluate HALF FISHTAIL bounds
    for (let alpha = Math.ceil(minH); alpha <= Math.floor(maxH); alpha += 1) {
      const angles = isSTBD ? [alpha, -alpha] : [-alpha, alpha];
      try {
        const legData = [
          interpolateData(alpha, tableSubset),
          interpolateData(alpha, tableSubset)
        ];
        const res = calculateManeuverLocally(angles, legData, activeGuideSpeed);
        const err = Math.sqrt(Math.pow(res.lateral_separation - targetS, 2) + Math.pow(res.drop_distance - targetD, 2));
        candidates.push({
          type: ManeuverType.HALF,
          angleText: `Base Angle: ${alpha}°`,
          separation: res.lateral_separation,
          drop: res.drop_distance,
          error: err,
          time: res.total_time,
          baseAngle: alpha
        });
      } catch (e) {}
    }

    // 2. Evaluate FULL FISHTAIL bounds
    const maxFullAlpha = maxH / 2;
    for (let alpha = Math.ceil(minH); alpha <= Math.floor(maxFullAlpha); alpha += 1) {
      const angles = isSTBD ? [alpha, -2 * alpha, alpha] : [-alpha, 2 * alpha, -alpha];
      try {
        const legData = [
          interpolateData(alpha, tableSubset),
          interpolateData(2 * alpha, tableSubset),
          interpolateData(alpha, tableSubset)
        ];
        const res = calculateManeuverLocally(angles, legData, activeGuideSpeed);
        const err = Math.sqrt(Math.pow(res.lateral_separation - targetS, 2) + Math.pow(res.drop_distance - targetD, 2));
        candidates.push({
          type: ManeuverType.FULL,
          angleText: `Base Angle: ${alpha}°`,
          separation: res.lateral_separation,
          drop: res.drop_distance,
          error: err,
          time: res.total_time,
          baseAngle: alpha
        });
      } catch (e) {}
    }

    // 3. Evaluate DISTORTED FISHTAIL bounds
    for (let a1 = Math.ceil(minH); a1 <= Math.floor(maxH); a1 += 2) {
      for (let a2 = Math.ceil(minH); a2 <= Math.floor(maxH); a2 += 2) {
        const angles = isSTBD ? [a1, -(a1 + a2), a2] : [-a1, (a1 + a2), -a2];
        try {
          const legData = [
            interpolateData(a1, tableSubset),
            interpolateData(a1 + a2, tableSubset),
            interpolateData(a2, tableSubset)
          ];
          const res = calculateManeuverLocally(angles, legData, activeGuideSpeed);
          const err = Math.sqrt(Math.pow(res.lateral_separation - targetS, 2) + Math.pow(res.drop_distance - targetD, 2));
          candidates.push({
            type: ManeuverType.DISTORTED,
            angleText: `α: ${a1}°, β: ${a2}°`,
            separation: res.lateral_separation,
            drop: res.drop_distance,
            error: err,
            time: res.total_time,
            angle1: a1,
            angle2: a2
          });
        } catch (e) {}
      }
    }

    candidates.sort((a, b) => a.error - b.error);
    return candidates.slice(0, 4);
  }, [selectedTableKey, guideSpeed, initialSide, turningData, targetSep, targetDrop]);

  const tacticalAdvisory = useMemo(() => {
    const sep = Math.abs(parseFloat(targetSep) || 0);
    const drop = parseFloat(targetDrop) || 0;
    const dropMagnitude = Math.abs(drop);

    let suggestedType = '';
    let suggestedAngle = '';
    let description = '';

    if (dropMagnitude === 0 && sep === 0) {
      return {
        suggestedType: 'Station-Keeping Stable',
        suggestedAngle: '0° Heading Shift',
        description: 'Vessel aligns perfectly on requested spatial target station relative to guide. No maneuver needed.'
      };
    }

    if (dropMagnitude < 100 && sep < 100) {
      suggestedType = 'Half Fishtail (Micro-Shift)';
      suggestedAngle = '15° - 30°';
      description = `Minor relative offset correction detected (<100 yds). Execute a brief, shallow Half Fishtail to slide sideways securely into station without shedding excessive headway.`;
    } else if (sep < 120 && dropMagnitude > 220) {
      suggestedType = 'Full Fishtail (Symmetrical)';
      suggestedAngle = '45° - 60°';
      description = `Drop back coordinates are deep (${Math.round(dropMagnitude)} yds) while preserving columns (lateral translation is minor). A Symmetrical Full Fishtail is optimal: its outbound and inbound curves cancel out final drift, creating premium hydrodynamic drag to drop range without permanent column displacement.`;
    } else if (sep > 300 && dropMagnitude < 180) {
      suggestedType = 'Half Fishtail (Lane Translation)';
      suggestedAngle = '30° - 45°';
      description = `Large lateral lane separation required (${Math.round(sep)} yds) with minor dropback. A standard Half Fishtail at shallow angles (30° to 45°) provides the steady lateral velocity vector needed to slide across relative formation columns safely.`;
    } else if (sep >= 150 && dropMagnitude >= 150) {
      suggestedType = 'Distorted Fishtail (Asymmetrical)';
      if (dropMagnitude > sep * 1.5) {
        suggestedAngle = 'α: 55°-65° / β: 30°-45°';
        description = `Deep drop (${Math.round(dropMagnitude)} yds) paired with lane translation demands asymmetric leg sizes. Execute a heavy initial drag turn (α ~ 60°) to dump speed fast, followed by a lighter recovery turn (β ~ 35°) to capture the final station pocket.`;
      } else {
        suggestedAngle = 'α: 45°-50° / β: 40°-50°';
        description = `Substantial offset corrections required across both axes. An asymmetrical Distorted Fishtail leverages multiple degrees of freedom for custom lane entry. Load the solved recommendation below to inspect live pathways.`;
      }
    } else {
      suggestedType = 'Half Fishtail (Standard)';
      suggestedAngle = '40° - 50°';
      description = `A standard 45° Half Fishtail serves this relative shift optimally. It creates a smooth outbound translation while dropping back moderately.`;
    }

    return { suggestedType, suggestedAngle, description };
  }, [targetSep, targetDrop]);

  const handleApply = (rec: any) => {
    let baseAngle = '60';
    let distAngle1 = '60';
    let distAngle2 = '40';

    if (rec.type === ManeuverType.DISTORTED) {
      distAngle1 = rec.angle1.toString();
      distAngle2 = rec.angle2.toString();
    } else {
      baseAngle = rec.baseAngle.toString();
    }

    onApplySolution({
      type: rec.type,
      baseAngle,
      distAngle1,
      distAngle2,
      initialSide
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start animate-in fade-in duration-500 pb-12">
      {/* LEFT COLUMN: Solver Configuration Inputs */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass rounded-3xl p-6 md:p-8 border border-slate-800 bg-slate-950/40 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 rounded-2xl glow-rose text-white">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">BATTENBERG</h2>
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Calculate Intercept Parameters</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Table Selection */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">SHIP's TURNING DATA</label>
              <select 
                value={selectedTableKey}
                onChange={(e) => setSelectedTableKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
              >
                <option value="" disabled>-- Select Table --</option>
                {availableTables.map(t => (
                  <option key={`${t.speed}|${t.rudder}|${t.side}|${t.tableName}`} value={`${t.speed}|${t.rudder}|${t.side}|${t.tableName}`}>
                    {t.tableName} ({t.speed}kts)
                  </option>
                ))}
              </select>
            </div>

            {/* Guide Speed */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Guide Speed (kts)</label>
                <input 
                  type="number" 
                  value={guideSpeed} 
                  onChange={(e) => setGuideSpeed(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center" 
                />
              </div>

              {/* Initial Side */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Turn Side</label>
                <div className="grid grid-cols-2 h-[46px] bg-slate-900 rounded-xl border border-slate-800 p-1">
                  <button 
                    type="button" 
                    onClick={() => setInitialSide(SideOfTurn.STARBOARD)} 
                    className={`rounded-lg text-[9px] font-black uppercase transition-all ${initialSide === SideOfTurn.STARBOARD ? 'bg-slate-850 text-blue-400 border border-slate-700' : 'text-slate-500'}`}
                  >
                    STBD
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setInitialSide(SideOfTurn.PORT)} 
                    className={`rounded-lg text-[9px] font-black uppercase transition-all ${initialSide === SideOfTurn.PORT ? 'bg-slate-850 text-red-500 border border-slate-700' : 'text-slate-500'}`}
                  >
                    PORT
                  </button>
                </div>
              </div>
            </div>

            {/* Solver Input Mode */}
            <div className="space-y-1 pt-2 border-t border-slate-900">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Solver Entry Mode</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setSolverMode('direct')}
                  className={`py-2 rounded-lg text-[9.5px] font-black uppercase tracking-widest transition-all ${solverMode === 'direct' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Direct Yards
                </button>
                <button 
                  type="button" 
                  onClick={() => setSolverMode('station')}
                  className={`py-2 rounded-lg text-[9.5px] font-black uppercase tracking-widest transition-all ${solverMode === 'station' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  Stationing
                </button>
              </div>
            </div>

            {/* Entry Fields depending on solver mode */}
            {solverMode === 'station' ? (
              <div className="space-y-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/60 animate-in fade-in duration-200">
                {/* INITIAL STATION */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">1. Initial Station</span>
                    <span className="text-[8px] text-slate-500 uppercase font-bold">Starting position</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Preset Sector</label>
                      <select
                        value={initStationPreset}
                        onChange={(e) => setInitStationPreset(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 h-10 font-bold text-[10.5px] text-slate-300 outline-none"
                      >
                        {STATION_PRESETS.map((p, idx) => (
                          <option key={idx} value={idx}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Range (Yds)</label>
                      <input
                        type="number"
                        value={initStationRange}
                        onChange={(e) => setInitStationRange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg h-10 font-bold text-xs text-white focus:outline-none focus:border-rose-500 text-center"
                        min="0"
                      />
                    </div>
                  </div>

                  {STATION_PRESETS[initStationPreset].bearing === -1 && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Custom Bearing (000° - 359°)</label>
                      <input
                        type="number"
                        value={initStationBearing}
                        onChange={(e) => setInitStationBearing(e.target.value)}
                        className="w-full h-10 bg-slate-950 border border-slate-850 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-rose-500"
                        min="0"
                        max="359"
                        placeholder="e.g. 045"
                      />
                    </div>
                  )}
                </div>

                {/* TARGET STATION */}
                <div className="space-y-3 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">2. Target Station</span>
                    <span className="text-[8px] text-slate-500 uppercase font-bold">New relative assignment</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Preset Sector</label>
                      <select
                        value={targetStationPreset}
                        onChange={(e) => setTargetStationPreset(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 h-10 font-bold text-[10.5px] text-slate-300 outline-none"
                      >
                        {STATION_PRESETS.map((p, idx) => (
                          <option key={idx} value={idx}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Range (Yds)</label>
                      <input
                        type="number"
                        value={targetStationRange}
                        onChange={(e) => setTargetStationRange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg h-10 font-bold text-xs text-white focus:outline-none focus:border-rose-500 text-center"
                        min="0"
                      />
                    </div>
                  </div>

                  {STATION_PRESETS[targetStationPreset].bearing === -1 && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                      <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Custom Bearing (000° - 359°)</label>
                      <input
                        type="number"
                        value={targetStationBearing}
                        onChange={(e) => setTargetStationBearing(e.target.value)}
                        className="w-full h-10 bg-slate-950 border border-slate-850 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-rose-500"
                        min="0"
                        max="359"
                        placeholder="e.g. 090"
                      />
                    </div>
                  )}
                </div>

                {/* COMPUTED TRANSLATION SUMMARY */}
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-850 space-y-1 text-center font-mono">
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Station Delta Calculation</span>
                  <div className="grid grid-cols-2 divide-x divide-slate-800 py-1">
                    <div>
                      <span className="block text-[7px] text-slate-600 font-bold uppercase">Lat. Separation</span>
                      <span className="text-xs font-black text-blue-400">{targetSep}y</span>
                    </div>
                    <div>
                      <span className="block text-[7px] text-slate-600 font-bold uppercase">Drop Distance</span>
                      <span className="text-xs font-black text-indigo-400">{targetDrop}y</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/60 animate-in fade-in duration-250">
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Lat. Sep (yds)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={targetSep} 
                    onChange={(e) => setTargetSep(e.target.value)} 
                    className="w-full h-12 bg-slate-950 border border-slate-850 rounded-xl px-3 font-semibold text-xs text-white placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 text-center" 
                    placeholder="e.g. 400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Drop (yds)</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={targetDrop} 
                    onChange={(e) => setTargetDrop(e.target.value)} 
                    className="w-full h-12 bg-slate-950 border border-slate-850 rounded-xl px-3 font-semibold text-xs text-white placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 text-center" 
                    placeholder="e.g. -100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Solver Solutions and Advisory Panel */}
      <div className="lg:col-span-7 space-y-6">
        {/* TACTICAL ADVISORY */}
        <div className="glass rounded-3xl p-6 md:p-8 border border-blue-500/20 bg-slate-950/20 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <Compass className="w-5 h-5 text-blue-400" style={{ animation: 'spin 14s linear infinite' }} />
            </div>
            <div>
              <span className="block text-[11px] font-black text-blue-400 uppercase tracking-widest leading-none">My Recommendations</span>
              <span className="block text-[8px] text-slate-500 uppercase font-black tracking-wider mt-0.5">Fishtail maneuvering heuristic bounds</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 mb-4">
            <div className="space-y-0.5">
              <span className="block text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Suggested Maneuver</span>
              <span className="text-xs md:text-sm font-black text-white uppercase flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                {tacticalAdvisory.suggestedType}
              </span>
            </div>
            <div className="space-y-0.5 border-l border-slate-800 pl-4">
              <span className="block text-[7.5px] text-slate-500 font-bold uppercase tracking-wider">Suggested Rudder / α Angle</span>
              <span className="text-xs md:text-sm font-mono font-black text-amber-400">
                {tacticalAdvisory.suggestedAngle}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
            {tacticalAdvisory.description}
          </p>
        </div>

        {/* RESULTS SOLUTIONS */}
        <div className="glass rounded-3xl p-6 md:p-8 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                <CheckCircle className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-black uppercase text-slate-200 tracking-wider">CORRELATED TURN PLOTS</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">
              {recommendations.length} SOLUTIONS FOUND
            </span>
          </div>

          {!selectedTableKey ? (
            <div className="p-6 md:p-10 bg-amber-500/5 border border-dashed border-amber-500/20 text-amber-500 text-xs font-black rounded-2xl text-center uppercase tracking-wider flex flex-col items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
              <span>Please select SHIP's TURNING DATA on the left panel to correlate parameters.</span>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="p-6 md:p-10 bg-red-500/5 border border-dashed border-red-500/20 text-red-500 text-xs font-black rounded-2xl text-center uppercase tracking-wider flex flex-col items-center gap-3">
              ❌ No exact mathematical correlation possible. 
              <span className="block text-[10px] text-slate-500 font-medium normal-case">Try adjusting the Guide Speed or Target coordinates.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => {
                const isBest = idx === 0;
                const errYards = Math.round(rec.error);
                const name = rec.type === ManeuverType.HALF ? 'Half Fishtail' : (rec.type === ManeuverType.FULL ? 'Full Fishtail' : 'Distorted Fishtail');
                return (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${isBest ? 'bg-slate-900/40 border-rose-500/40 shadow-lg' : 'bg-slate-950/20 border-slate-900 hover:border-slate-800'}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${isBest ? 'bg-rose-600 text-white shadow shadow-rose-600/10' : 'bg-slate-800 text-slate-400'}`}>
                          {isBest ? 'RECOMMENDED' : `RANK #${idx + 1}`}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 font-mono tracking-widest uppercase">
                          ±{errYards} YD DEV
                        </span>
                      </div>

                      <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider leading-none mt-1">
                        {name}
                      </h4>
                      <p className="text-md font-black text-blue-400 uppercase tracking-tight mt-1.5 font-mono">
                        {rec.angleText}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-slate-900 pt-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3 font-mono">
                        <div>
                          <span className="block text-[7.5px] text-slate-600 font-bold uppercase leading-none">SEPARATION</span>
                          <span className="text-[10px] font-extrabold text-slate-400">{Math.round(rec.separation)}y</span>
                        </div>
                        <div className="border-l border-slate-800 pl-3">
                          <span className="block text-[7.5px] text-slate-600 font-bold uppercase leading-none">DROP</span>
                          <span className="text-[10px] font-extrabold text-slate-400">{Math.round(rec.drop)}y</span>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleApply(rec)}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3.5 py-1.5 rounded-xl text-[9px] uppercase tracking-widest transition-all shadow-md shadow-rose-600/10 flex items-center gap-1 active:scale-95"
                      >
                        Load <ArrowRight className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TargetMatchSolver;
