import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CustomField } from '../types';
import { Group, newField } from '../data/customFields';

interface Props {
  title: string;
  note?: string;
  group: Group;
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  addLabel: string;
}

const input = 'w-full p-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-semibold text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-50';

/** Rows of the user's own headings and values: particulars (heading, value, unit) or details (heading, text). */
const CustomFieldsEditor: React.FC<Props> = ({ title, note, group, fields, onChange, addLabel }) => {
  const update = (id: string, patch: Partial<CustomField>) => onChange(fields.map(f => (f.id === id ? { ...f, ...patch } : f)));
  const particulars = group === 'particulars';

  return (
    <section className="space-y-3 pt-2" aria-label={title}>
      <div>
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        {note && <p className="text-xs text-slate-400 font-medium mt-0.5">{note}</p>}
      </div>

      {fields.map((f, i) => (
        <div key={f.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <input aria-label={`${title} ${i + 1} heading`} placeholder="Heading" value={f.label} onChange={e => update(f.id, { label: e.target.value })} className={`${input} flex-1 min-w-0`} />
            <button type="button" onClick={() => onChange(fields.filter(x => x.id !== f.id))} aria-label={`Remove ${f.label || 'this row'}`} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
          </div>
          {particulars ? (
            <div className="flex gap-2">
              <input aria-label={`${title} ${i + 1} value`} placeholder="Value" inputMode="decimal" value={f.value} onChange={e => update(f.id, { value: e.target.value })} className={`${input} flex-1 min-w-0`} />
              <input aria-label={`${title} ${i + 1} unit`} placeholder="Unit" value={f.unit ?? ''} onChange={e => update(f.id, { unit: e.target.value })} className={`${input} w-24 shrink-0`} />
            </div>
          ) : (
            <textarea aria-label={`${title} ${i + 1} value`} placeholder="Details" rows={2} value={f.value} onChange={e => update(f.id, { value: e.target.value })} className={`${input} resize-none font-medium`} />
          )}
        </div>
      ))}

      <button type="button" onClick={() => onChange([...fields, newField(group)])} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-xs font-bold text-blue-600 hover:border-blue-300 active:scale-[0.99] transition-all">
        <Plus size={16} /> {addLabel}
      </button>
    </section>
  );
};

export default CustomFieldsEditor;
