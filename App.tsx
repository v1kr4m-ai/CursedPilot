
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Anchor, 
  PlusCircle, 
  Settings, 
  ChevronRight, 
  Search, 
  ArrowLeft,
  Ship as ShipIcon,
  Ruler,
  Wind,
  Navigation,
  Activity,
  Compass,
  CheckCircle2,
  Sparkles,
  Filter,
  X,
  Plus,
  Save,
  Printer,
  Trash2,
  MessageSquare,
  Calculator,
  RefreshCcw,
  Clock,
  Send,
  ChevronDown,
  Download,
  Upload,
  Pencil,
  Sun,
  Moon,
  Eye,
  Star,
  Pin
} from 'lucide-react';
import { Ship, AppView, ShipParticulars, TurningDataRow, TurningDataSet, SimpleRecord } from './types';
import { generateSmartParticulars } from './services/geminiService';
import { exportBackup, parseBackup } from './services/backup';
import { exportVessel, ExportFormat } from './services/vesselExport';
import FishtailScreen from './fishtail/FishtailScreen';
import { mergeTurningSets } from './fishtail/tableConvert';
import NavYeo from './navyeo/NavYeo';
import FleetRegistry from './components/FleetRegistry';
import BottomBar from './components/BottomBar';
import MyShipHero from './components/MyShipHero';
import ShipInfoPanel from './components/ShipInfoPanel';
import FishtailTable from './components/FishtailTable';
import ShipInfoForm from './components/ShipInfoForm';
import CalibrationData from './components/CalibrationData';
import CustomFieldsEditor from './components/CustomFieldsEditor';
import { fieldsOf, formatField, shownFields, tidy, withGroup } from './data/customFields';
import { useShipWiki } from './components/useShipWiki';
import { calibrationSummaries } from './data/summaries';
import TurningImport from './components/TurningImport';
import { TURNING_FORMATS, TurningFormat, exportTurning } from './services/turningExport';
import { CATEGORIES, FleetMeta, MAX_PINS, loadMeta, mergeCatalog, pruneMeta, recordUse, saveMeta, setMyShip, togglePin } from './data/fleet';


const WHEEL_OPTIONS = [5, 10, 15, 20, 25];
const SPEED_OPTIONS = [8, 12, 15, 18, 20];
/** The usual choices plus any value the ship's own (for example imported) tables use, so those tables can be opened and edited. */
const withUsed = (base: number[], used: number[]) => [...new Set([...base, ...used])].sort((a, b) => a - b);
const PREFILLED_TURN_AMOUNTS = [0, 15, 30, 45, 60, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];

const generateInitialTurningSheet = () => {
  return PREFILLED_TURN_AMOUNTS.map(val => ({
    id: Math.random().toString(36).slice(2, 11),
    turnAmount: val,
    bearingMob: 0,
    angle: 0,
    rangeCables: 0,
    rangeYards: 0,
    transfer: 0,
    advance: 0,
    distToNewCourse: 0,
    time: '',
    speed: ''
  }));
};

type RecordKind = 'fishtails' | 'accelDecelData' | 'emLogCalibration' | 'compassSwing';
type RecordValues = Record<string, string>;
interface FieldDef { key: string; label: string; type: 'number' | 'select'; options?: string[]; required?: boolean; signed?: boolean; initial?: string }

const num = (v: string) => parseFloat(v);
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

// One entry form is generated from each definition; every record is stored as a SimpleRecord.
const RECORD_KINDS: Record<RecordKind, { formTitle: string; defaultNote: string; fields: FieldDef[]; summarize: (v: RecordValues) => string }> = {
  fishtails: {
    formTitle: 'Record Fishtail',
    defaultNote: 'Fishtail manoeuvre',
    fields: [
      { key: 'speed', label: 'Speed (kn)', type: 'number', required: true },
      { key: 'rudder', label: 'Rudder (deg)', type: 'number', initial: '15' },
      { key: 'overshoot', label: 'Overshoot (deg)', type: 'number' },
      { key: 'cycle', label: 'Cycle time (s)', type: 'number' },
    ],
    summarize: v => [`${v.speed} kn`, v.rudder && `${v.rudder}\u00B0 rudder`, v.overshoot && `overshoot ${v.overshoot}\u00B0`, v.cycle && `cycle ${v.cycle} s`].filter(Boolean).join(' \u00B7 '),
  },
  accelDecelData: {
    formTitle: 'Record Accel / Decel Run',
    defaultNote: 'Acceleration/deceleration run',
    fields: [
      { key: 'type', label: 'Run type', type: 'select', options: ['Acceleration', 'Deceleration'], initial: 'Acceleration' },
      { key: 'from', label: 'From (kn)', type: 'number', required: true },
      { key: 'to', label: 'To (kn)', type: 'number', required: true },
      { key: 'time', label: 'Time (s)', type: 'number', required: true },
      { key: 'distance', label: 'Distance run (m)', type: 'number' },
    ],
    summarize: v => [`${v.type} ${v.from} to ${v.to} kn in ${v.time} s`, v.distance && `${v.distance} m run`].filter(Boolean).join(' \u00B7 '),
  },
  emLogCalibration: {
    formTitle: 'Record EM Log Calibration',
    defaultNote: 'EM log calibration',
    fields: [
      { key: 'ref', label: 'True speed (kn)', type: 'number', required: true },
      { key: 'log', label: 'Log reading (kn)', type: 'number', required: true },
    ],
    summarize: v => `True ${v.ref} kn, log ${v.log} kn (error ${signed(num(v.log) - num(v.ref))} kn)`,
  },
  compassSwing: {
    formTitle: 'Record Compass Swing',
    defaultNote: 'Compass swing',
    fields: [
      { key: 'compass', label: 'Compass', type: 'select', options: ['Standard', 'Steering', 'Gyro'], initial: 'Standard' },
      { key: 'deviation', label: 'Residual deviation (deg, + E / - W)', type: 'number', required: true, signed: true },
    ],
    summarize: v => `${v.compass} compass \u00B7 residual deviation ${signed(num(v.deviation))}\u00B0`,
  },
};

const initialValues = (kind: RecordKind): RecordValues =>
  Object.fromEntries(RECORD_KINDS[kind].fields.map(f => [f.key, f.initial ?? '']));

const THEME_KEY = 'cursedpilot.theme';
type Theme = 'light' | 'dark' | 'red';
const THEME_ORDER: Theme[] = ['light', 'dark', 'red'];
const THEME_LABEL: Record<Theme, string> = { light: 'Day', dark: 'Dark', red: 'Night red' };

