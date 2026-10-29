// Run: node tools/positions.check.ts
import assert from 'node:assert/strict';
import * as p from './positions.ts';

const near = (a: number, b: number, tol = 1e-6, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

// a degree of latitude is 60 nm, along the equator or a meridian, by either method
near(p.greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })!.distance, 60, 1e-6);
near(p.greatCircle({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })!.distance, 60, 1e-6);
near(p.rhumb({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })!.distance, 60, 1e-6);
near(p.rhumb({ lat: 10, lon: 20 }, { lat: 11, lon: 20 })!.course, 0, 1e-9);
near(p.greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })!.distance, 5400, 1e-6);                       // a quarter of the equator
assert.equal(p.greatCircle({ lat: 5, lon: 5 }, { lat: 5, lon: 5 }), null);

// parallel sailing: 10 degrees of longitude along 60N is 600 x cos 60 = 300 nm on course 090; the great circle is a little shorter
{
  const r = p.rhumb({ lat: 60, lon: 0 }, { lat: 60, lon: 10 })!;
  near(r.distance, 300, 1e-6); near(r.course, 90, 1e-9); near(r.dLong, 600, 1e-9); near(r.dLat, 0, 1e-9); near(r.departure, 300, 1e-6);
  const g = p.greatCircle({ lat: 60, lon: 0 }, { lat: 60, lon: 10 })!;
  assert.ok(g.distance < 300 && g.distance > 296, `${g.distance}`);
  assert.ok(g.initial < 90 && g.initial > 85, 'the great circle starts toward the pole');
  assert.ok(g.final > 90 && g.final < 95, 'and ends heading away from it');
}

// London to New York: about 3,000 nm by great circle (5,570 km), and the rhumb line is longer
{
  const lon = { lat: 51.5, lon: -0.1278 }, ny = { lat: 40.7128, lon: -74.006 };
  const g = p.greatCircle(lon, ny)!, r = p.rhumb(lon, ny)!;
  assert.ok(g.distance > 2995 && g.distance < 3010, `${g.distance}`);
  assert.ok(r.distance > g.distance && r.distance < g.distance + 150, `${r.distance}`);
  assert.ok(g.initial > 285 && g.initial < 295 && g.final > 225 && g.final < 240, `${g.initial} ${g.final}`);
  assert.ok(r.course > 250 && r.course < 265, `${r.course}`);
}

// a rhumb line over the 180th meridian goes the short way: 179E to 179W is 2 degrees of longitude
near(p.rhumb({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })!.dLong, 120, 1e-9); near(p.rhumb({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })!.course, 90, 1e-9);
assert.equal(p.rhumb({ lat: 90, lon: 0 }, { lat: 10, lon: 0 }), null);

// going and coming back: the destination from a start, course and distance is the other end
for (const [a, b] of [[{ lat: 51.5, lon: -0.1 }, { lat: 40.7, lon: -74 }], [{ lat: -33.9, lon: 18.4 }, { lat: -20.2, lon: 57.5 }], [{ lat: 12.5, lon: 72.8 }, { lat: 8.4, lon: 76.9 }]]) {
  const g = p.greatCircle(a, b)!, d = p.greatCircleDestination(a, g.initial, g.distance);
  near(d.lat, b.lat, 1e-6, 'gc lat'); near(d.lon, b.lon, 1e-6, 'gc lon');
  const r = p.rhumb(a, b)!, e = p.rhumbDestination(a, r.course, r.distance)!;
  near(e.lat, b.lat, 1e-6, 'rhumb lat'); near(e.lon, b.lon, 1e-6, 'rhumb lon');
}
// steering east along 60N for 300 nm is 10 degrees of longitude; north for 600 nm from the equator is 10N
near(p.rhumbDestination({ lat: 60, lon: 0 }, 90, 300)!.lon, 10, 1e-9); near(p.rhumbDestination({ lat: 60, lon: 0 }, 90, 300)!.lat, 60, 1e-9);
near(p.greatCircleDestination({ lat: 0, lon: 0 }, 0, 600).lat, 10, 1e-9); near(p.greatCircleDestination({ lat: 0, lon: 0 }, 90, 60).lon, 1, 1e-9);
assert.equal(p.rhumbDestination({ lat: 80, lon: 0 }, 0, 700), null);                                     // over the pole
near(p.rhumbDestination({ lat: 0, lon: 179.5 }, 90, 120)!.lon, -178.5, 1e-9);                            // across 180

// writing a position three ways
assert.equal(p.decimalDegrees(51.475, 'lat'), '51.47500° N'); assert.equal(p.decimalDegrees(-1.2, 'lon'), '1.20000° W');
assert.equal(p.degMinutes(51.475, 'lat'), "51° 28.500' N"); assert.equal(p.degMinutes(-1.2, 'lon'), "001° 12.000' W");
assert.equal(p.degMinutes(10.99999999, 'lat'), "11° 00.000' N");                                          // 59.99999 minutes rounds up into the degree
assert.equal(p.degMinSec(51.475, 'lat'), `51° 28' 30.0" N`); assert.equal(p.degMinSec(-72.75, 'lon'), `072° 45' 00.0" W`);
assert.equal(p.hoursMinutes(1.5), '1 h 30 min'); assert.equal(p.hoursMinutes(0.25), '15 min');
console.log('positions: all checks passed');
