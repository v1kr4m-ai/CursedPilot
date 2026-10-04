
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Compass, 
  Database, 
  Settings, 
  Info,
  Upload,
  BarChart3,
  FileSpreadsheet,
  Plus,
  ArrowLeft,
  X,
  Download,
  Target
} from 'lucide-react';
import { 
  ManeuverType, 
  SideOfTurn, 
  TurningDataPoint, 
  CalculationResult,
  STATION_PRESETS
} from './types';
import { interpolateData } from './utils/interpolation';
import { calculateManeuverLocally } from './utils/maneuverEngine';

// Components
import WelcomeScreen from './components/WelcomeScreen';
import ManeuverForm from './components/ManeuverForm';
import ManeuverVisualizer, { ManeuverVisualizerHandle } from './components/ManeuverVisualizer';
import TurningDataTable from './components/TurningDataTable';
import ManualEntryModal from './components/ManualEntryModal';
import ImportMetadataModal from './components/ImportMetadataModal';
import SaveConfirmModal from './components/SaveConfirmModal';
import TargetMatchSolver from './components/TargetMatchSolver';
import * as XLSX from 'xlsx';
import './fishtail.css';

interface AppProps {
  isModule?: boolean;
  initialTab?: 'calc' | 'data';
  onExit?: () => void;
}

