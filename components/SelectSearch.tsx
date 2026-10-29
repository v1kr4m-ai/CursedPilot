import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useBackLayer } from '../services/backButton';
import { filterItems } from './selectFilter';
import type { Item } from './selectFilter';

// Every drop-down in the app opens as a list with a search box: type a few letters and only the matching items are shown. It works on the
// page's own <select> elements, so no tool needs changing: the choice is put back into the select and a change event tells React, exactly as
// if it had been picked from the phone's own list. A select marked data-native keeps the phone's list.

const SEARCH_FROM = 8;   // a short list (units, sides) is shown without a search box

/** The items of a select, in order, with their option group. */
const itemsOf = (s: HTMLSelectElement): Item[] => Array.from(s.options).map(o => ({
  value: o.value, text: o.text.trim(), disabled: o.disabled, group: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : '',
}));

const labelOf = (s: HTMLSelectElement) => s.getAttribute('aria-label') ?? s.closest('label')?.querySelector('span')?.textContent ?? s.closest('label')?.textContent?.replace(s.textContent ?? '', '').trim() ?? '';

export default function SelectSearch() {
  const [sel, setSel] = useState<HTMLSelectElement | null>(null);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const close = () => setSel(null);
  useBackLayer(sel !== null, close, 2);

  useEffect(() => {
    const target = (e: Event) => {
      const s = (e.target as Element | null)?.closest?.('select');
      return s instanceof HTMLSelectElement && !s.disabled && !s.multiple && s.dataset.native === undefined ? s : null;
    };
    const block = (e: Event) => { if (target(e)) e.preventDefault(); };             // the phone's own list must not open as well
    const open = (e: Event) => { const s = target(e); if (!s) return; e.preventDefault(); setQuery(''); setSel(s); };
    document.addEventListener('mousedown', block, true);
    document.addEventListener('click', open, true);
    return () => { document.removeEventListener('mousedown', block, true); document.removeEventListener('click', open, true); };
  }, []);

  const items = useMemo(() => (sel ? itemsOf(sel) : []), [sel]);
  const shown = useMemo(() => filterItems(items, query), [items, query]);
  useEffect(() => { if (sel && items.length > SEARCH_FROM) search.current?.focus(); }, [sel, items.length]);
  useEffect(() => { if (sel && !query) document.querySelector('[data-picked="true"]')?.scrollIntoView({ block: 'center' }); }, [sel, query]);

  if (!sel) return null;
  const pick = (value: string) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, value);   // the native setter, so React sees the change
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const title = labelOf(sel);
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={close}>
      <div role="dialog" aria-label={title || 'Choose'} className="w-full max-w-md max-h-[75vh] flex flex-col bg-white rounded-t-[2rem] shadow-2xl p-4 gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-900 truncate">{title || 'Choose'}</h3>
          <button onClick={close} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full shrink-0"><X size={18} /></button>
        </div>
        {items.length > SEARCH_FROM && (
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input ref={search} value={query} onChange={e => setQuery(e.target.value)} placeholder="Type to search" aria-label="Search the list"
              onKeyDown={e => { if (e.key === 'Enter' && shown[0] && !shown[0].disabled) pick(shown[0].value); }}
              className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-900 outline-none" />
          </label>
        )}
        <div role="listbox" className="overflow-y-auto -mx-1 px-1">
          {shown.length === 0 && <p className="text-sm text-slate-400 font-medium py-4 text-center">Nothing matches “{query}”.</p>}
          {shown.map((i, k) => {
            const head = !query && i.group && i.group !== lastGroup ? i.group : '';
            lastGroup = i.group;
            const picked = i.value === sel.value;
            return (
              <React.Fragment key={`${i.value}${k}`}>
                {head && <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-3 pb-1 px-2">{head}</p>}
                <button role="option" aria-selected={picked} data-picked={picked} disabled={i.disabled} onClick={() => pick(i.value)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 ${picked ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span>{i.text}{query && i.group ? <span className="text-slate-400 font-medium"> · {i.group}</span> : null}</span>
                  {picked && <Check size={16} className="shrink-0" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
