
import React, { useMemo, useState } from 'react';
import { TurningDataPoint, SideOfTurn } from '../types';
import { Trash2, AlertCircle, Table as TableIcon, ChevronRight, ChevronDown, Download, Edit3, Filter, X } from 'lucide-react';
import EditTableModal from './EditTableModal';
import * as XLSX from 'xlsx';

interface TurningDataTableProps {
  data: TurningDataPoint[];
  onClear: () => void;
  onUpdateTable: (oldKey: string, metadata: { tableName: string; ownSpeed: number; rudder: string; side: SideOfTurn }, points: TurningDataPoint[]) => void;
  onDeleteTable: (key: string) => void;
}

const TurningDataTable: React.FC<TurningDataTableProps> = ({ data, onClear, onUpdateTable, onDeleteTable }) => {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingTableKey, setEditingTableKey] = useState<string | null>(null);

  // Filter States
  const [filterSpeed, setFilterSpeed] = useState<string>('');
  const [filterRudder, setFilterRudder] = useState<string>('');
  const [filterSide, setFilterSide] = useState<string>('');

  const toggleTable = (id: string) => {
    const next = new Set(expandedTables);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTables(next);
  };

  const uniqueFilterOptions = useMemo(() => {
    const speeds = new Set<number>();
    const rudders = new Set<string>();
    data.forEach(d => {
      speeds.add(d.ownSpeed);
      rudders.add(d.rudder);
    });
    return {
      speeds: Array.from(speeds).sort((a, b) => a - b),
      rudders: Array.from(rudders).sort()
    };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (filterSpeed && d.ownSpeed.toString() !== filterSpeed) return false;
      if (filterRudder && d.rudder !== filterRudder) return false;
      if (filterSide && d.side !== filterSide) return false;
      return true;
    });
  }, [data, filterSpeed, filterRudder, filterSide]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, { name: string, points: TurningDataPoint[], speed: number, rudder: string, side: SideOfTurn }> = {};
    filteredData.forEach(d => {
      const key = `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;
      if (!groups[key]) {
        groups[key] = { 
          name: d.tableName || "Unnamed Table", 
          points: [], 
          speed: d.ownSpeed, 
          rudder: d.rudder, 
          side: d.side 
        };
      }
      groups[key].points.push(d);
    });
    return groups;
  }, [filteredData]);

  const handleExportCSV = (key: string) => {
    const group = groupedTables[key];
    if (!group) return;

    const exportData = group.points.sort((a, b) => a.heading - b.heading).map(p => ({
      'Heading (deg)': p.heading,
      'Advance (yds)': p.advance,
      'Transfer (yds)': p.transfer,
      'Time (sec)': p.time,
      'Speed (kts)': p.ownSpeed,
      'Rudder (deg)': p.rudder,
      'Side': p.side.toUpperCase()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = `${group.name.replace(/\s+/g, '_')}_TacticalData.csv`;

    triggerDownload(blob, fileName);
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    try {
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
        } catch (err) {
          console.warn("Single table download fallback", err);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 500);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error("Downloader failure", err);
    }
  };

  const clearFilters = () => {
    setFilterSpeed('');
    setFilterRudder('');
    setFilterSide('');
  };

  if (data.length === 0) {
    return (
      <div className="glass rounded-3xl p-16 text-center border-2 border-dashed border-slate-800">
        <AlertCircle className="w-12 h-12 text-slate-800 mx-auto mb-4" />
        <h3 className="text-xl font-black text-slate-500 uppercase">Library Offline</h3>
        <p className="text-slate-600 text-sm mt-2">No tactical performance tables detected in memory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
          <Filter className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
        </div>
        
        <select 
          value={filterSpeed}
          onChange={(e) => setFilterSpeed(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]"
        >
          <option value="">All Speeds</option>
          {uniqueFilterOptions.speeds.map(s => <option key={s} value={s}>{s} kts</option>)}
        </select>

        <select 
          value={filterRudder}
          onChange={(e) => setFilterRudder(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]"
        >
          <option value="">All Rudders</option>
          {uniqueFilterOptions.rudders.map(r => <option key={r} value={r}>{r}° Rudder</option>)}
        </select>

        <select 
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]"
        >
          <option value="">All Sides</option>
          <option value={SideOfTurn.STARBOARD}>Starboard Only</option>
          <option value={SideOfTurn.PORT}>Port Only</option>
        </select>

        {(filterSpeed || filterRudder || filterSide) && (
          <button 
            onClick={clearFilters}
            className="flex items-center gap-1 text-red-500 text-[10px] font-black uppercase hover:opacity-70 ml-auto"
          >
            <X className="w-3 h-3" /> Reset Filters
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">
          Saved Tactical Tables <span className="text-blue-500 ml-2">({Object.keys(groupedTables).length})</span>
        </h3>
        <button onClick={onClear} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-2">
          <Trash2 className="w-3 h-3" /> Delete All Data
        </button>
      </div>

      {Object.keys(groupedTables).length === 0 ? (
        <div className="p-12 text-center text-slate-600 font-bold uppercase text-xs">
          No tables match your active filters.
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries<(typeof groupedTables)[string]>(groupedTables).map(([key, group]) => {
            const isExpanded = expandedTables.has(key);
            return (
              <div key={key} className="glass rounded-2xl border border-slate-800 overflow-hidden transition-all duration-300">
                <div className="flex items-center">
                  <button 
                    onClick={() => toggleTable(key)}
                    className="flex-1 px-6 py-5 bg-slate-900/50 flex items-center justify-between hover:bg-slate-900 transition-colors border-r border-slate-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${group.side === SideOfTurn.STARBOARD ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'}`}>
                        <TableIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-black text-sm uppercase tracking-tight">{group.name}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {group.speed} KTS • {group.rudder}° RUDDER • {group.side.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black text-slate-600 bg-slate-800/50 px-2 py-1 rounded-full uppercase">{group.points.length} Points</span>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    </div>
                  </button>
                  <div className="flex bg-slate-900/50 p-2 gap-1.5 pr-4 items-center">
                    {/* CSV */}
                    <div className="relative group">
                      <button 
                        onClick={() => handleExportCSV(key)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all active:scale-90"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 bg-slate-950/95 backdrop-blur border border-slate-805 p-1.5 rounded-lg text-[8px] w-24 text-center text-slate-300 shadow-xl font-bold uppercase tracking-wide leading-tight">
                        Export CSV
                      </div>
                    </div>

                    {/* EDIT */}
                    <div className="relative group">
                      <button 
                        onClick={() => setEditingTableKey(key)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-yellow-500 rounded-lg transition-all active:scale-90"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 bg-slate-950/95 backdrop-blur border border-slate-805 p-1.5 rounded-lg text-[8px] w-24 text-center text-slate-300 shadow-xl font-bold uppercase tracking-wide leading-tight">
                        Edit Curve
                      </div>
                    </div>

                    {/* DELETE */}
                    <div className="relative group">
                      <button 
                        onClick={() => { if(window.confirm('Delete this table?')) onDeleteTable(key); }}
                        className="p-2 bg-slate-800 hover:bg-red-500/10 text-red-500 rounded-lg transition-all active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 bg-slate-950/95 backdrop-blur border border-slate-805 p-1.5 rounded-lg text-[8px] w-24 text-center text-slate-300 shadow-xl font-bold uppercase tracking-wide leading-tight">
                        Delete Table
                      </div>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-slate-800 animate-in slide-in-from-top-1 duration-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-950 text-slate-600 uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-3">Heading (°)</th>
                            <th className="px-6 py-3">Advance (yds)</th>
                            <th className="px-6 py-3">Transfer (yds)</th>
                            <th className="px-6 py-3">Time (sec)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                          {group.points.sort((a, b) => a.heading - b.heading).map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/10">
                              <td className="px-6 py-3 font-black text-blue-400">{p.heading}°</td>
                              <td className="px-6 py-3 mono text-slate-300">{p.advance.toFixed(1)}</td>
                              <td className="px-6 py-3 mono text-slate-300">{p.transfer.toFixed(1)}</td>
                              <td className="px-6 py-3 text-slate-500">{p.time.toFixed(1)}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingTableKey && groupedTables[editingTableKey] && (
        <EditTableModal 
          tableKey={editingTableKey}
          tableName={groupedTables[editingTableKey].name}
          speed={groupedTables[editingTableKey].speed}
          rudder={groupedTables[editingTableKey].rudder}
          side={groupedTables[editingTableKey].side}
          points={groupedTables[editingTableKey].points}
          onClose={() => setEditingTableKey(null)}
          onSave={(metadata, points) => {
            onUpdateTable(editingTableKey, metadata, points);
            setEditingTableKey(null);
          }}
        />
      )}
    </div>
  );
};

export default TurningDataTable;