const App: React.FC<AppProps> = ({ isModule = false, initialTab = 'calc', onExit }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeTab, setActiveTab] = useState<'calc' | 'solver' | 'data'>(initialTab);
  const [turningData, setTurningData] = useState<TurningDataPoint[]>([]);

  // Controlled Parameter States
  const [type, setType] = useState<ManeuverType>(ManeuverType.HALF);
  const [baseAngle, setBaseAngle] = useState<string>('60');
  const [distAngle1, setDistAngle1] = useState<string>('60');
  const [distAngle2, setDistAngle2] = useState<string>('40');
  const [guideSpeed, setGuideSpeed] = useState<string>('12');
  const [initialSide, setInitialSide] = useState<SideOfTurn>(SideOfTurn.STARBOARD);
  const [selectedTableKey, setSelectedTableKey] = useState<string>('');

  // Offsets States
  const [useOffsets, setUseOffsets] = useState<boolean>(false);
  const [offAdv, setOffAdv] = useState<string>('0');
  const [offTrans, setOffTrans] = useState<string>('0');

  // Solver-specific States
  const [targetSep, setTargetSep] = useState<string>('400');
  const [targetDrop, setTargetDrop] = useState<string>('-100');
  const [solverMode, setSolverMode] = useState<'direct' | 'station'>('direct');
  const [initStationPreset, setInitStationPreset] = useState<number>(0);
  const [initStationBearing, setInitStationBearing] = useState<string>('0');
  const [initStationRange, setInitStationRange] = useState<string>('1000');
  const [targetStationPreset, setTargetStationPreset] = useState<number>(2);
  const [targetStationBearing, setTargetStationBearing] = useState<string>('90');
  const [targetStationRange, setTargetStationRange] = useState<string>('1000');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveConfirmDefaults, setSaveConfirmDefaults] = useState<{ tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn } | null>(null);
  const [pendingFileRows, setPendingFileRows] = useState<any[] | null>(null);
  const [yardScale, setYardScale] = useState(1000); 
  const [mobileExportUrl, setMobileExportUrl] = useState<string | null>(null);
  
  // Dynamic Export and Fallback dialog states
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exportModalContent, setExportModalContent] = useState<{
    text: string;
    fileName: string;
    type: 'json' | 'csv';
  } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const visualizerRef = useRef<ManeuverVisualizerHandle>(null);
  const [lastParams, setLastParams] = useState<any>(null);
  const [stationSolver, setStationSolver] = useState<any>(null);

  // Handle Hardware Back Button for Android APK
  useEffect(() => {
    const handleBackButton = () => {
      if (mobileExportUrl) {
        setMobileExportUrl(null);
      } else if (showManualEntry) {
        setShowManualEntry(false);
      } else if (pendingFileRows) {
        setPendingFileRows(null);
      } else if (activeTab === 'data') {
        setActiveTab('calc');
      }
    };

    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [activeTab, showManualEntry, pendingFileRows, mobileExportUrl]);

  useEffect(() => {
    const saved = localStorage.getItem('fishtail_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTurningData(parsed);
      } catch (e) {
        console.error("Failed to load local data");
      }
    }
  }, []);

  useEffect(() => {
    if (turningData.length > 0 && !selectedTableKey) {
      const d = turningData[0];
      setSelectedTableKey(`${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`);
    }
  }, [turningData, selectedTableKey]);

  const saveTurningData = (data: TurningDataPoint[]) => {
    setTurningData(data);
    localStorage.setItem('fishtail_db', JSON.stringify(data));
  };

  const exportDatabaseBackupJSON = () => {
    try {
      const jsonStr = JSON.stringify(turningData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const dateString = new Date().toISOString().slice(0, 10);
      const fileName = `TacticalLibrary_Backup_${dateString}.json`;

      triggerUnifiedDownload(blob, jsonStr, fileName);
    } catch (err: any) {
      setError(`JSON Backup failed: ${err.message}`);
    }
  };

  const exportDatabaseBackupCSV = () => {
    try {
      if (turningData.length === 0) {
        throw new Error("No tactical performance tables in memory to export.");
      }

      // Flat map to simple linear spreadsheet columns
      const exportRows = turningData.map(p => ({
        'Table Name': p.tableName || 'Unnamed Table',
        'Own Speed (kts)': p.ownSpeed,
        'Rudder Angle (deg)': p.rudder,
        'Side of Turn': p.side.toUpperCase(),
        'Heading (deg)': p.heading,
        'Advance (yds)': p.advance,
        'Transfer (yds)': p.transfer,
        'Time (sec)': p.time
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const dateString = new Date().toISOString().slice(0, 10);
      const fileName = `TacticalLibrary_Backup_${dateString}.csv`;

      triggerUnifiedDownload(blob, csv, fileName);
    } catch (err: any) {
      setError(`CSV Export failed: ${err.message}`);
    }
  };

  const triggerUnifiedDownload = (blob: Blob, rawText: string, fileName: string) => {
    try {
      // 1. Try modern Base64 data URL which bypasses complex iframe sandboxing
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64data = reader.result;
          if (typeof base64data === 'string') {
            const link = document.createElement('a');
            link.href = base64data;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } catch (downloadErr) {
          console.warn("Base64 downloader failed/blocked", downloadErr);
        }
      };
      reader.readAsDataURL(blob);

      // 2. Load into modal so they have instantaneous copy-paste capability if browser restricts iframe downloads
      setExportModalContent({
        text: rawText,
        fileName,
        type: fileName.endsWith('.csv') ? 'csv' : 'json'
      });
      setCopied(false);
    } catch (err: any) {
      console.error("Unified downloader failed", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const isValid = parsed.every(p => p.heading !== undefined && p.advance !== undefined);
            if (isValid) {
              const transformed = parsed.map(p => ({
                id: p.id || crypto.randomUUID(),
                heading: Number(p.heading ?? 0),
                advance: Number(p.advance ?? 0),
                transfer: Number(p.transfer ?? 0),
                time: Number(p.time ?? 0),
                tableName: p.tableName || "Imported Table",
                ownSpeed: Number(p.ownSpeed ?? 15),
                rudder: String(p.rudder ?? '20'),
                side: p.side || SideOfTurn.STARBOARD
              }));
              saveTurningData([...turningData, ...transformed]);
              setError(null);
            } else {
              throw new Error("Invalid backup file structure.");
            }
          } else {
            throw new Error("Backup file must contain a JSON array of points.");
          }
        } catch (err: any) {
          setError(`Import Error: ${err.message}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        if (!json || json.length === 0) throw new Error("Excel sheet is empty.");

        // Check if this sheet is a backup file containing Table Metadata in each row
        const firstRow = json[0];
        const rowKeys = Object.keys(firstRow || {}).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const hasMetadata = rowKeys.includes('tablename') || rowKeys.includes('ownspeed') || rowKeys.includes('ownspeedkts') || rowKeys.includes('sideofturn');

        if (hasMetadata) {
          // Robust direct parsing since the metadata is embedded inside each row
          const findStrInRow = (r: any, keys: string[]) => {
            const keysObj = Object.keys(r);
            const cleanSearch = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const matchKey = keysObj.find(rk => {
              const cleanK = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanSearch.includes(cleanK);
            });
            return matchKey ? String(r[matchKey]) : '';
          };

          const findValInRow = (r: any, keys: string[]) => {
            const keysObj = Object.keys(r);
            const cleanSearch = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const matchKey = keysObj.find(rk => {
              const cleanK = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanSearch.includes(cleanK);
            });
            return matchKey ? parseFloat(r[matchKey]) : 0;
          };

          const formatted: TurningDataPoint[] = json.map((row: any) => {
            const rawSide = findStrInRow(row, ['Side of Turn', 'Side', 'Direction', 'SideofTurn']).toLowerCase();
            let sideVal = SideOfTurn.STARBOARD;
            if (rawSide.includes('port') || rawSide === 'p') {
              sideVal = SideOfTurn.PORT;
            }
            const speedVal = findValInRow(row, ['Own Speed (kts)', 'Own Speed', 'Speed', 'Speedkts', 'OwnSpeed', 'OwnSpeedkts']);
            const rudderVal = findStrInRow(row, ['Rudder Angle (deg)', 'Rudder Angle', 'Rudder', 'Rudderdeg', 'RudderAngledeg']);
            
            let tblName = findStrInRow(row, ['Table Name', 'TableName', 'Name']);
            if (!tblName) {
              tblName = `${speedVal || 15}kts-${rudderVal || '20'}deg-${sideVal.toUpperCase()}`;
            }

            return {
              id: crypto.randomUUID(),
              heading: findValInRow(row, ['Heading (deg)', 'Heading', 'Degrees', 'Angle', 'Hdg', 'Headingdeg']),
              advance: findValInRow(row, ['Advance (yds)', 'Advance', 'Adv', 'YardsAdv', 'YardsAdvance', 'Advyds', 'Advanceyds']),
              transfer: findValInRow(row, ['Transfer (yds)', 'Transfer', 'Trans', 'YardsTrans', 'YardsTransfer', 'Transyds', 'Transferyds']),
              time: findValInRow(row, ['Time (sec)', 'Time', 'Sec', 'Seconds', 'T', 'Timesec']),
              tableName: tblName,
              ownSpeed: speedVal || 15,
              rudder: rudderVal || '20',
              side: sideVal
            };
          });

          saveTurningData([...turningData, ...formatted]);
          setError(null);
        } else {
          // Flat points matrix file, trigger Metadata Mapping Dialog
          setPendingFileRows(json);
          setError(null);
        }
      } catch (err: any) {
        setError(`Import Error: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const processPendingImport = (metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }) => {
    if (!pendingFileRows) return;

    const findVal = (row: any, keys: string[]) => {
      const rowKeys = Object.keys(row);
      const cleanKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const match = rowKeys.find(rk => {
        const cleanK = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanKeys.includes(cleanK);
      });
      return match ? parseFloat(row[match]) : 0;
    };

    const formatted: TurningDataPoint[] = pendingFileRows.map((row: any) => ({
      id: crypto.randomUUID(),
      heading: findVal(row, ['Heading (deg)', 'Heading', 'Degrees', 'Angle', 'Hdg', 'Headingdeg']),
      advance: findVal(row, ['Advance (yds)', 'Advance', 'Adv', 'YardsAdv', 'YardsAdvance', 'Advyds', 'Advanceyds']),
      transfer: findVal(row, ['Transfer (yds)', 'Transfer', 'Trans', 'YardsTrans', 'YardsTransfer', 'Transyds', 'Transferyds']),
      time: findVal(row, ['Time (sec)', 'Time', 'Sec', 'Seconds', 'T', 'Timesec']),
      ...metadata
    }));

    saveTurningData([...turningData, ...formatted]);
    setPendingFileRows(null);
  };

  const handleCalculation = useCallback((params: {
    type: ManeuverType;
    angles: number[];
    guideSpeed: number;
    tableId: { speed: number; rudder: string; side: SideOfTurn; tableName: string };
    offsets?: { advance: number; transfer: number };
  }) => {
    const tableSubset = turningData.filter(d => 
      d.ownSpeed === params.tableId.speed && 
      d.rudder === params.tableId.rudder && 
      d.side === params.tableId.side &&
      d.tableName === params.tableId.tableName
    );

    if (tableSubset.length === 0) {
      setError("Please select a turning table first.");
      return;
    }

    setLastParams(params);

    try {
      const legData = params.angles.map((angle, idx) => {
        let lookupAngle = angle;
        if (params.type === ManeuverType.DISTORTED) {
          // Distorted Fishtail lookup: 
          // index 0 (Step 1): alpha (first angle)
          // index 1 (Step 2): alpha + beta (second turn is sum of first and last angles)
          // index 2 (Step 3): beta (last angle)
          const alpha = Math.abs(params.angles[0]);
          const beta = Math.abs(params.angles[2]);
          if (idx === 1) {
            lookupAngle = alpha + beta;
          } else if (idx === 2) {
            lookupAngle = beta;
          } else {
            lookupAngle = alpha;
          }
        }
        const interpolated = interpolateData(lookupAngle, tableSubset);
        if (params.offsets) {
          return { 
            ...interpolated, 
            advance: interpolated.advance + params.offsets.advance, 
            transfer: interpolated.transfer + params.offsets.transfer 
          };
        }
        return interpolated;
      });
      
      const calcResult = calculateManeuverLocally(
        params.angles,
        legData,
        params.guideSpeed
      );

      // Compute stationSolver info if in relative station mode and active
      let stationSolverData = null;
      if (solverMode === 'station') {
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
        const x1 = r1 * Math.sin(rad1);
        const y1 = r1 * Math.cos(rad1);
        const x2 = r2 * Math.sin(rad2);
        const y2 = r2 * Math.cos(rad2);

        stationSolverData = {
          enabled: true,
          initialStation: { x: x1, y: y1, name: STATION_PRESETS[initStationPreset].name, bearing: b1, range: r1 },
          targetStation: { x: x2, y: y2, name: STATION_PRESETS[targetStationPreset].name, bearing: b2, range: r2 }
        };
      }

      setResult(calcResult);
      setStationSolver(stationSolverData);
      setError(null);
    } catch (err: any) {
      console.error("Calculation Error:", err);
      setError("Calculation Engine Error: Check parameters.");
    }
  }, [
    turningData,
    solverMode,
    initStationPreset,
    initStationBearing,
    initStationRange,
    targetStationPreset,
    targetStationBearing,
    targetStationRange
  ]);

  const handleSaveAsTable = () => {
    if (!result || !lastParams) return;

    const defaultName = `${lastParams.tableId.speed}kts-${lastParams.tableId.rudder}deg-${lastParams.tableId.side.toUpperCase()}-PROFILE`;
    setSaveConfirmDefaults({
      tableName: defaultName,
      ownSpeed: lastParams.tableId.speed,
      rudder: lastParams.tableId.rudder,
      side: lastParams.tableId.side
    });
    setShowSaveConfirm(true);
  };

  const handleConfirmSaveTable = (metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }) => {
    if (!result || !lastParams) return;

    const newPoints: TurningDataPoint[] = result.track_points.slice(1).map((p, idx) => ({
      id: crypto.randomUUID(),
      tableName: metadata.tableName,
      heading: Math.abs(lastParams.angles[idx]),
      advance: p.advance,
      transfer: p.transfer,
      time: p.time,
      ownSpeed: metadata.ownSpeed,
      rudder: metadata.rudder,
      side: metadata.side
    }));

    saveTurningData([...turningData, ...newPoints]);
    setShowSaveConfirm(false);
    setSaveConfirmDefaults(null);
    setActiveTab('data');
  };

  const handleUpdateTable = (oldKey: string, metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }, points: TurningDataPoint[]) => {
    const filtered = turningData.filter(d => {
      const key = `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
      return key !== oldKey;
    });

    const updatedPoints = points.map(p => ({
      ...p,
      ...metadata
    }));

    saveTurningData([...filtered, ...updatedPoints]);
  };

  const handleDeleteTable = (key: string) => {
    const filtered = turningData.filter(d => {
      const dKey = `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
      return dKey !== key;
    });
    saveTurningData(filtered);
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
    const svgData = new XMLSerializer().serializeToString(svg);
    const dateString = new Date().toISOString().slice(0, 10);
    const fileName = `Fishtail_Plot_${dateString}.${format}`;
    const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/jpeg';

    try {
      let blob: Blob;

      if (format === 'svg') {
        blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        blob = await new Promise<Blob>((resolve, reject) => {
          const img = new Image();
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, 1600, 1600);
            ctx.drawImage(img, 0, 0, 1600, 1600);
            URL.revokeObjectURL(url);
            canvas.toBlob((b) => b ? resolve(b) : reject('Canvas fail'), 'image/jpeg', 0.95);
          };
          img.onerror = reject;
          img.src = url;
        });
      }

      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Fishtail Tactical Plot',
          text: `Tactical report generated ${dateString}`
        });
      } else {
        const url = URL.createObjectURL(blob);
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          setMobileExportUrl(url);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 500);
        }
      }
    } catch (err: any) {
      console.error("Export Error:", err);
      setError("Export failed: Use 'Long Press' if share sheet didn't open.");
    } finally {
      setExporting(false);
    }
  };

  const handleAddDataPoint = (point: TurningDataPoint) => {
    saveTurningData([...turningData, point]);
    setShowManualEntry(false);
  };

  if (showWelcome && !isModule) return <WelcomeScreen onStart={() => setShowWelcome(false)} />;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-50 select-none overflow-hidden">
      <header className="glass shrink-0 z-50 border-b border-slate-800 px-4 md:px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 md:gap-3">
          {isModule && onExit && (
            <button onClick={onExit} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 active:scale-90 transition-transform">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-1.5 md:p-2 bg-blue-600 rounded-lg glow-blue">
            <Compass className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg md:text-xl tracking-tight uppercase">FISHTAIL</h1>
            <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-blue-400 font-black">a Cursed Pirate initiave</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 mx-2">
          <button onClick={() => setActiveTab('calc')} className={`px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${activeTab === 'calc' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Settings className="w-4 h-4" /> <span className="hidden xs:inline">Calculator</span>
          </button>
          <button onClick={() => setActiveTab('solver')} className={`px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${activeTab === 'solver' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Target className="w-4 h-4" /> <span className="hidden xs:inline">Battenberg</span>
          </button>
          <button onClick={() => setActiveTab('data')} className={`px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${activeTab === 'data' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Database className="w-4 h-4" /> <span className="hidden xs:inline">Library</span>
          </button>
        </nav>
        <div className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-widest">v3.9.0-SCROLL-FIX</div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full print:m-0 print:p-0 custom-scrollbar touch-pan-y">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3"><Info className="w-5 h-5" /> <span className="text-sm font-bold uppercase">{error}</span></div>
              <button onClick={() => setError(null)} className="text-[10px] font-black uppercase hover:opacity-70 p-2">Dismiss</button>
            </div>
          )}

          {activeTab === 'calc' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start pb-10">
              <div className="lg:col-span-4 print:hidden order-2 lg:order-1">
                <ManeuverForm 
                  onSubmit={handleCalculation} 
                  onExport={handleExport}
                  onZoom={handleZoom}
                  onSaveAsTable={handleSaveAsTable}
                  loading={loading || exporting} 
                  turningData={turningData} 
                  hasResult={!!result}
                  yardScale={yardScale}

                  type={type}
                  setType={setType}
                  baseAngle={baseAngle}
                  setBaseAngle={setBaseAngle}
                  distAngle1={distAngle1}
                  setDistAngle1={setDistAngle1}
                  distAngle2={distAngle2}
                  setDistAngle2={setDistAngle2}
                  guideSpeed={guideSpeed}
                  setGuideSpeed={setGuideSpeed}
                  initialSide={initialSide}
                  setInitialSide={setInitialSide}
                  selectedTableKey={selectedTableKey}
                  setSelectedTableKey={setSelectedTableKey}
                  useOffsets={useOffsets}
                  setUseOffsets={setUseOffsets}
                  offAdv={offAdv}
                  setOffAdv={setOffAdv}
                  offTrans={offTrans}
                  setOffTrans={setOffTrans}
                />
              </div>
              <div className="lg:col-span-8 print:col-span-12 order-1 lg:order-2">
                {result ? (
                  <ManeuverVisualizer 
                    ref={visualizerRef} 
                    result={result} 
                    yardScale={yardScale} 
                    onSetScale={setYardScale}
                    onExport={handleExport}
                    onSaveAsTable={handleSaveAsTable}
                    stationSolver={stationSolver}
                  />
                ) : (
                  <div className="glass rounded-3xl border-2 border-dashed border-slate-800 py-20 md:py-32 flex flex-col items-center justify-center text-center px-6">
                    <BarChart3 className="w-12 h-12 md:w-16 md:h-16 text-slate-800 mb-6" />
                    <h3 className="text-lg md:text-xl font-black text-slate-700 uppercase">Interactive Tactical Plot</h3>
                    <p className="text-slate-600 max-w-sm mt-2 text-xs md:text-sm leading-relaxed uppercase font-bold tracking-tight">Configure parameters to see real-time naval vectors and fishtail geometry.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'solver' ? (
            <TargetMatchSolver
              turningData={turningData}
              selectedTableKey={selectedTableKey}
              setSelectedTableKey={setSelectedTableKey}
              guideSpeed={guideSpeed}
              setGuideSpeed={setGuideSpeed}
              initialSide={initialSide}
              setInitialSide={setInitialSide}
              targetSep={targetSep}
              setTargetSep={setTargetSep}
              targetDrop={targetDrop}
              setTargetDrop={setTargetDrop}
              solverMode={solverMode}
              setSolverMode={setSolverMode}
              initStationPreset={initStationPreset}
              setInitStationPreset={setInitStationPreset}
              initStationBearing={initStationBearing}
              setInitStationBearing={setInitStationBearing}
              initStationRange={initStationRange}
              setInitStationRange={setInitStationRange}
              targetStationPreset={targetStationPreset}
              setTargetStationPreset={setTargetStationPreset}
              targetStationBearing={targetStationBearing}
              setTargetStationBearing={setTargetStationBearing}
              targetStationRange={targetStationRange}
              setTargetStationRange={setTargetStationRange}
              onApplySolution={(solution) => {
                setType(solution.type);
                setBaseAngle(solution.baseAngle);
                setDistAngle1(solution.distAngle1);
                setDistAngle2(solution.distAngle2);
                setInitialSide(solution.initialSide);
                setActiveTab('calc'); // back to plotter tab
              }}
            />
          ) : (
            <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-10">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-slate-900/30 p-6 md:p-8 rounded-3xl border border-slate-800">
                <div className="max-w-xl text-center md:text-left">
                  <h2 className="text-xl md:text-2xl font-black mb-2 flex items-center justify-center md:justify-start gap-3 tracking-tight">
                    <FileSpreadsheet className="w-6 h-6 md:w-8 md:h-8 text-blue-500" /> TACTICAL LIBRARY
                  </h2>
                  <p className="text-slate-400 text-[10px] md:text-xs leading-relaxed uppercase font-bold tracking-tight">Manage performance tables. Profiles are grouped for precision mission planning.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {/* IMPORT FILE BUTTON */}
                  <label className="relative group cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-sm flex items-center gap-2 transition-all shadow-md shadow-blue-600/10 active:scale-95">
                    <Upload className="w-3.5 h-3.5" /> IMPORT EXCEL / BACKUP
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv,.json" onChange={handleFileUpload} />
                    {/* Hover detail */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 bg-slate-950/95 backdrop-blur border border-slate-800 p-2.5 rounded-lg text-[9px] w-48 text-center text-slate-300 shadow-xl leading-normal">
                      <span className="block font-bold text-blue-400 uppercase mb-0.5">Import Tool</span>
                      Upload an Excel (.xlsx), CSV or JSON backup to populate tables.
                    </div>
                  </label>

                  {/* MANUAL ENTRY BUTTON */}
                  <button 
                    onClick={() => setShowManualEntry(true)} 
                    className="relative group bg-slate-800 hover:bg-slate-700 text-white px-3 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-sm border border-slate-700 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> MANUAL ENTRY
                    {/* Hover detail */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 bg-slate-950/95 backdrop-blur border border-slate-800 p-2.5 rounded-lg text-[9px] w-48 text-center text-slate-300 shadow-xl leading-normal">
                      <span className="block font-bold text-slate-400 uppercase mb-0.5">Manual Compiler</span>
                      Compile tactical parameters point-by-point manually.
                    </div>
                  </button>

                  {/* EXPORT BACKUP BUTTON */}
                  <button 
                    onClick={() => setShowExportPicker(true)} 
                    className="relative group bg-emerald-600 hover:bg-emerald-500 text-white px-3 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-600/10 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" /> EXPORT BACKUP
                    {/* Hover detail */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 bg-slate-950/95 backdrop-blur border border-slate-800 p-2.5 rounded-lg text-[9px] w-48 text-center text-slate-300 shadow-xl leading-normal">
                      <span className="block font-bold text-emerald-400 uppercase mb-0.5">Export Backup</span>
                      Export whole tactical database in portable CSV or JSON backup.
                    </div>
                  </button>
                </div>
              </div>
              <TurningDataTable 
                data={turningData} 
                onClear={() => saveTurningData([])} 
                onUpdateTable={handleUpdateTable}
                onDeleteTable={handleDeleteTable}
              />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Save Fallback Modal */}
      {mobileExportUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <button 
              onClick={() => {
                URL.revokeObjectURL(mobileExportUrl);
                setMobileExportUrl(null);
              }}
              className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase text-blue-400">Save Tactical Plot</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Long-press the image below and select "Save Image" or "Download Image"</p>
            </div>
            <div className="bg-slate-950 rounded-2xl p-2 border border-slate-800 shadow-inner overflow-hidden">
               <img 
                 src={mobileExportUrl} 
                 alt="Tactical Plot" 
                 className="w-full h-auto rounded-lg select-all" 
                 style={{ WebkitTouchCallout: 'default' }} 
               />
            </div>
            <button 
              onClick={() => setMobileExportUrl(null)}
              className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* 🚀 EXPORT BACKUP PICKER MODAL */}
      {showExportPicker && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <button 
              onClick={() => setShowExportPicker(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-lg font-black uppercase text-emerald-400 flex items-center gap-2 justify-center md:justify-start">
                <Download className="w-5 h-5 text-emerald-400" /> Export Database Library
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select your desired file format</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Option JSON */}
              <button
                onClick={() => {
                  exportDatabaseBackupJSON();
                  setShowExportPicker(false);
                }}
                className="w-full p-4 bg-slate-950 hover:bg-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all flex items-start gap-3 active:scale-[0.98] group"
              >
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-black uppercase tracking-wider text-slate-200">JSON Format (.json)</span>
                  <span className="block text-[9px] text-slate-500 uppercase font-semibold leading-relaxed mt-0.5">
                    Preserves database structure, metadata groups, and variables. Best for restoring backup on other devices.
                  </span>
                </div>
              </button>

              {/* Option CSV */}
              <button
                onClick={() => {
                  exportDatabaseBackupCSV();
                  setShowExportPicker(false);
                }}
                className="w-full p-4 bg-slate-950 hover:bg-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all flex items-start gap-3 active:scale-[0.98] group"
              >
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-black uppercase tracking-wider text-slate-200">CSV Flat Table (.csv)</span>
                  <span className="block text-[9px] text-slate-500 uppercase font-semibold leading-relaxed mt-0.5">
                    Compiles all points into a single flat spreadsheet compatible with Excel, Google Sheets, or Numbers.
                  </span>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setShowExportPicker(false)}
              className="w-full py-3 bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 🔮 EXPORT COMPLETED & CLIPBOARD COPY FALLBACK DIALOG */}
      {exportModalContent && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-855 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
            <button 
              onClick={() => setExportModalContent(null)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-855 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center md:text-left space-y-1">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                EXPORT SUCCESS
              </span>
              <h3 className="text-xl font-black uppercase text-slate-200 mt-2">
                Tactical Table Export Completed
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                File: <span className="text-blue-400">{exportModalContent.fileName}</span>
              </p>
            </div>

            <p className="text-[10px] text-slate-400 uppercase font-bold leading-relaxed tracking-tight bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
              ⚠️ <span className="text-emerald-400">NOTE:</span> If your browser sandbox didn't automatically download the file, click the button below to copy the data directly into your clipboard, paste it in any text editor, and save it on your device.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Raw File Payload Preview</span>
                <span className="text-[9px] font-black text-slate-500 uppercase">{exportModalContent.text.length} characters</span>
              </div>
              <textarea
                readOnly
                value={exportModalContent.text}
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[9px] text-slate-500 outline-none resize-none custom-scrollbar select-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(exportModalContent.text);
                  setCopied(true);
                }}
                className={`py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${copied ? 'bg-emerald-600 text-white shadow-emerald-600/10' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10 active:scale-95'}`}
              >
                {copied ? '✔ Copied to Clipboard' : '📋 Copy to Clipboard'}
              </button>
              <button 
                onClick={() => setExportModalContent(null)}
                className="py-4 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded-xl font-black uppercase text-xs tracking-widest transition-all text-center"
              >
                Dismiss Window
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualEntry && <ManualEntryModal onClose={() => setShowManualEntry(false)} onSubmit={handleAddDataPoint} />}
      {pendingFileRows && <ImportMetadataModal onClose={() => setPendingFileRows(null)} onSubmit={processPendingImport} />}
      {showSaveConfirm && saveConfirmDefaults && (
        <SaveConfirmModal
          onClose={() => {
            setShowSaveConfirm(false);
            setSaveConfirmDefaults(null);
          }}
          onConfirm={handleConfirmSaveTable}
          defaultValues={saveConfirmDefaults}
        />
      )}
    </div>
  );
};

export default App;
