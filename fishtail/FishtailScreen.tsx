import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ArrowLeft, BarChart3, Info, Settings, Target, Upload, CheckCircle2 } from 'lucide-react';
import { ManeuverType, SideOfTurn, CalculationResult, STATION_PRESETS } from './types';
import { interpolateData } from './utils/interpolation';
import { calculateManeuverLocally } from './utils/maneuverEngine';
import ManeuverForm from './components/ManeuverForm';
import ManeuverVisualizer, { ManeuverVisualizerHandle } from './components/ManeuverVisualizer';
import TargetMatchSolver from './components/TargetMatchSolver';
import TurningImport, { ImportMessage } from '../components/TurningImport';
import { shipToFishtailRows } from './shipBridge';
import { fishtailFields } from '../data/fishtails';
import { saveFile } from '../services/backup';
import { Ship, SimpleRecord, TurningDataSet } from '../types';
import './fishtail.css';

interface Props {
  ship: Ship | undefined;
  ships: Ship[];
  onSelectShip: (id: string) => void;
  onBack: () => void;
  onSaveRecord: (shipId: string, record: SimpleRecord) => void;
  onImportSets: (shipId: string, sets: TurningDataSet[]) => void;
  onEditTurningData: () => void;
}

const TYPE_LABEL: Record<ManeuverType, string> = {
  [ManeuverType.HALF]: 'Half fishtail',
  [ManeuverType.FULL]: 'Full fishtail',
  [ManeuverType.DISTORTED]: 'Distorted fishtail',
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * Fishtail calculator as a normal app screen. The vessel's own turning data is the only data source:
 * nothing is stored separately, so it follows the vessel through backups and exports.
 */
const FishtailScreen: React.FC<Props> = ({ ship, ships, onSelectShip, onBack, onSaveRecord, onImportSets, onEditTurningData }) => {
  const [activeTab, setActiveTab] = useState<'calc' | 'solver'>('calc');
  const turningData = useMemo(() => (ship ? shipToFishtailRows(ship) : []), [ship]);

  // Controlled parameter states
  const [type, setType] = useState<ManeuverType>(ManeuverType.HALF);
  const [baseAngle, setBaseAngle] = useState('60');
  const [distAngle1, setDistAngle1] = useState('60');
  const [distAngle2, setDistAngle2] = useState('40');
  const [guideSpeed, setGuideSpeed] = useState('12');
  const [initialSide, setInitialSide] = useState<SideOfTurn>(SideOfTurn.STARBOARD);
  const [selectedTableKey, setSelectedTableKey] = useState('');
  const [useOffsets, setUseOffsets] = useState(false);
  const [offAdv, setOffAdv] = useState('0');
  const [offTrans, setOffTrans] = useState('0');

  // Solver states
  const [targetSep, setTargetSep] = useState('400');
  const [targetDrop, setTargetDrop] = useState('-100');
  const [solverMode, setSolverMode] = useState<'direct' | 'station'>('direct');
  const [initStationPreset, setInitStationPreset] = useState(0);
  const [initStationBearing, setInitStationBearing] = useState('0');
  const [initStationRange, setInitStationRange] = useState('1000');
  const [targetStationPreset, setTargetStationPreset] = useState(2);
  const [targetStationBearing, setTargetStationBearing] = useState('90');
  const [targetStationRange, setTargetStationRange] = useState('1000');

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [lastParams, setLastParams] = useState<any>(null);
  const [stationSolver, setStationSolver] = useState<any>(null);
  const [yardScale, setYardScale] = useState(1000);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const visualizerRef = useRef<ManeuverVisualizerHandle>(null);

  // Keep a valid table selected, and drop a stale plot when the vessel changes.
  useEffect(() => {
    const keyOf = (d: (typeof turningData)[number]) => `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
    if (turningData.length && !turningData.some(d => keyOf(d) === selectedTableKey)) setSelectedTableKey(keyOf(turningData[0]));
    if (!turningData.length) setSelectedTableKey('');
  }, [turningData, selectedTableKey]);
  useEffect(() => { setResult(null); setLastParams(null); setStationSolver(null); }, [ship?.id]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const handleCalculation = useCallback((params: {
    type: ManeuverType;
    angles: number[];
    guideSpeed: number;
    tableId: { speed: number; rudder: string; side: SideOfTurn; tableName: string };
    offsets?: { advance: number; transfer: number };
  }) => {
    const tableSubset = turningData.filter(d =>
      d.ownSpeed === params.tableId.speed && d.rudder === params.tableId.rudder &&
      d.side === params.tableId.side && d.tableName === params.tableId.tableName);
    if (tableSubset.length === 0) { setError('Please select a turning table first.'); return; }
    setLastParams(params);

    try {
      const legData = params.angles.map((angle, idx) => {
        let lookupAngle = angle;
        if (params.type === ManeuverType.DISTORTED) {
          // Distorted fishtail: step 1 uses alpha, step 2 the sum alpha + beta, step 3 beta
          const alpha = Math.abs(params.angles[0]);
          const beta = Math.abs(params.angles[2]);
          lookupAngle = idx === 1 ? alpha + beta : idx === 2 ? beta : alpha;
        }
        const interpolated = interpolateData(lookupAngle, tableSubset);
        return params.offsets
          ? { ...interpolated, advance: interpolated.advance + params.offsets.advance, transfer: interpolated.transfer + params.offsets.transfer }
          : interpolated;
      });
      const calcResult = calculateManeuverLocally(params.angles, legData, params.guideSpeed);

      let stationSolverData = null;
      if (solverMode === 'station') {
        const bearingOf = (preset: number, custom: string) => STATION_PRESETS[preset].bearing === -1 ? parseFloat(custom) || 0 : STATION_PRESETS[preset].bearing;
        const b1 = bearingOf(initStationPreset, initStationBearing), r1 = parseFloat(initStationRange) || 0;
        const b2 = bearingOf(targetStationPreset, targetStationBearing), r2 = parseFloat(targetStationRange) || 0;
        const pos = (b: number, r: number) => ({ x: r * Math.sin((b * Math.PI) / 180), y: r * Math.cos((b * Math.PI) / 180) });
        stationSolverData = {
          enabled: true,
          initialStation: { ...pos(b1, r1), name: STATION_PRESETS[initStationPreset].name, bearing: b1, range: r1 },
          targetStation: { ...pos(b2, r2), name: STATION_PRESETS[targetStationPreset].name, bearing: b2, range: r2 },
        };
      }
      setResult(calcResult);
      setStationSolver(stationSolverData);
      setError(null);
    } catch (err) {
      console.error('Calculation Error:', err);
      setError('Calculation error: check the parameters.');
    }
  }, [turningData, solverMode, initStationPreset, initStationBearing, initStationRange, targetStationPreset, targetStationBearing, targetStationRange]);

  /** Saves the current plot's outcome on the vessel as a Fishtails record. */
  const handleSaveRecord = () => {
    if (!ship || !result || !lastParams) return;
    const angles = (lastParams.angles as number[]).map(a => `${Math.abs(Math.round(a))}°`).join(' / ');
    const record: SimpleRecord = {
      id: Math.random().toString(36).slice(2, 11),
      date: new Date().toISOString().slice(0, 10),
      description: `Calculated ${TYPE_LABEL[lastParams.type as ManeuverType].toLowerCase()} (${lastParams.tableId.speed} kn, ${lastParams.tableId.rudder}° wheel, ${lastParams.tableId.side})`,
      fields: fishtailFields({
        kind: TYPE_LABEL[lastParams.type as ManeuverType].split(' ')[0], angles: lastParams.angles, speed: lastParams.tableId.speed, wheel: String(lastParams.tableId.rudder),
        lateral: result.lateral_separation, drop: result.drop_distance, finalX: result.final_position.x,
      }),
      value: `${TYPE_LABEL[lastParams.type as ManeuverType]} ${angles} · guide ${lastParams.guideSpeed} kn · drop ${Math.round(result.drop_distance)} yd, lateral ${Math.round(result.lateral_separation)} yd`,
    };
    onSaveRecord(ship.id, record);
    setNotice(`Saved to ${ship.name}'s Fishtails records`);
  };

  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    if (type === 'in') setYardScale(prev => Math.max(50, prev - 50));
    if (type === 'out') setYardScale(prev => Math.min(10000, prev + 50));
    if (type === 'reset') setYardScale(1000);
  };

  const handleExport = async (format: 'svg' | 'jpg') => {
    const svg = visualizerRef.current?.getSvg();
    if (!svg || exporting) return;
    setExporting(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const day = new Date().toISOString().slice(0, 10);
      const fileName = `Fishtail_Plot_${day}.${format}`;
      if (format === 'svg') {
        await saveFile(fileName, { text: svgData }, 'image/svg+xml', 'Fishtail plot');
      } else {
        const blob = await new Promise<Blob>((resolve, reject) => {
          const canvas = document.createElement('canvas');
          canvas.width = 1600; canvas.height = 1600;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not available'));
          const img = new Image();
          const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
          img.onload = () => {
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 1600, 1600); ctx.drawImage(img, 0, 0, 1600, 1600);
            URL.revokeObjectURL(url);
            canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/jpeg', 0.95);
          };
          img.onerror = () => reject(new Error('Could not render the plot'));
          img.src = url;
        });
        await saveFile(fileName, { base64: await blobToBase64(blob) }, 'image/jpeg', 'Fishtail plot');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) setError(`Export failed: ${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const showImportMessage = (m: ImportMessage) => { if (m.kind === 'ok') { setNotice(m.text); setError(null); } else setError(m.text); };

  // ---- layout: app-style header, dark instrument panel for the plot and controls ----
  const tabBtn = (id: 'calc' | 'solver', label: string, icon: React.ReactNode) => (
    <button onClick={() => setActiveTab(id)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${activeTab === id ? 'bg-blue-600 text-white shadow' : 'text-slate-500'}`}>
      {icon}{label}
    </button>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="shrink-0 bg-white/80 backdrop-blur-md z-10 px-4 py-3 border-b border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={22} className="text-slate-700" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Fishtail Calculator</h1>
            <select value={ship?.id ?? ''} onChange={e => onSelectShip(e.target.value)} aria-label="Vessel" className="mt-0.5 max-w-full bg-transparent text-xs font-bold text-slate-400 uppercase tracking-wider outline-none">
              {!ship && <option value="">Choose a vessel</option>}
              {ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {ship && (
            <TurningImport ship={ship} onImport={onImportSets} onMessage={showImportMessage} className="block p-2 text-blue-600 bg-blue-50 rounded-lg cursor-pointer active:scale-95 transition-all" title="Import turning data from Excel, CSV, Word or JSON">
              <Upload size={20} aria-label="Import turning data" />
            </TurningImport>
          )}
          <button onClick={onEditTurningData} disabled={!ship} aria-label="Edit turning data" title="Edit turning data" className="p-2 text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40"><Settings size={20} /></button>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {tabBtn('calc', 'Calculator', <Settings size={14} />)}
          {tabBtn('solver', 'Battenberg', <Target size={14} />)}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 touch-pan-y">
        <div className="max-w-7xl mx-auto space-y-4">
          {notice && <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-600 rounded-2xl text-xs font-bold"><CheckCircle2 size={16} /> {notice}</div>}
          {error && (
            <div className="flex items-center justify-between gap-3 p-3 bg-yellow-50 border border-yellow-100 text-red-500 rounded-2xl text-xs font-bold">
              <span className="flex items-center gap-2"><Info size={16} /> {error}</span>
              <button onClick={() => setError(null)} className="uppercase text-[10px] p-1">Dismiss</button>
            </div>
          )}

          {!ship ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-100 text-center text-sm text-slate-500 font-medium">Add or choose a vessel to use the calculator.</div>
          ) : turningData.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-100 text-center space-y-4">
              <BarChart3 size={36} className="mx-auto text-slate-300" />
              <div>
                <h2 className="font-bold text-slate-800">No turning data for {ship.name} yet</h2>
                <p className="text-sm text-slate-500 mt-1">The calculator works from the vessel's own turning data. Enter it by hand, or import an Excel, CSV, Word or JSON file.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={onEditTurningData} className="px-5 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg active:scale-95 transition-all">Enter turning data</button>
                <TurningImport ship={ship} onImport={onImportSets} onMessage={showImportMessage} className="block px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold cursor-pointer active:scale-95 transition-all">Import a file</TurningImport>
              </div>
            </div>
          ) : (
            <div className="original-palette rounded-3xl bg-slate-950 text-slate-50 p-4 md:p-6 shadow-sm">
              {activeTab === 'calc' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
                  <div className="lg:col-span-4 order-2 lg:order-1">
                    <ManeuverForm
                      onSubmit={handleCalculation} onExport={handleExport} onZoom={handleZoom} onSaveAsTable={handleSaveRecord}
                      loading={exporting} turningData={turningData} hasResult={!!result} yardScale={yardScale}
                      type={type} setType={setType} baseAngle={baseAngle} setBaseAngle={setBaseAngle}
                      distAngle1={distAngle1} setDistAngle1={setDistAngle1} distAngle2={distAngle2} setDistAngle2={setDistAngle2}
                      guideSpeed={guideSpeed} setGuideSpeed={setGuideSpeed} initialSide={initialSide} setInitialSide={setInitialSide}
                      selectedTableKey={selectedTableKey} setSelectedTableKey={setSelectedTableKey}
                      useOffsets={useOffsets} setUseOffsets={setUseOffsets} offAdv={offAdv} setOffAdv={setOffAdv} offTrans={offTrans} setOffTrans={setOffTrans}
                    />
                  </div>
                  <div className="lg:col-span-8 order-1 lg:order-2">
                    {result ? (
                      <ManeuverVisualizer ref={visualizerRef} result={result} yardScale={yardScale} onSetScale={setYardScale} onExport={handleExport} onSaveAsTable={handleSaveRecord} stationSolver={stationSolver} />
                    ) : (
                      <div className="rounded-3xl border-2 border-dashed border-slate-800 py-20 md:py-32 flex flex-col items-center justify-center text-center px-6">
                        <BarChart3 className="w-12 h-12 md:w-16 md:h-16 text-slate-800 mb-6" />
                        <h3 className="text-lg md:text-xl font-black text-slate-700 uppercase">Tactical plot</h3>
                        <p className="text-slate-600 max-w-sm mt-2 text-xs md:text-sm leading-relaxed uppercase font-bold tracking-tight">Set the parameters and calculate to see the fishtail geometry.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <TargetMatchSolver
                  turningData={turningData} selectedTableKey={selectedTableKey} setSelectedTableKey={setSelectedTableKey}
                  guideSpeed={guideSpeed} setGuideSpeed={setGuideSpeed} initialSide={initialSide} setInitialSide={setInitialSide}
                  targetSep={targetSep} setTargetSep={setTargetSep} targetDrop={targetDrop} setTargetDrop={setTargetDrop}
                  solverMode={solverMode} setSolverMode={setSolverMode}
                  initStationPreset={initStationPreset} setInitStationPreset={setInitStationPreset}
                  initStationBearing={initStationBearing} setInitStationBearing={setInitStationBearing}
                  initStationRange={initStationRange} setInitStationRange={setInitStationRange}
                  targetStationPreset={targetStationPreset} setTargetStationPreset={setTargetStationPreset}
                  targetStationBearing={targetStationBearing} setTargetStationBearing={setTargetStationBearing}
                  targetStationRange={targetStationRange} setTargetStationRange={setTargetStationRange}
                  onApplySolution={solution => {
                    setType(solution.type); setBaseAngle(solution.baseAngle); setDistAngle1(solution.distAngle1);
                    setDistAngle2(solution.distAngle2); setInitialSide(solution.initialSide); setActiveTab('calc');
                  }}
                />
              )}
            </div>
          )}
        </div>
      </main>

    </div>
  );
};

export default FishtailScreen;
