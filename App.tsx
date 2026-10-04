
import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
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
  Eye
} from 'lucide-react';
import { Ship, AppView, ShipParticulars, TurningDataRow, TurningDataSet, SimpleRecord } from './types';
import { INITIAL_SHIPS } from './constants';
import { generateSmartParticulars } from './services/geminiService';
import { exportBackup, parseBackup, restoreFishtailDb } from './services/backup';
import { syncShipToFishtail } from './fishtail/shipBridge';
import { NAV_TOOLS } from './tools/NavTools';

// Loaded on demand: the calculator pulls in the spreadsheet library, which most sessions never need.
const FishtailModule = lazy(() => import('./fishtail/FishtailModule'));

const SHIP_CATEGORIES = [
  "Destroyer", "Frigate", "Corvette", "OPVs", "NOPVs", 
  "Aircraft Carriers", "LSTs", "Tankers", "Research Vessels", 
  "Training Ships", "Submarine"
];

const WHEEL_OPTIONS = [5, 10, 15, 20, 25];
const SPEED_OPTIONS = [8, 12, 15, 18, 20];
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
    if (Array.isArray(parsed)) return parsed;
  } catch { /* corrupt or unavailable storage: fall back to seed data */ }
  return INITIAL_SHIPS;
};

const App: React.FC = () => {
  const [ships, setShips] = useState<Ship[]>(loadShips);
  const [theme, setTheme] = useState<Theme>(loadTheme);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const [newShipName, setNewShipName] = useState('');
  const [newShipType, setNewShipType] = useState(SHIP_CATEGORIES[0]);

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

  // Tools State
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedShip = ships.find(s => s.id === selectedShipId);

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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTool, isToolsOpen]);

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

  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      const matchesSearch = ship.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           ship.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = !activeFilter || ship.type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [ships, searchQuery, activeFilter]);

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
    setView('home');
  };

  const deleteShip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this vessel from inventory?')) {
      setShips(prev => prev.filter(s => s.id !== id));
      if (selectedShipId === id) setSelectedShipId(null);
    }
  };

  const handleUpdateTurningRow = (id: string, field: keyof TurningDataRow, value: any) => {
    setLocalTurningData(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updatedRow = { ...row, [field]: value };
      
      if (field === 'bearingMob') updatedRow.angle = parseFloat(value) || 0;
      if (field === 'rangeCables') updatedRow.rangeYards = (parseFloat(value) || 0) * 200;
      
      const rad = (updatedRow.angle * Math.PI) / 180;
      updatedRow.advance = updatedRow.rangeYards * Math.cos(rad);
      updatedRow.transfer = updatedRow.rangeYards * Math.sin(rad);
      
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
                  {SPEED_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setFormSpeed(opt)} className={`py-2 rounded-xl text-sm font-bold border transition-all ${formSpeed === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Wheel Angle</label>
                <div className="grid grid-cols-3 gap-2">
                  {WHEEL_OPTIONS.map(opt => (
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
                    <th className="px-3 py-4 border-b text-center">Speed</th>
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
                          {PREFILLED_TURN_AMOUNTS.map(v => <option key={v} value={v}>{v}°</option>)}
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
                      <td className="px-3 py-2 border-r border-slate-100 text-slate-900 font-bold text-center">{row.transfer.toFixed(2)}</td>
                      <td className="px-3 py-2 border-r border-slate-100 text-slate-900 font-bold text-center">{row.advance.toFixed(2)}</td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                         <input type="number" value={row.distToNewCourse || ''} onChange={(e) => handleUpdateTurningRow(row.id, 'distToNewCourse', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="0" />
                      </td>
                      <td className="px-1 py-1 border-r border-slate-100 bg-yellow-50/30">
                         <input type="text" value={row.time} onChange={(e) => handleUpdateTurningRow(row.id, 'time', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="MM:SS" />
                      </td>
                      <td className="px-1 py-1 bg-yellow-50/30">
                         <input type="text" value={row.speed} onChange={(e) => handleUpdateTurningRow(row.id, 'speed', e.target.value)} className="w-full p-2 bg-white/60 border border-transparent focus:border-blue-300 outline-none text-center font-bold text-slate-950 rounded" placeholder="--" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <button onClick={openFishtailCalc} aria-label="Open Fishtail calculator with this vessel's turning data" title="Fishtail calculator" className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><Compass size={20} /></button>
            <button onClick={() => setView('particulars_form')} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Settings size={20} /></button>
          </div>
        </header>
        
        <div className="p-4 md:max-w-4xl md:mx-auto space-y-6">
          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Ruler size={20} className="text-blue-500" /> Ship Particulars</h2>
              <button onClick={() => aiGenerateParticulars(selectedShip)} className="flex items-center gap-2 text-xs font-bold bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-200 disabled:opacity-50" disabled={loading}><Sparkles size={14} /> {loading ? 'Estimating...' : 'AI Suggest Data'}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {[
                { l: 'Length Overall', v: selectedShip.particulars.lengthOverall, u: 'm' },
                { l: 'Breadth Overall', v: selectedShip.particulars.breadthOverall, u: 'm' },
                { l: 'Displacement', v: selectedShip.particulars.displacement, u: 'tons' },
                { l: 'Stem to Standard', v: selectedShip.particulars.stemToStandard, u: 'm' },
                { l: 'Stem to Bridge', v: selectedShip.particulars.stemToBridge, u: 'm' },
                { l: 'Stem to RAS Point', v: selectedShip.particulars.stemToRas, u: 'm' },
                { l: 'Stem to Fueling Point', v: selectedShip.particulars.stemToFueling, u: 'm' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0"><span className="text-slate-500 text-sm font-medium">{item.l}</span><span className="font-bold text-slate-950">{item.v} {item.u}</span></div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Navigation size={20} className="text-green-500" />
                <h2 className="text-lg font-bold text-slate-800">Turning Circle Profile</h2>
              </div>
              <div className="flex items-center gap-3">
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
                    {SPEED_OPTIONS.map(o => <option key={o} value={o}>{o} kts</option>)}
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
                    {WHEEL_OPTIONS.map(o => <option key={o} value={o}>{o}°</option>)}
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
                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <Plus size={20} />
                </button>
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
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailCard title="Acceleration and Deceleration data" icon={<Activity className="text-orange-500" />} items={selectedShip.accelDecelData} onAdd={() => openRecordForm('accelDecelData')} onEdit={(item) => openRecordForm('accelDecelData', item)} onDelete={(id) => deleteRecord(selectedShip.id, 'accelDecelData', id)} />
            <DetailCard title="Fishtails" icon={<Wind className="text-cyan-500" />} items={selectedShip.fishtails} onAdd={() => openRecordForm('fishtails')} onEdit={(item) => openRecordForm('fishtails', item)} onDelete={(id) => deleteRecord(selectedShip.id, 'fishtails', id)} />
            <DetailCard title="EM Log Calibration" icon={<Settings className="text-indigo-500" />} items={selectedShip.emLogCalibration} onAdd={() => openRecordForm('emLogCalibration')} onEdit={(item) => openRecordForm('emLogCalibration', item)} onDelete={(id) => deleteRecord(selectedShip.id, 'emLogCalibration', id)} />
            <DetailCard title="Compass Swing" icon={<Compass className="text-amber-500" />} items={selectedShip.compassSwing} onAdd={() => openRecordForm('compassSwing')} onEdit={(item) => openRecordForm('compassSwing', item)} onDelete={(id) => deleteRecord(selectedShip.id, 'compassSwing', id)} />
          </div>
        </div>
      </div>
    );
  };

  const openFishtailCalc = () => {
    if (selectedShip) syncShipToFishtail(selectedShip);
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

  const handleExport = async () => {
    try { await exportBackup(ships); } catch (err) { alert(`Export failed: ${err instanceof Error ? err.message : err}`); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { ships: imported, fishtailDb } = parseBackup(await file.text());
      if (!confirm(`Restore ${imported.length} vessel(s) from "${file.name}"? This replaces all ${ships.length} vessel(s) currently in the app.`)) return;
      setShips(imported);
      if (fishtailDb) restoreFishtailDb(fishtailDb);
      if (selectedShipId && !imported.some(s => s.id === selectedShipId)) setSelectedShipId(null);
    } catch (err) {
      alert(`Restore failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const renderHome = () => (
    <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto pb-24">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Cursed Pilot</h1>
          <div className="flex items-center gap-3">
            <button onClick={cycleTheme} aria-label={`Theme: ${THEME_LABEL[theme]}. Tap to change`} title={`Theme: ${THEME_LABEL[theme]}`} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-2xl text-slate-600 text-xs font-bold shadow-sm active:scale-95 transition-all">
              {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Eye size={16} />}
              {THEME_LABEL[theme]}
            </button>
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-xl shadow-blue-200">
              <Anchor size={24} />
            </div>
          </div>
        </div>
        <p className="text-slate-500 font-semibold tracking-wide">Long ND made Short</p>
        
        {/* Module 1: Dropdown Selection */}
        <div className="mt-4 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Select Ship Registry</label>
          <div className="relative">
            <select 
              value={selectedShipId || ""}
              onChange={(e) => {
                setSelectedShipId(e.target.value);
                if (e.target.value) setView('details');
              }}
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none appearance-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            >
              <option value="" disabled>--- Choose a Vessel ---</option>
              {ships.map(ship => (
                <option key={ship.id} value={ship.id}>{ship.name} ({ship.type})</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Action Grid matching request */}
        <button onClick={() => setView('select')} className="flex items-center justify-between p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Search size={24} /></div>
            <div><h3 className="font-bold text-slate-800">Fleet Inventory</h3><p className="text-sm text-slate-400">Search & Select ship</p></div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
        </button>

        {/* Module 2: Add Ship */}
        <button onClick={() => setView('add')} className="flex items-center justify-between p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:bg-green-600 group-hover:text-white transition-colors"><PlusCircle size={24} /></div>
            <div><h3 className="font-bold text-slate-800">Add Ship</h3><p className="text-sm text-slate-400">Register new vessel</p></div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-green-500 transition-colors" />
        </button>

        {/* Module 3: Add/Update Ship Particulars */}
        <button 
          onClick={() => {
            if (selectedShipId) setView('particulars_form');
            else setView('select');
          }} 
          className="flex items-center justify-between p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors"><Ruler size={24} /></div>
            <div><h3 className="font-bold text-slate-800">Ship Particulars</h3><p className="text-sm text-slate-400">Update vessel dimensions</p></div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-amber-500 transition-colors" />
        </button>

        {/* Module: Fishtail calculator */}
        <button
          onClick={openFishtailCalc}
          className="flex items-center justify-between p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Compass size={24} /></div>
            <div><h3 className="font-bold text-slate-800">Fishtail Calculator</h3><p className="text-sm text-slate-400">Plan and solve fishtail manoeuvres</p></div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
        </button>

        {/* Module: Fishtail records */}
        <button
          onClick={() => openRecordForm('fishtails')}
          className="flex items-center justify-between p-5 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-2xl group-hover:bg-cyan-600 group-hover:text-white transition-colors"><Wind size={24} /></div>
            <div><h3 className="font-bold text-slate-800">Fishtail Records</h3><p className="text-sm text-slate-400">Log a fishtail manoeuvre</p></div>
          </div>
          <ChevronRight className="text-slate-300 group-hover:text-cyan-500 transition-colors" />
        </button>

        {/* Module 4: Backup / Restore */}
        <div className="grid grid-cols-2 gap-4">
          <button onClick={handleExport} className="flex items-center gap-3 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Download size={20} /></div>
            <div><h3 className="font-bold text-slate-800 text-sm">Export</h3><p className="text-xs text-slate-400">Save backup file</p></div>
          </button>
          <label className="flex items-center gap-3 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] text-left cursor-pointer">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl"><Upload size={20} /></div>
            <div><h3 className="font-bold text-slate-800 text-sm">Restore</h3><p className="text-xs text-slate-400">Load backup file</p></div>
            <input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
           <Activity size={20} className="text-blue-500" /> Recent Activity
        </h2>
        <div className="space-y-3">
          {ships.slice(-3).reverse().map(ship => (
            <div key={ship.id} onClick={() => { setSelectedShipId(ship.id); setView('details'); }} className={`p-4 rounded-2xl flex items-center gap-4 border transition-all cursor-pointer ${selectedShipId === ship.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
               <ShipIcon className={selectedShipId === ship.id ? 'text-blue-500' : 'text-slate-400'} size={20} />
               <div className="flex-1">
                 <p className="font-bold text-slate-800">{ship.name}</p>
                 <p className="text-xs text-slate-400 font-medium">{ship.type}</p>
               </div>
               {selectedShipId === ship.id ? (
                 <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-full uppercase tracking-wider font-bold">Current</span>
               ) : (
                 <span className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-full uppercase tracking-wider text-slate-400 font-bold">Active</span>
               )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSelectShip = () => (
    <div className="p-6 pb-24 max-w-xl mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
        <h1 className="text-2xl font-bold text-slate-800">Fleet Inventory</h1>
      </header>
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Search size={18} className="text-slate-400" /></div>
        <input type="text" placeholder="Search ships..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm" />
      </div>
      <div className="space-y-3">
        {filteredShips.map(ship => (
          <div key={ship.id} className="group relative">
            <button onClick={() => { setSelectedShipId(ship.id); setView('details'); }} className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-blue-400 transition-all shadow-sm active:scale-[0.98]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-600"><ShipIcon size={24} /></div>
                <div><h3 className="font-bold text-slate-800">{ship.name}</h3><p className="text-sm text-slate-400">{ship.type}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => deleteShip(ship.id, e)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                <ChevronRight className="text-slate-300" />
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddShip = () => (
    <div className="p-6 max-w-xl mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
        <h1 className="text-2xl font-bold text-slate-800">Add Ship</h1>
      </header>
      <form onSubmit={handleAddShip} className="space-y-6">
        <div><label className="text-sm font-bold text-slate-500 ml-1">Vessel Name</label><input autoFocus type="text" value={newShipName} onChange={(e) => setNewShipName(e.target.value)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100" /></div>
        <div><label className="text-sm font-bold text-slate-500 ml-1">Type</label><select value={newShipType} onChange={(e) => setNewShipType(e.target.value)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none appearance-none">{SHIP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <button type="submit" className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Register Vessel</button>
      </form>
    </div>
  );

  const renderParticularsForm = () => {
    if (!selectedShip) return null;
    return (
      <div className="p-6 pb-24 max-w-xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-700" /></button>
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
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 border-t border-slate-200 backdrop-blur-sm"><button onClick={() => setView('details')} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg">Save Changes</button></div>
      </div>
    );
  };

  const updateParticulars = (id: string, particulars: ShipParticulars) => setShips(prev => prev.map(s => s.id === id ? { ...s, particulars } : s));
  const aiGenerateParticulars = async (ship: Ship) => { setLoading(true); const data = await generateSmartParticulars(ship.name, ship.type); if (data) updateParticulars(ship.id, data); setLoading(false); };

  // TOOLS INTERFACE
  const renderTools = () => {
    if (!isToolsOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Navigator's Tools</h3>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Virtual Assistant
                </div>
              </div>
            </div>
            <button onClick={() => setIsToolsOpen(false)} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                <Compass size={16} />
              </div>
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none max-w-[80%]">
                <p className="text-sm text-slate-800 font-medium">Hello! I'm your maritime assistant. Which utility do you need to calculate today?</p>
              </div>
            </div>

            {activeTool && (
              <div className="flex flex-col items-end gap-3">
                <div className="bg-blue-600 p-4 rounded-2xl rounded-tr-none max-w-[80%] text-white shadow-md shadow-blue-100">
                  <p className="text-sm font-bold">{activeTool}</p>
                </div>
                <div className="w-full">
                  {(() => { const Tool = NAV_TOOLS.find(t => t.name === activeTool)?.Component; return Tool ? <Tool ship={selectedShip} /> : null; })()}
                  <button onClick={() => setActiveTool(null)} className="mt-2 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                    <RefreshCcw size={12} /> Select another tool
                  </button>
                </div>
              </div>
            )}

            {!activeTool && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {NAV_TOOLS.map(tool => (
                  <button 
                    key={tool.name}
                    onClick={() => setActiveTool(tool.name)}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">{tool.icon}</div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">{tool.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{tool.desc}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                  </button>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-50 bg-slate-50/50">
             <div className="flex items-center gap-2 p-2 px-4 bg-white rounded-full border border-slate-200">
               <input disabled type="text" placeholder="Ready to calculate..." className="flex-1 bg-transparent border-none text-xs font-medium focus:ring-0" />
               <button disabled className="p-2 text-blue-600/30">
                 <Send size={16} />
               </button>
             </div>
          </div>
        </div>
      </div>
    );
  };

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
      {view === 'fishtail_calc' && (
        <div className="original-palette fixed inset-0 z-40 bg-slate-950 text-slate-50">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold uppercase tracking-widest">Loading calculator...</div>}>
            <FishtailModule isModule onExit={() => setView(selectedShipId ? 'details' : 'home')} />
          </Suspense>
        </div>
      )}

      {/* Floating Tools Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button 
          onClick={() => setIsToolsOpen(!isToolsOpen)}
          className={`group flex items-center gap-2 p-4 rounded-3xl shadow-2xl shadow-blue-400/30 transition-all active:scale-95 ${isToolsOpen ? 'bg-slate-900 text-white dark:bg-black dark:border dark:border-slate-300' : 'bg-blue-600 text-white'}`}
        >
          {isToolsOpen ? <X size={24} /> : (
            <>
              <MessageSquare size={24} />
              <span className="font-bold text-sm pr-2">Tools</span>
            </>
          )}
        </button>
      </div>

      {renderTools()}
    </div>
  );
};

const DetailCard: React.FC<{ title: string, icon: React.ReactNode, items: any[], onAdd?: () => void, onEdit?: (item: any) => void, onDelete?: (id: string) => void }> = ({ title, icon, items, onAdd, onEdit, onDelete }) => (
  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
    <div className="flex items-center gap-2 mb-4">{icon}<h3 className="font-bold text-slate-800">{title}</h3>
      {onAdd && <button onClick={onAdd} aria-label={`Add ${title} record`} className="ml-auto p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16} /></button>}
    </div>
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
  </div>
);

const ParticularField: React.FC<{ label: string, value: number, onChange: (val: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-slate-500 ml-1 uppercase">{label}</label>
    <input type="number" value={value || ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none font-bold text-slate-950 focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
  </div>
);

export default App;