const loadTheme = (): Theme => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'red') return t;
  } catch { /* storage unavailable */ }
  return 'light';
};

const STORAGE_KEY = 'cursedpilot.ships.v1';

const loadShips = (): Ship[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return mergeCatalog(parsed);
  } catch { /* corrupt or unavailable storage: start from the catalogue */ }
  return mergeCatalog([]);
};

const App: React.FC = () => {
  const [ships, setShips] = useState<Ship[]>(loadShips);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [meta, setMeta] = useState<FleetMeta>(loadMeta);
  const [dataSheetOpen, setDataSheetOpen] = useState(false);
  const [calOpen, setCalOpen] = useState<string | null>(null);
  /** which top-level sections of the ship screen are expanded; all start collapsed */
  const [shipSections, setShipSections] = useState<{ particulars: boolean; calibration: boolean }>({ particulars: false, calibration: false });
  const toggleSection = (k: 'particulars' | 'calibration') => setShipSections(s => ({ ...s, [k]: !s[k] }));
  const [toast, setToast] = useState<string | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => { saveMeta(meta); }, [meta]);
  useEffect(() => { setMeta(m => pruneMeta(m, ships)); }, [ships]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage full or blocked */ }
  }, [theme]);

  const cycleTheme = () => setTheme(t => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ships)); } catch { /* quota/private mode: ignore */ }
  }, [ships]);

  const [view, setView] = useState<AppView>('home');
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Welcome splash: logo -> typewriter tagline -> fade out
  const [showSplash, setShowSplash] = useState(true);
  const [splashStage, setSplashStage] = useState<'logo' | 'text' | 'fadeout'>('logo');
  const [typewriterText, setTypewriterText] = useState('');
  const fullSubtitle = 'Long ND made Short';


  const [newShipName, setNewShipName] = useState('');
  const [newShipType, setNewShipType] = useState<string>(CATEGORIES[0]);

  // Sequential Dropdown Selection States (Details View)
  const [detailSpeed, setDetailSpeed] = useState<number | null>(null);
  const [detailWheel, setDetailWheel] = useState<number | null>(null);
  const [detailSide, setDetailSide] = useState<'Port' | 'Starboard' | null>(null);

  // Turning Data Entry Form States
  const [formSpeed, setFormSpeed] = useState<number>(12);
  const [formWheel, setFormWheel] = useState<number>(15);
  const [formSide, setFormSide] = useState<'Port' | 'Starboard'>('Port');
  const [initialHead, setInitialHead] = useState<number>(180);
  const [localTurningData, setLocalTurningData] = useState<TurningDataRow[]>([]);

  // Record Entry Form States (fishtails, accel/decel, EM log, compass swing)
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [recordKind, setRecordKind] = useState<RecordKind>('fishtails');
  const [recordDate, setRecordDate] = useState(todayISO());
  const [recordValues, setRecordValues] = useState<RecordValues>({});
  const [recordRemarks, setRecordRemarks] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingLegacy, setEditingLegacy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [turningExportOpen, setTurningExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Tools State

  const selectedShip = ships.find(s => s.id === selectedShipId);

  // a different ship starts with every calibration section collapsed
  useEffect(() => { setCalOpen(null); }, [selectedShipId]);

  useEffect(() => {
    const logoTimer = setTimeout(() => setSplashStage('text'), 1800);
    return () => clearTimeout(logoTimer);
  }, []);

  useEffect(() => {
    if (splashStage !== 'text') return;
    let i = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setTypewriterText(fullSubtitle.slice(0, ++i));
      if (i >= fullSubtitle.length) {
        clearInterval(interval);
        holdTimer = setTimeout(() => setSplashStage('fadeout'), 1500);
      }
    }, 80);
    return () => { clearInterval(interval); clearTimeout(holdTimer); };
  }, [splashStage]);

  useEffect(() => {
    if (splashStage !== 'fadeout') return;
    const hideTimer = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(hideTimer);
  }, [splashStage]);

  // Synchronize form when entering Turning Data Entry view
  useEffect(() => {
    if (view === 'turning_data_form' && selectedShip) {
      const existingSet = selectedShip.turningDataSets.find(
        s => s.testSpeed === formSpeed && s.wheelAngle === formWheel && s.turnSide === formSide
      );
      if (existingSet) {
        setLocalTurningData(existingSet.data);
        setInitialHead(existingSet.initialHead || 180);
      } else {
        setLocalTurningData(generateInitialTurningSheet());
        setInitialHead(180);
      }
    }
  }, [view, selectedShipId, formSpeed, formWheel, formSide]);

  // Clear detail selections when ship changes
  useEffect(() => {
    setDetailSpeed(null);
    setDetailWheel(null);
    setDetailSide(null);
  }, [selectedShipId]);

  const handleAddShip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipName) return;
    const newShip: Ship = {
      id: Math.random().toString(36).slice(2, 11),
      name: newShipName,
      type: newShipType,
      particulars: { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 },
      turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: []
    };
    setShips([...ships, newShip]);
    setNewShipName('');
    openShip(newShip.id);
  };

  /** Opens a ship's screen and counts the visit (for the "most used" sort). */
  const openShip = (id: string) => {
    setSelectedShipId(id);
    setMeta(m => recordUse(m, id, Date.now()));
    setView('details');
  };

  const deleteShip = (id: string) => {
    const ship = ships.find(s => s.id === id);
    if (!ship || ship.catalog) return;
    if (confirm(`Remove ${ship.name} from the fleet? Its records are deleted with it.`)) {
      setShips(prev => prev.filter(s => s.id !== id));
      if (selectedShipId === id) setSelectedShipId(null);
    }
  };

  const myShip = ships.find(s => s.id === meta.myShipId);
  const myWiki = useShipWiki(view === 'home' ? myShip : undefined);
  const shipWiki = useShipWiki(view === 'details' ? selectedShip : undefined);

  const toggleMine = (ship: Ship) => {
    const clearing = meta.myShipId === ship.id;
    setMeta(m => setMyShip(m, clearing ? null : ship.id));
    setToast(clearing ? 'My Ship cleared' : `${ship.name} is now My Ship`);
  };
  const togglePinned = (ship: Ship) => {
    const r = togglePin(meta, ship.id);
    if (!r.ok) { setToast(`You can pin up to ${MAX_PINS} ships. Unpin one first.`); return; }
    setMeta(r.meta);
  };

  const handleUpdateTurningRow = (id: string, field: keyof TurningDataRow, value: any) => {
    setLocalTurningData(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updatedRow = { ...row, [field]: value };

      // Advance and transfer follow bearing and range only when those are what was edited; typed or imported
      // advance/transfer are kept as entered.
      if (field === 'advance' || field === 'transfer') updatedRow[field] = parseFloat(value) || 0;
      if (field === 'bearingMob' || field === 'rangeCables') {
        if (field === 'bearingMob') updatedRow.angle = parseFloat(value) || 0;
        if (field === 'rangeCables') updatedRow.rangeYards = (parseFloat(value) || 0) * 200;
        const rad = (updatedRow.angle * Math.PI) / 180;
        updatedRow.advance = updatedRow.rangeYards * Math.cos(rad);
        updatedRow.transfer = updatedRow.rangeYards * Math.sin(rad);
      }

      return updatedRow;
    }));
  };

  const saveTurningData = () => {
    if (!selectedShipId) return;
    setShips(prev => prev.map(ship => {
      if (ship.id !== selectedShipId) return ship;
      const filteredSets = ship.turningDataSets.filter(
        s => !(s.testSpeed === formSpeed && s.wheelAngle === formWheel && s.turnSide === formSide)
      );
      const newSet: TurningDataSet = {
        testSpeed: formSpeed,
        wheelAngle: formWheel,
        turnSide: formSide,
        initialHead: initialHead,
        data: localTurningData
      };
      return { ...ship, turningDataSets: [...filteredSets, newSet] };
    }));
    setDetailSpeed(formSpeed);
    setDetailWheel(formWheel);
    setDetailSide(formSide);
    setView('details');
  };

  const renderTurningGraph = (data: TurningDataRow[]) => {
    const validData = data.filter(d => d.rangeYards > 0 || d.turnAmount === 0);
    if (validData.length === 0) return null;

    const minX = Math.min(...validData.map(d => d.transfer)) - 50;
    const maxX = Math.max(...validData.map(d => d.transfer)) + 50;
    const minY = Math.min(...validData.map(d => d.advance)) - 50;
    const maxY = Math.max(...validData.map(d => d.advance)) + 50;

    const width = 400;
    const height = 400;
    const padding = 40;

    const scaleX = (val: number) => padding + ((val - minX) / (maxX - minX)) * (width - 2 * padding);
    const scaleY = (val: number) => height - (padding + ((val - minY) / (maxY - minY)) * (height - 2 * padding));

    const points = validData.map(d => `${scaleX(d.transfer)},${scaleY(d.advance)}`).join(' ');

    return (
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm print:shadow-none">
        <h3 className="text-center font-bold text-slate-800 mb-4 flex items-center justify-center gap-2">
           <Wind size={18} className="text-blue-500" /> Turning Circle Plot
        </h3>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <line x1={scaleX(0)} y1={0} x2={scaleX(0)} y2={height} stroke="#e2e8f0" strokeDasharray="4" />
          <line x1={0} y1={scaleY(0)} x2={width} y2={scaleY(0)} stroke="#e2e8f0" strokeDasharray="4" />
          <text x={width - 10} y={scaleY(0) - 5} className="text-[10px] fill-slate-400 font-bold" textAnchor="end">TRANSFER</text>
          <text x={scaleX(0) + 5} y={15} className="text-[10px] fill-slate-400 font-bold" transform={`rotate(90, ${scaleX(0)+5}, 15)`}>ADVANCE</text>
          <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
          {validData.map((d) => (
            <g key={d.id}>
              <circle cx={scaleX(d.transfer)} cy={scaleY(d.advance)} r="4" fill="#3b82f6" stroke="white" strokeWidth="1" />
              <text x={scaleX(d.transfer) + 6} y={scaleY(d.advance) - 6} className="text-[8px] fill-slate-500 font-medium">
                {d.turnAmount}°
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderTurningDataForm = () => {
    if (!selectedShip) return null;

    return (
      <div className="p-4 md:p-8 bg-slate-100 min-h-screen">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 sticky top-0 bg-slate-100/90 backdrop-blur-sm z-20 py-2">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('details')} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
              <ArrowLeft size={24} className="text-slate-800" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Turning Data Entry</h1>
              <p className="text-sm text-slate-600 font-medium">{selectedShip.name} Registry</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="p-3 bg-white text-slate-800 rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all active:scale-95">
              <Printer size={20} />
            </button>
            <button onClick={saveTurningData} className="flex items-center gap-2 px-6 py-3 bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95">
              <Save size={20} /> Save Registry
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest border-b pb-2">Entry Conditions</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Speed (knots)</label>
                <div className="grid grid-cols-3 gap-2">
                  {withUsed(SPEED_OPTIONS, [...selectedShip.turningDataSets.map(s => s.testSpeed), formSpeed]).map(opt => (
                    <button key={opt} onClick={() => setFormSpeed(opt)} className={`py-2 rounded-xl text-sm font-bold border transition-all ${formSpeed === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Wheel Angle</label>
                <div className="grid grid-cols-3 gap-2">
                  {withUsed(WHEEL_OPTIONS, [...selectedShip.turningDataSets.map(s => s.wheelAngle), formWheel]).map(opt => (
                    <button key={opt} onClick={() => setFormWheel(opt)} className={`py-2 rounded-xl text-sm font-bold border transition-all ${formWheel === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{opt}°</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Turn Side</label>
                <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  {(['Port', 'Starboard'] as const).map(side => (
                    <button 
                      key={side} 
                      onClick={() => setFormSide(side)} 
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        formSide === side 
                          ? (side === 'Port' ? 'bg-red-600 text-white shadow-sm' : 'bg-green-600 text-white shadow-sm') 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Initial Ship Head</label>
                <input type="number" value={initialHead} onChange={(e) => setInitialHead(parseFloat(e.target.value) || 0)} className="w-full p-3 rounded-xl border border-slate-300 font-bold text-slate-950 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            {renderTurningGraph(localTurningData)}
          </aside>

          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-medium border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 uppercase tracking-tight">
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Turn Amt</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 bg-yellow-100/50 text-blue-900 text-center">Bearing MOB</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Angle</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 bg-yellow-100/50 text-blue-900 text-center">Range (C)</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Range (Yds)</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Transfer (Yds)</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Advance (Yds)</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Dist. New</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Time</th>
                    <th className="px-3 py-4 border-b border-r border-slate-200 text-center">Speed</th>
                    <th className="px-3 py-4 border-b w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localTurningData.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2 py-1 border-r border-slate-100 text-center bg-slate-50/30">
                        <select 
                          value={row.turnAmount} 
                          onChange={(e) => handleUpdateTurningRow(row.id, 'turnAmount', parseInt(e.target.value))}
                          className="w-full p-1 bg-transparent border-none outline-none font-bold text-slate-950 text-center appearance-none"
                        >
                          {(PREFILLED_TURN_AMOUNTS.includes(row.turnAmount) ? PREFILLED_TURN_AMOUNTS : [...PREFILLED_TURN_AMOUNTS, row.turnAmount].sort((a, b) => a - b)).map(v => <option key={v} value={v}>{v}°</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                        <input type="number" value={row.bearingMob || ''} onChange={(e) => handleUpdateTurningRow(row.id, 'bearingMob', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="0" />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 text-slate-600 font-bold text-center">{row.angle}°</td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                        <input type="number" step="0.01" value={row.rangeCables || ''} onChange={(e) => handleUpdateTurningRow(row.id, 'rangeCables', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="0.0" />
                      </td>
                      <td className="px-3 py-2 border-r border-slate-100 font-bold text-slate-800 text-center">{row.rangeYards.toFixed(0)}</td>
                      <td className="px-1 py-1 border-r border-slate-100"><input type="number" step="any" aria-label="Transfer" value={Number(row.transfer.toFixed(2))} onChange={(e) => handleUpdateTurningRow(row.id, 'transfer', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" /></td>
                      <td className="px-1 py-1 border-r border-slate-100"><input type="number" step="any" aria-label="Advance" value={Number(row.advance.toFixed(2))} onChange={(e) => handleUpdateTurningRow(row.id, 'advance', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" /></td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                         <input type="number" value={row.distToNewCourse || ''} onChange={(e) => handleUpdateTurningRow(row.id, 'distToNewCourse', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="0" />
                      </td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                         <input type="text" value={row.time} onChange={(e) => handleUpdateTurningRow(row.id, 'time', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="MM:SS" />
                      </td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                         <input type="text" value={row.speed} onChange={(e) => handleUpdateTurningRow(row.id, 'speed', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="--" />
                      </td>
                      <td className="px-1 py-1"><button onClick={() => setLocalTurningData(prev => prev.filter(r => r.id !== row.id))} aria-label="Delete row" className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-slate-100">
              <button onClick={() => setLocalTurningData(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), turnAmount: 0, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, transfer: 0, advance: 0, distToNewCourse: 0, time: '', speed: '' }])} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg active:scale-95 transition-all"><Plus size={14} />Add row</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const activeDataSet = useMemo(() => {
    if (!selectedShip || detailSpeed === null || detailWheel === null || detailSide === null) return null;
    return selectedShip.turningDataSets.find(s => 
      s.testSpeed === detailSpeed && 
      s.wheelAngle === detailWheel && 
      s.turnSide === detailSide
    );
  }, [selectedShip, detailSpeed, detailWheel, detailSide]);

  const deleteTurningTable = () => {
    if (!selectedShip || !activeDataSet) return;
    if (!confirm(`Delete the ${activeDataSet.testSpeed} kn, ${activeDataSet.wheelAngle}° ${activeDataSet.turnSide} turning table?`)) return;
    const { testSpeed, wheelAngle, turnSide } = activeDataSet;
    setShips(prev => prev.map(sh => sh.id === selectedShip.id ? { ...sh, turningDataSets: sh.turningDataSets.filter(s => !(s.testSpeed === testSpeed && s.wheelAngle === wheelAngle && s.turnSide === turnSide)) } : sh));
    setDetailSide(null);
  };

  const importTurningSets = (shipId: string, sets: TurningDataSet[]) =>
    setShips(prev => prev.map(sh => sh.id === shipId ? { ...sh, turningDataSets: mergeTurningSets(sh.turningDataSets, sets) } : sh));

  const runTurningExport = async (format: TurningFormat) => {
    if (!selectedShip) return;
    try {
      await exportTurning(selectedShip, format);
      setTurningExportOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) setToast(msg);
    }
  };

  const renderTurningTrials = () => (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">All turning data</p>
        <div className="flex gap-2">
          <TurningImport ship={selectedShip} onImport={importTurningSets} onMessage={m => setToast(m.text)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg cursor-pointer active:scale-95 transition-all"><Upload size={14} />Import</TurningImport>
          <button onClick={() => setTurningExportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg active:scale-95 transition-all"><Download size={14} />Export</button>
        </div>
      </div>
            <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <select 
                    value={detailSpeed || ''} 
                    onChange={(e) => {
                      setDetailSpeed(parseInt(e.target.value));
                      setDetailWheel(null);
                      setDetailSide(null);
                    }}
                    className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-900 focus:border-blue-300"
                  >
                    <option value="" disabled>Speed</option>
                    {withUsed(SPEED_OPTIONS, selectedShip.turningDataSets.map(s => s.testSpeed)).map(o => <option key={o} value={o}>{o} kts</option>)}
                  </select>

                  <select 
                    disabled={detailSpeed === null}
                    value={detailWheel || ''} 
                    onChange={(e) => {
                      setDetailWheel(parseInt(e.target.value));
                      setDetailSide(null);
                    }}
                    className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-900 focus:border-blue-300 disabled:opacity-50"
                  >
                    <option value="" disabled>Wheel</option>
                    {withUsed(WHEEL_OPTIONS, selectedShip.turningDataSets.map(s => s.wheelAngle)).map(o => <option key={o} value={o}>{o}°</option>)}
                  </select>

                  <select 
                    disabled={detailWheel === null}
                    value={detailSide || ''} 
                    onChange={(e) => setDetailSide(e.target.value as any)}
                    className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-900 focus:border-blue-300 disabled:opacity-50"
                  >
                    <option value="" disabled>Side</option>
                    <option value="Port">Port</option>
                    <option value="Starboard">Starboard</option>
                  </select>
                </div>
                <button 
                  onClick={() => {
                    if (detailSpeed) setFormSpeed(detailSpeed);
                    if (detailWheel) setFormWheel(detailWheel);
                    if (detailSide) setFormSide(detailSide);
                    setView('turning_data_form');
                  }} 
                  aria-label="Add or edit this turning table"
                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <Plus size={20} />
                </button>
                {activeDataSet && (
                  <>
                    <button onClick={() => { setFormSpeed(activeDataSet.testSpeed); setFormWheel(activeDataSet.wheelAngle); setFormSide(activeDataSet.turnSide); setView('turning_data_form'); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg active:scale-95 transition-all"><Pencil size={14} />Edit</button>
                    <button onClick={deleteTurningTable} aria-label="Delete this turning table" className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                  </>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              {activeDataSet ? (
                <div className="flex flex-col">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Heading</th>
                        <th className="px-6 py-4">Advance (Yds)</th>
                        <th className="px-6 py-4">Transfer (Yds)</th>
                        <th className="px-6 py-4">Dist. New (Yds)</th>
                        <th className="px-6 py-4">Time (mm:ss)</th>
                        <th className="px-6 py-4">Speed (knots)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {activeDataSet.data.filter(d => d.rangeCables > 0 || d.advance > 0).map(row => (
                        <tr key={row.id} className="hover:bg-blue-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-950">{row.turnAmount}°</td>
                          <td className="px-6 py-4 text-slate-900 font-bold">{row.advance.toFixed(1)}</td>
                          <td className="px-6 py-4 text-slate-900 font-bold">{row.transfer.toFixed(1)}</td>
                          <td className="px-6 py-4 text-slate-900 font-bold">{row.distToNewCourse || 0}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{row.time || '--:--'}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{row.speed || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-8 border-t border-slate-100 bg-slate-50/30">
                     <div className="max-w-md mx-auto">
                        {renderTurningGraph(activeDataSet.data)}
                     </div>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                  <Wind size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Select Speed, Wheel, and Side to view profile</p>
                </div>
              )}
            </div>
    </div>
  );

  const calibrationSections = (ship: Ship) => {
    const sum = Object.fromEntries(calibrationSummaries(ship).map(x => [x.id, x]));
    return [
      { id: 'turning', title: 'Turning Trials', icon: <Navigation size={18} className="text-green-500" />, count: sum.turning.count, latest: sum.turning.latest,
        content: renderTurningTrials() },
      { id: 'accel', title: 'Acceleration and Deceleration', icon: <Activity size={18} className="text-orange-500" />, count: sum.accel.count, latest: sum.accel.latest,
        content: <DetailCard embedded title="Acceleration and Deceleration data" icon={null} items={ship.accelDecelData} onAdd={() => openRecordForm('accelDecelData')} onEdit={item => openRecordForm('accelDecelData', item)} onDelete={id => deleteRecord(ship.id, 'accelDecelData', id)} /> },
      { id: 'fishtails', title: 'Fishtails', icon: <Wind size={18} className="text-cyan-500" />, count: sum.fishtails.count, latest: sum.fishtails.latest,
        content: <FishtailTable items={ship.fishtails} onCalculator={openFishtailCalc} onDelete={id => deleteRecord(ship.id, 'fishtails', id)} /> },
      { id: 'em', title: 'EM Log Calibration', icon: <Settings size={18} className="text-indigo-500" />, count: sum.em.count, latest: sum.em.latest,
        content: <DetailCard embedded title="EM Log Calibration" icon={null} items={ship.emLogCalibration} onAdd={() => openRecordForm('emLogCalibration')} onEdit={item => openRecordForm('emLogCalibration', item)} onDelete={id => deleteRecord(ship.id, 'emLogCalibration', id)} /> },
      { id: 'compass', title: 'Compass Swing', icon: <Compass size={18} className="text-amber-500" />, count: sum.compass.count, latest: sum.compass.latest,
        content: <DetailCard embedded title="Compass Swing" icon={null} items={ship.compassSwing} onAdd={() => openRecordForm('compassSwing')} onEdit={item => openRecordForm('compassSwing', item)} onDelete={id => deleteRecord(ship.id, 'compassSwing', id)} /> },
    ];
  };

  const renderShipDetails = () => {
    if (!selectedShip) return null;
    return (
      <div className="pb-12 bg-slate-50 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 px-6 py-4 flex items-center justify-between border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('select')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
            <div><h1 className="text-xl font-bold text-slate-800 leading-tight">{selectedShip.name}</h1><p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{selectedShip.type}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)} aria-label="Export this vessel" title="Export vessel" className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"><Download size={20} /></button>
            <button onClick={() => setView('particulars_form')} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Settings size={20} /></button>
          </div>
        </header>
        
        <div className="p-4 md:max-w-4xl md:mx-auto space-y-6">
          <ShipInfoPanel
            ship={selectedShip} wiki={shipWiki.wiki} lookup={shipWiki.state}
            isMine={meta.myShipId === selectedShip.id} isPinned={meta.pinned.includes(selectedShip.id)}
            onToggleMine={() => toggleMine(selectedShip)} onTogglePin={() => togglePinned(selectedShip)}
            onEdit={() => setView('ship_info_form')}
            onPhoto={photo => setShips(prev => prev.map(sh => sh.id === selectedShip.id ? { ...sh, photo } : sh))}
          />
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className={`flex flex-wrap items-center justify-between gap-2 ${shipSections.particulars ? 'mb-6' : ''}`}>
              <button onClick={() => toggleSection('particulars')} aria-expanded={shipSections.particulars} className="flex-1 flex items-center gap-2 text-left whitespace-nowrap">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Ruler size={20} className="text-blue-500" /> Ship Particulars</h2>
                <ChevronDown size={20} className={`text-slate-400 transition-transform ${shipSections.particulars ? 'rotate-180' : ''}`} />
              </button>
              {shipSections.particulars && <div className="flex items-center gap-2">
              <button onClick={() => setView('particulars_form')} className="flex items-center gap-1.5 text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100"><Pencil size={14} /> Edit</button>
              <button onClick={() => aiGenerateParticulars(selectedShip)} className="flex items-center gap-2 text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-200 disabled:opacity-50" disabled={loading}><Sparkles size={14} /> {loading ? 'Estimating...' : 'AI Suggest Data'}</button>
              </div>}
            </div>
            {shipSections.particulars && <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {[
                { l: 'Length Overall', v: selectedShip.particulars.lengthOverall, u: 'm' },
                { l: 'Breadth Overall', v: selectedShip.particulars.breadthOverall, u: 'm' },
                { l: 'Displacement', v: selectedShip.particulars.displacement, u: 'tons' },
                { l: 'Stem to Standard', v: selectedShip.particulars.stemToStandard, u: 'm' },
                { l: 'Stem to Bridge', v: selectedShip.particulars.stemToBridge, u: 'm' },
                { l: 'Stem to RAS Point', v: selectedShip.particulars.stemToRas, u: 'm' },
                { l: 'Stem to Fueling Point', v: selectedShip.particulars.stemToFueling, u: 'm' },
                ...shownFields(selectedShip, 'particulars').map(f => ({ l: f.label, v: f.value, u: f.unit ?? '' })),
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0"><span className="text-slate-500 text-sm font-medium">{item.l}</span><span className="font-bold text-slate-950">{item.v} {item.u}</span></div>
              ))}
            </div>}
          </section>

          <CalibrationData sections={calibrationSections(selectedShip)} open={calOpen} onToggle={id => setCalOpen(o => (o === id ? null : id))} expanded={shipSections.calibration} onExpand={() => toggleSection('calibration')} />

        </div>
      </div>
    );
  };

  const openFishtailCalc = () => {
    if (!selectedShip) return;
    setView('fishtail_calc');
  };

  const openRecordForm = (kind: RecordKind, record?: SimpleRecord) => {
    if (!selectedShipId) { setView('select'); return; }
    const def = RECORD_KINDS[kind];
    setRecordKind(kind);
    setEditingRecordId(record?.id ?? null);
    setEditingLegacy(!!record && !record.fields);
    setRecordDate(record?.date ?? todayISO());
    setRecordValues(record?.fields ? { ...initialValues(kind), ...record.fields } : initialValues(kind));
    setRecordRemarks(record && record.description !== def.defaultNote ? record.description : '');
    setView('record_form');
  };

  const saveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const def = RECORD_KINDS[recordKind];
    if (!selectedShip || !recordDate || def.fields.some(f => f.required && !recordValues[f.key])) return;
    const record: SimpleRecord = { id: editingRecordId ?? Math.random().toString(36).slice(2, 11), date: recordDate, description: recordRemarks.trim() || def.defaultNote, value: def.summarize(recordValues), fields: { ...recordValues } };
    setShips(prev => prev.map(s => s.id !== selectedShip.id ? s : {
      ...s,
      [recordKind]: editingRecordId ? s[recordKind].map(r => r.id === editingRecordId ? record : r) : [...s[recordKind], record],
    }));
    setView('details');
  };

  const deleteRecord = (shipId: string, kind: RecordKind, recordId: string) => {
    if (!confirm('Delete this record?')) return;
    setShips(prev => prev.map(s => s.id === shipId ? { ...s, [kind]: s[kind].filter(r => r.id !== recordId) } : s));
  };

  const renderRecordForm = () => {
    if (!selectedShip) return null;
    const def = RECORD_KINDS[recordKind];
    const input = 'w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none font-bold text-slate-950 focus:border-blue-400 focus:ring-2 focus:ring-blue-50';
    const label = 'text-xs font-bold text-slate-500 ml-1 uppercase';
    return (
      <div className="p-6 pb-24 max-w-xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('details')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
          <h1 className="text-2xl font-bold text-slate-800">{editingRecordId ? def.formTitle.replace('Record', 'Edit') : def.formTitle}</h1>
          <p className="text-sm text-slate-500 font-bold ml-auto">{selectedShip.name}</p>
        </header>
        <form onSubmit={saveRecord} className="space-y-4">
          {editingLegacy && <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-2xl p-3">This record was saved before editing existed, so its original values are gone. Enter them again to replace it; the date and remarks are kept.</p>}
          <div className="space-y-1"><label className={label}>Date</label><input type="date" required value={recordDate} onChange={e => setRecordDate(e.target.value)} className={input} /></div>
          <div className="grid grid-cols-2 gap-4">
            {def.fields.map(f => (
              <div key={f.key} className="space-y-1">
                <label className={label}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={recordValues[f.key] ?? ''} onChange={e => setRecordValues({ ...recordValues, [f.key]: e.target.value })} className={input + ' appearance-none'}>
                    {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type="number" inputMode="decimal" step="any" min={f.signed ? undefined : 0} required={f.required} value={recordValues[f.key] ?? ''} onChange={e => setRecordValues({ ...recordValues, [f.key]: e.target.value })} className={input} />
                )}
              </div>
            ))}
          </div>
          <div className="space-y-1"><label className={label}>Remarks</label><textarea rows={3} value={recordRemarks} onChange={e => setRecordRemarks(e.target.value)} className={input + ' font-medium resize-none'} /></div>
          <button type="submit" className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">{editingRecordId ? 'Save Changes' : 'Save Record'}</button>
        </form>
      </div>
    );
  };

  const runVesselExport = async (format: ExportFormat) => {
    if (!selectedShip) return;
    setExporting(true);
    try {
      await exportVessel(selectedShip, format);
      setExportOpen(false);
    } catch (err) {
      // closing the Android share sheet without choosing a target also rejects; that is not an error worth shouting about
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel/i.test(msg)) alert(`Export failed: ${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    try { await exportBackup(ships, meta); } catch (err) { alert(`Export failed: ${err instanceof Error ? err.message : err}`); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { ships: imported, kind, fleetMeta } = parseBackup(await file.text());
      if (kind === 'vessel') {
        const names = imported.map(s => s.name).join(', ');
        const replacing = imported.filter(s => ships.some(x => x.id === s.id)).length;
        if (!confirm(`Add ${names} from "${file.name}"?${replacing ? ` ${replacing} existing vessel(s) with the same ID will be replaced.` : ''} Other vessels are kept.`)) return;
        setShips(prev => [...prev.filter(s => !imported.some(i => i.id === s.id)), ...imported]);
        return;
      }
      if (!confirm(`Restore ${imported.length} vessel(s) from "${file.name}"? This replaces all ${ships.length} vessel(s) currently in the app.`)) return;
      setShips(mergeCatalog(imported));
      if (fleetMeta) setMeta(fleetMeta);
      if (selectedShipId && !imported.some(s => s.id === selectedShipId)) setSelectedShipId(null);
    } catch (err) {
      alert(`Restore failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const renderHome = () => {
    const pinnedShips = meta.pinned.map(id => ships.find(sh => sh.id === id)).filter((sh): sh is Ship => !!sh);
    const recent = ships.filter(sh => (meta.lastUsed[sh.id] ?? 0) > 0 && sh.id !== meta.myShipId)
      .sort((a, b) => (meta.lastUsed[b.id] ?? 0) - (meta.lastUsed[a.id] ?? 0)).slice(0, 3);
    const label = 'text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2';
    return (
      <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto pb-28">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Cursed Pilot</h1>
            <div className="flex items-center gap-3">
              <button onClick={cycleTheme} aria-label={`Theme: ${THEME_LABEL[theme]}. Tap to change`} title={`Theme: ${THEME_LABEL[theme]}`} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-2xl text-slate-600 text-xs font-bold shadow-sm active:scale-95 transition-all">
                {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Eye size={16} />}
                {THEME_LABEL[theme]}
              </button>
              <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-xl shadow-blue-200"><Anchor size={24} /></div>
            </div>
          </div>
          <p className="text-slate-500 font-semibold tracking-wide">Long ND made Short</p>
        </div>

        {myShip ? (
          <MyShipHero ship={myShip} wiki={myWiki.wiki} onOpen={() => openShip(myShip.id)} />
        ) : (
          <button onClick={() => setView('select')} className="w-full p-8 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-center space-y-2 active:scale-[0.99] transition-transform">
            <Star size={28} className="mx-auto text-amber-500" />
            <h2 className="font-bold text-slate-800">Choose your ship</h2>
            <p className="text-sm text-slate-400 font-medium">Open the Fleet and tap the star beside your ship. It will show here.</p>
          </button>
        )}

        {pinnedShips.length > 0 && (
          <section>
            <h2 className={label}>Pinned</h2>
            <div className="flex flex-wrap gap-2">
              {pinnedShips.map(sh => (
                <button key={sh.id} onClick={() => openShip(sh.id)} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700 shadow-sm active:scale-95 transition-transform">
                  <Pin size={12} className="text-blue-600 fill-current" />{sh.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <h2 className={label}>Recently opened</h2>
            <div className="space-y-2">
              {recent.map(sh => (
                <button key={sh.id} onClick={() => openShip(sh.id)} className="w-full flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 text-left active:scale-[0.99] transition-transform">
                  <ShipIcon size={18} className="text-slate-400" />
                  <span className="flex-1 min-w-0"><span className="block font-bold text-sm text-slate-800 truncate">{sh.name}</span><span className="block text-xs text-slate-400 font-medium truncate">{[sh.info?.pennant, sh.info?.shipClass || sh.type].filter(Boolean).join(' \u00B7 ')}</span></span>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderSelectShip = () => (
    <FleetRegistry ships={ships} meta={meta} onMeta={setMeta} onOpen={openShip} onDelete={deleteShip} />
  );

  const renderAddShip = () => (
    <div className="p-6 pb-28 max-w-xl mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
        <h1 className="text-2xl font-bold text-slate-800">Add Ship</h1>
      </header>
      <form onSubmit={handleAddShip} className="space-y-6">
        <div><label className="text-sm font-bold text-slate-500 ml-1">Vessel Name</label><input autoFocus type="text" value={newShipName} onChange={(e) => setNewShipName(e.target.value)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100" /></div>
        <div><label className="text-sm font-bold text-slate-500 ml-1">Type</label><select value={newShipType} onChange={(e) => setNewShipType(e.target.value)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none appearance-none">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <button type="submit" className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Register Vessel</button>
      </form>
    </div>
  );

  /** Leaving the particulars form: rows that were added but left empty are dropped. */
  const leaveParticulars = () => {
    if (selectedShip) setShips(prev => prev.map(sh => sh.id === selectedShip.id && sh.custom ? { ...sh, custom: withGroup(sh, 'particulars', tidy(fieldsOf(sh, 'particulars'))) } : sh));
    setView('details');
  };

  const renderParticularsForm = () => {
    if (!selectedShip) return null;
    return (
      <div className="p-6 pb-24 max-w-xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={leaveParticulars} aria-label="Back" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
          <h1 className="text-2xl font-bold text-slate-800">Edit Particulars</h1>
          <p className="text-sm text-slate-500 font-bold ml-auto">{selectedShip.name}</p>
        </header>
        <div className="space-y-4">
          <ParticularField label="Length Overall (m)" value={selectedShip.particulars.lengthOverall} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, lengthOverall: v })} />
          <ParticularField label="Breadth Overall (m)" value={selectedShip.particulars.breadthOverall} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, breadthOverall: v })} />
          <ParticularField label="Displacement (tons)" value={selectedShip.particulars.displacement} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, displacement: v })} />
          <ParticularField label="Stem to Standard" value={selectedShip.particulars.stemToStandard} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, stemToStandard: v })} />
          <ParticularField label="Stem to Bridge" value={selectedShip.particulars.stemToBridge} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, stemToBridge: v })} />
          <ParticularField label="Stem to RAS Point" value={selectedShip.particulars.stemToRas} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, stemToRas: v })} />
          <ParticularField label="Stem to Fueling Point" value={selectedShip.particulars.stemToFueling} onChange={(v) => updateParticulars(selectedShip.id, { ...selectedShip.particulars, stemToFueling: v })} />
          <CustomFieldsEditor
            title="Additional particulars" group="particulars" addLabel="Add a particular"
            note="Your own measurements, such as mast height or draught aft. They appear with the particulars and in exports."
            fields={fieldsOf(selectedShip, 'particulars')} onChange={fs => setShips(prev => prev.map(sh => sh.id === selectedShip.id ? { ...sh, custom: withGroup(sh, 'particulars', fs) } : sh))}
          />
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 border-t border-slate-200 backdrop-blur-sm"><button onClick={leaveParticulars} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg">Save Changes</button></div>
      </div>
    );
  };

  const updateParticulars = (id: string, particulars: ShipParticulars) => setShips(prev => prev.map(s => s.id === id ? { ...s, particulars } : s));
  const aiGenerateParticulars = async (ship: Ship) => { setLoading(true); const data = await generateSmartParticulars(ship.name, ship.type); if (data) updateParticulars(ship.id, data); setLoading(false); };

  // TOOLS INTERFACE
  const renderSplash = () => (
    <div className={`original-palette fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-1000 ${splashStage === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`transition-all duration-1000 flex flex-col items-center ${splashStage === 'logo' ? 'scale-110 opacity-100' : 'scale-100 opacity-0 absolute'}`}><div className="p-6 bg-blue-600 rounded-[2.5rem] text-white shadow-2xl shadow-blue-500/20 mb-4 animate-bounce"><Anchor size={80} strokeWidth={1.5} /></div><div className="w-16 h-1 bg-blue-500/30 rounded-full overflow-hidden"><div className="h-full bg-blue-400 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} /></div></div>
      <div className={`transition-all duration-1000 text-center ${splashStage === 'text' || splashStage === 'fadeout' ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10 absolute'}`}><h1 className="text-5xl font-black text-white tracking-tighter mb-2">Cursed Pilot</h1><p className="text-blue-400 text-lg font-bold tracking-[0.3em] uppercase min-h-[1.5em]">{typewriterText}<span className="animate-pulse inline-block w-1 h-5 bg-blue-400 ml-1" /></p></div>
      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans shadow-2xl relative overflow-hidden">
      {theme === 'red' && <div aria-hidden className="fixed inset-0 z-[9999] pointer-events-none" style={{ background: '#d00000', mixBlendMode: 'multiply' }} />}
      {showSplash && renderSplash()}
      {view === 'home' && renderHome()}
      {view === 'select' && renderSelectShip()}
      {view === 'add' && renderAddShip()}
      {view === 'details' && renderShipDetails()}
      {view === 'particulars_form' && renderParticularsForm()}
      {view === 'turning_data_form' && renderTurningDataForm()}
      {view === 'record_form' && renderRecordForm()}
      {view === 'ship_info_form' && selectedShip && (
        <ShipInfoForm
          key={selectedShip.id} ship={selectedShip}
          onCancel={() => setView('details')}
          onSave={({ name, type, info, custom }) => { setShips(prev => prev.map(sh => sh.id === selectedShip.id ? { ...sh, name, type, info, custom: custom.length ? custom : undefined } : sh)); setView('details'); }}
        />
      )}
      <input ref={restoreInput} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
      {(view === 'home' || view === 'select' || view === 'add') && (
        <BottomBar view={view} onHome={() => setView('home')} onFleet={() => setView('select')} onAdd={() => setView('add')} onData={() => setDataSheetOpen(true)} />
      )}
      {dataSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setDataSheetOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h3 className="font-bold text-slate-900">Backup</h3><p className="text-xs text-slate-400 font-medium">The whole fleet, with your edits, pins and My Ship</p></div>
              <button onClick={() => setDataSheetOpen(false)} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={18} /></button>
            </div>
            <button onClick={() => { setDataSheetOpen(false); handleExport(); }} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 text-left">
              <div><p className="text-sm font-bold text-slate-800">Export backup</p><p className="text-[11px] text-slate-400 font-medium">Save a backup file you can keep or share</p></div><Download size={16} className="text-slate-300" />
            </button>
            <button onClick={() => { setDataSheetOpen(false); restoreInput.current?.click(); }} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 text-left">
              <div><p className="text-sm font-bold text-slate-800">Restore backup</p><p className="text-[11px] text-slate-400 font-medium">Replaces the fleet with a backup file (a single-vessel file is added instead)</p></div><Upload size={16} className="text-slate-300" />
            </button>
          </div>
        </div>
      )}
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold rounded-full shadow-xl max-w-[90vw] text-center">{toast}</div>}
      {turningExportOpen && selectedShip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setTurningExportOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h3 className="font-bold text-slate-900">Export turning data</h3><p className="text-xs text-slate-400 font-medium">{selectedShip.name}: every table in one file. Any of these imports back unchanged.</p></div>
              <button onClick={() => setTurningExportOpen(false)} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={18} /></button>
            </div>
            {TURNING_FORMATS.map(f => (
              <button key={f.id} onClick={() => runTurningExport(f.id)} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 text-left transition-all">
                <div><p className="text-sm font-bold text-slate-800">{f.title}</p><p className="text-[11px] text-slate-400 font-medium">{f.desc}</p></div>
                <Download size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}
      {exportOpen && selectedShip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => !exporting && setExportOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h3 className="font-bold text-slate-900">Export {selectedShip.name}</h3><p className="text-xs text-slate-400 font-medium">One vessel: particulars, turning data and records</p></div>
              <button onClick={() => setExportOpen(false)} disabled={exporting} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={18} /></button>
            </div>
            {([
              ['xlsx', 'Excel workbook', 'One sheet per section, opens in any spreadsheet app'],
              ['report', 'Printable report', 'Open it in a browser, then print or save as PDF'],
              ['json', 'Vessel file', 'Restore it later to add or update just this vessel'],
            ] as [ExportFormat, string, string][]).map(([fmt, title, desc]) => (
              <button key={fmt} disabled={exporting} onClick={() => runVesselExport(fmt)} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 text-left disabled:opacity-50 transition-all">
                <div><p className="text-sm font-bold text-slate-800">{title}</p><p className="text-[11px] text-slate-400 font-medium">{desc}</p></div>
                <Download size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}
      {view === 'fishtail_calc' && (
        <FishtailScreen
          ship={selectedShip}
          ships={ships}
          onSelectShip={setSelectedShipId}
          onBack={() => setView('details')}
          onSaveRecord={(shipId, record) => setShips(prev => prev.map(s => s.id === shipId ? { ...s, fishtails: [...s.fishtails, record] } : s))}
          onImportSets={importTurningSets}
          onEditTurningData={() => setView('turning_data_form')}
        />
      )}

      <NavYeo ship={selectedShip} />
    </div>
  );
};

const DetailCard: React.FC<{ title: string, icon: React.ReactNode, items: any[], embedded?: boolean, action?: { label: string; icon: React.ReactNode; onClick: () => void }, onAdd?: () => void, onEdit?: (item: any) => void, onDelete?: (id: string) => void }> = ({ title, icon, items, embedded, action, onAdd, onEdit, onDelete }) => {
  const buttons = (
    <div className={`flex items-center gap-2 ${embedded ? 'justify-end mb-3' : 'ml-auto'}`}>
      {action && <button onClick={action.onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">{action.icon}{action.label}</button>}
      {onAdd && <button onClick={onAdd} aria-label={`Add ${title} record`} className="flex items-center gap-1 p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16} />{embedded && <span className="text-[11px] font-bold pr-1">Add</span>}</button>}
    </div>
  );
  const list = (
    <div className="space-y-3">
      {items && items.length > 0 ? items.map(item => (
        <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.date}</span>
            <span className="flex items-center gap-1">
              {onEdit && <button onClick={() => onEdit(item)} aria-label="Edit record" className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>}
              {onDelete && <button onClick={() => onDelete(item.id)} aria-label="Delete record" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>}
            </span>
          </div>
          <p className="text-sm text-slate-900 font-bold">{item.value || item.description}</p>
          {item.value && item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}
        </div>
      )) : <p className="text-xs text-slate-400 italic">No records found.</p>}
    </div>
  );
  if (embedded) return <div>{buttons}{list}</div>;
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center gap-2 mb-4">{icon}<h3 className="font-bold text-slate-800">{title}</h3>{buttons}</div>
      {list}
    </div>
  );
};

const ParticularField: React.FC<{ label: string, value: number, onChange: (val: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 ml-1 uppercase">{label}</label>
    <input type="number" value={value || ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none font-bold text-slate-950 focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
  </div>
);

export default App;
