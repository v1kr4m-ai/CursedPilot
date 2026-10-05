import React from 'react';
import { TOOL_INFO } from '../tools/toolInfo';

/** The concept, method, formulas and limits behind a NavYeo tool. */
const ToolInfoCard: React.FC<{ name: string }> = ({ name }) => {
  const info = TOOL_INFO[name];
  if (!info) return null;
  const h = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5';
  return (
    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-4 text-slate-700" role="region" aria-label={`How ${name} works`}>
      <section><h4 className={h}>Concept</h4><p className="text-[13px] leading-relaxed">{info.concept}</p></section>
      <section>
        <h4 className={h}>How it is calculated</h4>
        <ol className="list-decimal pl-4 space-y-1.5 text-[13px] leading-relaxed marker:font-bold marker:text-blue-600">
          {info.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </section>
      <section>
        <h4 className={h}>Formulas</h4>
        <div className="font-mono text-[12px] leading-relaxed bg-white border border-blue-100 rounded-xl p-3 space-y-1 text-slate-800 break-words">
          {info.formulas.map((f, i) => <div key={i}>{f}</div>)}
        </div>
      </section>
      <section>
        <h4 className={h}>Assumptions and limits</h4>
        <ul className="list-disc pl-4 space-y-1.5 text-[13px] leading-relaxed marker:text-amber-500">
          {info.limits.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
};

export default ToolInfoCard;
