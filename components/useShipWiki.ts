import { useEffect, useState } from 'react';
import { Ship } from '../types';
import { getCachedWiki, isStale, lookupShip, ShipWiki } from '../services/shipLookup';

/**
 * The cached Wikipedia picture and description for a ship, refreshed in the background when online.
 * `state` is 'loading' during a lookup and 'none' when online but nothing suitable was found.
 */
export function useShipWiki(ship: Ship | undefined) {
  const [wiki, setWiki] = useState<ShipWiki | null>(() => (ship ? getCachedWiki(ship.id) : null));
  const [state, setState] = useState<'idle' | 'loading' | 'none'>('idle');

  useEffect(() => {
    if (!ship) { setWiki(null); setState('idle'); return; }
    const cached = getCachedWiki(ship.id);
    setWiki(cached);
    setState('idle');
    if (!isStale(cached) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    let alive = true;
    setState('loading');
    lookupShip(ship).then(w => {
      if (!alive) return;
      if (w) setWiki(w);
      setState(w || cached ? 'idle' : 'none');
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ship?.id, ship?.info?.wiki]);

  return { wiki, state };
}
