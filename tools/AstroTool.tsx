import React from 'react';
import { Ship } from '../types';
import { useMemory } from './kit';
import { SunRunMerpassTool, SunRunSunTool } from './SunTools';
import { FourStarTool } from './StarTools';
import { PolarisTool, RiseSetTool } from './AstroExtras';

// ASTRO: the astronomical tools in one place. NavYeo's typed commands still name the old tools; ASTRO_TABS says which tab each opens.

const TABS = [
  { key: 'srs', label: 'SRS', Component: SunRunSunTool },
  { key: 'srm', label: 'SRM', Component: SunRunMerpassTool },
  { key: 'star', label: '4 Star Fix', Component: FourStarTool },
  { key: 'polaris', label: 'Polaris', Component: PolarisTool },
  { key: 'riseset', label: 'Rise & Set', Component: RiseSetTool },
] as const;

export const ASTRO_TABS: Record<string, string> = {
  'Sun Run Sun (SRS)': 'srs', 'Sun Run Merpass (SRM)': 'srm', 'Four Star Fix': 'star', 'Polaris Latitude': 'polaris', 'Rise, Set and Twilight': 'riseset',
};

export const AstroTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [tab, setTab] = useMemory<string>('astro:tab', 'srs');
  const cur = TABS.find(t => t.key === tab) ?? TABS[0];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Astro tools">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={cur.key === t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border ${cur.key === t.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{t.label}</button>
        ))}
      </div>
      <cur.Component ship={ship} />
    </div>
  );
};
