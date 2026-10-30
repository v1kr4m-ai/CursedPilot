import React from 'react';
import { Ship } from '../types';
import { useMemory } from './kit';
import { SunRunMerpassTool, SunRunSunTool } from './SunTools';
import { FourStarTool } from './StarTools';
import { PolarisTool, RiseSetTool } from './AstroExtras';
import { TabBar } from './TabBar';

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
    <div className="space-y-2">
      <TabBar id="astro" tabs={TABS.map(t => t.key)} labels={Object.fromEntries(TABS.map(t => [t.key, t.label]))} value={cur.key} onChange={setTab} label="Astro tools" />
      <cur.Component ship={ship} />
    </div>
  );
};
