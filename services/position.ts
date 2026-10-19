import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { circularMean, compassHeading } from '../tools/sensors';

export interface Fix { lat: number; lon: number; accuracyM: number; speedKn: number | null; courseDeg: number | null }

/** The phone's GPS position, asking for permission on the phone the first time. Rejects with a readable message. */
export async function getPosition(timeoutMs = 15000): Promise<Fix> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new Error('Location permission was not given. Allow it in the phone settings for this app.');
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs });
    const c = p.coords;
    return { lat: c.latitude, lon: c.longitude, accuracyM: c.accuracy, speedKn: c.speed == null || c.speed < 0 ? null : c.speed * 1.943844, courseDeg: c.heading == null || Number.isNaN(c.heading) ? null : c.heading };
  } catch (e) {
    const err = e as { message?: string; code?: number };     // the browser's GeolocationPositionError is not an Error
    const m = err?.message || String(e);
    throw new Error(err?.code === 1 || /denied|permission/i.test(m) ? 'Location is switched off or not allowed for this app.' : err?.code === 3 || /timeout|timed out/i.test(m) ? 'No GPS position yet. Try again with a clear view of the sky.' : err?.code === 2 ? 'The phone could not find its position.' : m);
  }
}

export interface Heading { heading: number; spreadDeg: number; samples: number }

/**
 * The phone's compass: averages the orientation readings over about a second and a half. It is a magnetic compass,
 * so it reads magnetic north and is thrown off by steel; on a ship check it against the ship's compass.
 */
export async function readCompass(ms = 1500): Promise<Heading> {
  if (typeof DeviceOrientationEvent === 'undefined') throw new Error('This phone has no compass sensor the app can read.');
  const Orient = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (Orient.requestPermission && (await Orient.requestPermission()) !== 'granted') throw new Error('Motion and compass access was not allowed.');
  return new Promise<Heading>((resolve, reject) => {
    const seen: number[] = [];
    let gotAbsolute = false;
    const onEvent = (e: Event) => {
      const o = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (e.type === 'deviceorientationabsolute') gotAbsolute = true;
      else if (gotAbsolute) return;                                     // an absolute reading is better than the relative one
      if (typeof o.webkitCompassHeading === 'number') seen.push(o.webkitCompassHeading);
      else if (o.alpha !== null && o.beta !== null && o.gamma !== null && (o.absolute || e.type === 'deviceorientationabsolute')) seen.push(compassHeading(o.alpha, o.beta, o.gamma));
    };
    window.addEventListener('deviceorientationabsolute', onEvent as EventListener, true);
    window.addEventListener('deviceorientation', onEvent as EventListener, true);
    window.setTimeout(() => {
      window.removeEventListener('deviceorientationabsolute', onEvent as EventListener, true);
      window.removeEventListener('deviceorientation', onEvent as EventListener, true);
      if (!seen.length) return reject(new Error('No compass reading. This phone may have no compass, or the app may not be allowed to use it.'));
      const m = circularMean(seen);
      resolve({ heading: m.mean, spreadDeg: m.spread, samples: seen.length });
    }, ms);
  });
}

/**
 * Some phones (iPhones) ask permission for motion and compass access, and only when the request comes straight from a tap:
 * call this in the tap's handler, before the compass is read. True when reading is allowed or needs no permission.
 */
export async function askCompassPermission(): Promise<boolean> {
  const Orient = typeof DeviceOrientationEvent === 'undefined' ? null : (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> });
  if (!Orient?.requestPermission) return true;
  try { return (await Orient.requestPermission()) === 'granted'; } catch { return false; }
}

export interface CompassSample { heading: number; /** front-to-back tilt of the phone in degrees (90 = upright) */ beta: number | null }

/**
 * Follows the compass as it changes, calling `onSample` several times a second; returns a function that stops it.
 * `onError` is called once if no readings arrive in two seconds (no sensor, or no permission).
 */
export function watchCompass(onSample: (s: CompassSample) => void, onError: (m: string) => void): () => void {
  if (typeof DeviceOrientationEvent === 'undefined') { onError('This phone has no compass sensor the app can read.'); return () => {}; }
  let got = false, absolute = false, stopped = false;
  const handle = (e: Event) => {
    const o = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
    if (e.type === 'deviceorientationabsolute') absolute = true; else if (absolute) return;
    let heading: number | null = null;
    if (typeof o.webkitCompassHeading === 'number') heading = o.webkitCompassHeading;
    else if (o.alpha !== null && o.beta !== null && o.gamma !== null && (o.absolute || e.type === 'deviceorientationabsolute')) heading = compassHeading(o.alpha, o.beta, o.gamma);
    if (heading === null) return;
    got = true; onSample({ heading, beta: o.beta });
  };
  window.addEventListener('deviceorientationabsolute', handle as EventListener, true);
  window.addEventListener('deviceorientation', handle as EventListener, true);
  const timer = window.setTimeout(() => { if (!got && !stopped) onError('No compass reading. This phone may have no compass, or the app may not be allowed to use it.'); }, 2000);
  return () => { stopped = true; window.clearTimeout(timer); window.removeEventListener('deviceorientationabsolute', handle as EventListener, true); window.removeEventListener('deviceorientation', handle as EventListener, true); };
}
