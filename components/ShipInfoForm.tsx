import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CustomField, Ship, ShipInfo } from '../types';
import { CATEGORIES } from '../data/fleet';
import { fieldsOf, tidy, withGroup } from '../data/customFields';
import CustomFieldsEditor from './CustomFieldsEditor';

const EMPTY: ShipInfo = {
  shipClass: '', pennant: '', builder: '', commissioned: '', status: '', displacement: '', length: '', beam: '', draught: '', speed: '',
  propulsion: '', complement: '', armament: '', sensors: '', aircraft: '', notes: '', wiki: '',
};

const FIELDS: { key: keyof ShipInfo; label: string; hint?: string; long?: boolean; half?: boolean }[] = [
  { key: 'shipClass', label: 'Class' },
  { key: 'pennant', label: 'Pennant', half: true, hint: 'D63' },
  { key: 'commissioned', label: 'Commissioned', half: true, hint: '2014-08 or 16 Aug 2014' },
  { key: 'builder', label: 'Builder' },
  { key: 'status', label: 'Status', hint: 'In service' },
  { key: 'displacement', label: 'Displacement', half: true },
  { key: 'speed', label: 'Speed', half: true },
  { key: 'length', label: 'Length', half: true },
  { key: 'beam', label: 'Beam', half: true },
  { key: 'draught', label: 'Draught', half: true },
  { key: 'complement', label: 'Complement', half: true },
  { key: 'propulsion', label: 'Propulsion', long: true },
  { key: 'armament', label: 'Armament', long: true },
  { key: 'sensors', label: 'Sensors', long: true },
  { key: 'aircraft', label: 'Aircraft', long: true },
  { key: 'notes', label: 'Notes', long: true },
  { key: 'wiki', label: 'Wikipedia articles (picture and description)', hint: 'INS_Kolkata_(D63), Kolkata-class_destroyer' },
];

/** Edits everything descriptive about a ship, including the pre-filled catalogue values. */
const ShipInfoForm: React.FC<{ ship: Ship; onSave: (patch: { name: string; type: string; info: ShipInfo; custom: CustomField[] }) => void; onCancel: () => void }> = ({ ship, onSave, onCancel }) => {
  const [name, setName] = useState(ship.name);
  const [type, setType] = useState(ship.type);
  const [info, setInfo] = useState<ShipInfo>({ ...EMPTY, ...ship.info });
  const [extra, setExtra] = useState(() => fieldsOf(ship, 'details'));
  const input = 'w-full p-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-semibold text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-50';
  const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1';

  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave({ name: name.trim(), type, info, custom: withGroup(ship, 'details', tidy(extra)) }); }} className="p-6 pb-28 max-w-xl mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <button type="button" onClick={onCancel} aria-label="Back" className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={24} className="text-slate-700" /></button>
        <div><h1 className="text-2xl font-bold text-slate-800 leading-tight">Edit details</h1><p className="text-xs text-slate-400 font-medium">{ship.name}</p></div>
      </header>
      <p className="text-xs text-slate-400 font-medium mb-5">Pre-filled from public sources and may be out of date. Correct anything; your changes are kept.</p>

      <div className="space-y-4">
        <div className="space-y-1"><label className={label}>Name</label><input required value={name} onChange={e => setName(e.target.value)} className={input} /></div>
        <div className="space-y-1">
          <label className={label}>Category</label>
          <select value={type} onChange={e => setType(e.target.value)} className={input + ' appearance-none'}>
            {[...new Set([...CATEGORIES, type])].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key} className={`space-y-1 ${f.half ? '' : 'col-span-2'}`}>
              <label className={label}>{f.label}</label>
              {f.long
                ? <textarea rows={2} value={info[f.key]} onChange={e => setInfo({ ...info, [f.key]: e.target.value })} className={input + ' resize-none font-medium'} />
                : <input value={info[f.key]} placeholder={f.hint} onChange={e => setInfo({ ...info, [f.key]: e.target.value })} className={input} />}
            </div>
          ))}
        </div>
        <CustomFieldsEditor title="Additional details" note="Your own headings and notes, such as call sign, motto or refit dates. They are shown with her details and included in exports." group="details" fields={extra} onChange={setExtra} addLabel="Add a heading" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200">
        <button type="submit" className="w-full max-w-xl mx-auto block bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Save</button>
      </div>
    </form>
  );
};

export default ShipInfoForm;
