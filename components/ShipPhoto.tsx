import React, { useEffect, useState } from 'react';
import { Ship as ShipIcon } from 'lucide-react';
import { Ship } from '../types';
import { ShipWiki } from '../services/shipLookup';

/** The ship's own photo, else the Wikipedia picture, else a plain placeholder. Children are drawn over the picture. */
const ShipPhoto: React.FC<{ ship: Ship; wiki: ShipWiki | null; className?: string; children?: React.ReactNode }> = ({ ship, wiki, className = '', children }) => {
  const src = ship.photo || wiki?.image;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      {src && !broken ? (
        <img src={src} alt={ship.name} loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
          <ShipIcon size={44} strokeWidth={1.25} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{ship.type}</span>
        </div>
      )}
      {children}
    </div>
  );
};

export default ShipPhoto;
