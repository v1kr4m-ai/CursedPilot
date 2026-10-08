// What each NavYeo tool does and how it gets its answer, shown behind the (i) button. Keys are the tool names in
// NavTools.tsx; tools/toolInfo.check.ts makes sure every tool has an entry. Keep these in step with navMath.ts.

export interface ToolInfo {
  /** what the tool is for, in plain words */
  concept: string;
  /** the calculation, step by step */
  steps: string[];
  /** the formulas in one place (shown in a monospace block) */
  formulas: string[];
  /** assumptions and limits to keep in mind */
  limits: string[];
}

export const TOOL_INFO: Record<string, ToolInfo> = {
  'Bearing Calculator': {
    concept: 'A reciprocal is the same line of sight seen from the other end. A relative bearing is measured clockwise from your own ship\'s head; adding your head turns it into a true bearing.',
    steps: [
      'Reciprocal: add 180° to the bearing and bring the answer back into 0–360°.',
      'True bearing: add the relative bearing to your ship\'s true head, again keeping the answer within 0–360°.',
    ],
    formulas: ['Reciprocal = (B + 180) mod 360', 'True bearing = (Head + Relative) mod 360'],
    limits: ['Use true values throughout. Convert compass or gyro readings first with the Compass tool.'],
  },
  'Time / Speed / Distance': {
    concept: 'Speed in knots is nautical miles per hour, so any one of distance, speed and time follows from the other two.',
    steps: [
      'Fill in any two boxes and leave the third empty.',
      'Distance = speed × time, speed = distance ÷ time, time = distance ÷ speed, with time converted between minutes and hours (÷ 60 or × 60).',
    ],
    formulas: ['D (nm) = S (kn) × T (min) / 60', 'S (kn) = D (nm) × 60 / T (min)', 'T (min) = D (nm) × 60 / S (kn)'],
    limits: ['Speed is taken as speed over the ground. Speed and time must be above zero where they are divided by.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.'],
  },
  'CPA / TCPA': {
    concept: 'The closest point of approach (CPA) is how near a contact will pass if both vessels hold course and speed; TCPA is the time until then. It is solved from the contact\'s motion relative to you.',
    steps: [
      'Place the contact on a flat grid from its true bearing and range: east = range × sin(bearing), north = range × cos(bearing).',
      'Turn each vessel\'s course and speed into an east and north velocity.',
      'Relative velocity = contact velocity − your velocity.',
      'The time of closest approach is when the relative position stops getting shorter; its position then gives the CPA distance and the bearing at CPA.',
      'If that time is zero or negative the contact is already opening and the CPA is the present range.',
    ],
    formulas: ['p = range × (sin B, cos B)', 'v = v_target − v_own', 't = −(p · v) / |v|²   (hours)', 'CPA = |p + v × t|', 'TCPA = t × 60 (minutes)'],
    limits: ['Assumes both vessels keep course and speed, and that bearing and courses are true.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.', 'Needs accurate inputs: a few degrees of bearing error at long range changes the CPA a lot.', 'A CPA of 0 means a collision course.'],
  },
  'Angle on the Bow (ATB)': {
    concept: 'The angle on the bow is where you are, as seen from the target, measured from the target\'s head: 0° means the target is heading straight at you, 180° means it is steaming directly away. It is given to port or starboard (red or green).',
    steps: [
      'The line of sight from the target to you is the reciprocal of your bearing to the target.',
      'Subtract the target\'s course from that line of sight. A result between 0° and 180° is starboard (green); between 180° and 360° it is port (red) and the angle is 360° minus the result.',
      'Going the other way, the target\'s course is the line of sight minus the angle for a starboard angle, or plus the angle for a port angle.',
    ],
    formulas: ['R = (B + 180 − Course) mod 360', 'Angle = R (starboard) or 360 − R (port)', 'Course = B + 180 − Angle (stbd)  |  B + 180 + Angle (port)'],
    limits: ['Bearing is true, from you to the target.', 'The angle alone gives the target\'s aspect, not its speed; combine with ranges over time or the CPA tool for that.'],
  },
  'Course to Steer': {
    concept: 'A current pushes you off your intended track. To make good a track you steer a course that points partly into the current, so that its sideways push is cancelled.',
    steps: [
      'Treat the current as a velocity (set = direction it flows towards, drift = its speed).',
      'The sideways part of your own velocity must cancel the sideways part of the current. That fixes the allowance: sin(allowance) = − drift × sin(set − track) / ship speed.',
      'Course to steer = track + allowance (allowance is negative when you must steer to port of the track).',
      'Speed over ground = ship speed × cos(allowance) + drift × cos(set − track). Time to run = distance ÷ speed over ground.',
    ],
    formulas: ['sin(a) = − d × sin(Set − Track) / V', 'CTS = Track + a', 'SOG = V × cos(a) + d × cos(Set − Track)'],
    limits: ['If drift × sin(set − track) is bigger than your speed there is no solution: the current is too strong to hold that track.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.', 'If the speed over ground works out at zero or less you would make no headway.', 'Assumes a steady current, no leeway, and ship speed through the water.'],
  },
  'Distance Off & Horizon': {
    concept: 'A known height seen at a small vertical angle gives a distance by simple trigonometry. The horizon and the range at which an object can first be seen come from the curve of the earth.',
    steps: [
      'Distance off by vertical sextant angle: divide the object\'s height by the tangent of the angle (metres), then convert to nautical miles (÷ 1852).',
      'Visual horizon (with normal refraction) in nautical miles is about 2.08 times the square root of the height of eye in metres. The radar horizon uses 2.21.',
      'An object is first seen where the horizon distances of the observer and the object add up.',
    ],
    formulas: ['d (nm) = h / tan(α) / 1852', 'Visual horizon = 2.08 × √h', 'Radar horizon = 2.21 × √h', 'Range first seen = 2.08 × (√h_eye + √h_object)'],
    limits: ['The sextant method ignores earth curvature and refraction, so use it for short distances and small heights above the water.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.', 'Heights are above sea level at the state of tide the object\'s height is charted for.', 'Real visibility also depends on weather, light and the target\'s size.'],
  },
  'Horizontal Sextant Angle (HSA)': {
    concept: 'The angle between two charted objects, measured with a sextant held horizontally, puts you on a circle that passes through both objects. Two such angles to three objects give two circles that cross at your position. The same angle also gives your distance off two objects, and, turned round, the length of an object from the bearings of its ends.',
    steps: [
      'Look at the three objects: A on your left, B in the middle, C on your right. Measure the angle A to B (α) and B to C (β).',
      'For each pair, the position circle has radius R = c / (2 sin angle), where c is the distance between the two objects. Its centre lies R × cos(angle) from the line between them, on your side for angles under 90° and on the far side for larger angles.',
      'Both circles pass through B. Their other crossing point is your position: it is B reflected in the line joining the two circle centres.',
      'The result is checked by working out the angles it would give; if they do not match the objects in that order, the fix is refused.',
      'Latitude and longitude are first turned into a flat grid in nautical miles about the middle of the objects (1′ of latitude = 1 nm, 1′ of longitude = cos(latitude) nm).',
      'Distance off (two-object mode): when you are equally far from both objects, the distance to the line joining them is half that line divided by the tangent of half the angle.',
      'Object length mode: the angle between the bearings to the two ends is found (the smaller of the two ways round, so bearings either side of north work). With the distance to the middle of the object, half the length is the distance times the tangent of half that angle, so the length is twice that.',
    ],
    formulas: ['R = c / (2 × sin α)', 'centre offset from chord = R × cos α', 'Position = reflection of B in the line of centres', 'Distance off = (c / 2) / tan(α / 2)', 'Object length = 2 × distance × tan(Δ / 2)   (Δ = angle between the end bearings)'],
    limits: ['If you are on the circle through all three objects (the danger circle) the two position circles are the same circle and there is no unique fix. Near it the circles cross at a shallow angle and a small angle error moves the position a long way, so the tool warns.', 'Best results come when the middle object is nearer to you than the other two, or the angles are large.', 'Needs accurate chart positions of the objects and angles read to the nearest minute or so.', 'Object length assumes the object lies across your line of sight and the distance is to its middle; an object seen at an angle is longer than the answer. Small bearing errors matter: a 1° error on a 5° angle is a 20% error in length.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.'],
  },
  'Wheel-over Point': {
    concept: 'When you put the wheel over the ship keeps going ahead (advance) and slides sideways (transfer) before she is on the new heading. So the wheel must go over before the turning point, by an amount that depends on those two figures and how big the turn is.',
    steps: [
      'Take advance and transfer for the size of the turn: typed in, or interpolated from the selected ship\'s own turning data for the chosen speed, wheel angle and side.',
      'After the turn the ship is advance ahead and transfer to the side of where she started, heading on the new course. The new track passes through that point.',
      'The new track meets the old one at a distance of transfer ÷ tan(turn) behind that point along the old track, so the wheel-over distance before the turning point is advance minus that.',
    ],
    formulas: ['Wheel-over distance = Advance − Transfer / tan(turn)', 'For a 90° turn this is simply the advance'],
    limits: ['An approximation: it assumes the ship is on the new track by the end of the turn (steadying out takes a little longer).', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.', 'Valid for alterations from 1° to 179°, either side.', 'Interpolation is linear between the recorded turn amounts; a larger alteration than the table holds uses the largest recorded figures and is flagged.', 'Always confirm against the ship\'s own trials and standing orders.'],
  },
  'Man Overboard Turn': {
    concept: 'The Williamson and Scharnow turns bring the ship back onto the reciprocal of her original track after a man falls overboard. This tool works out where each one leaves your ship, using the ship\'s own recorded turning data.',
    steps: [
      'Williamson: turn 60° towards the side the man fell, then the opposite way through 240° so the ship ends on the reciprocal. Scharnow: turn 240° towards that side, then 60° the other way.',
      'For each turn, advance and transfer are taken from the chosen turning table for that amount of turn (linear between recorded values).',
      'Each leg moves the ship by the advance along her head and the transfer to the side she is turning to; her head then changes by the turn. The man is the origin.',
      'The end position gives the time taken, the offset from the original track, the run still to go to be abeam of the man, and his bearing from the ship.',
    ],
    formulas: ['Williamson: +60°, then −240° (to starboard first; mirrored to port)', 'Scharnow: +240°, then −60°', 'x += Adv·sin(h) + Tr·sin(h ± 90°),  y += Adv·cos(h) + Tr·cos(h ± 90°)', 'h += turn'],
    limits: ['The man is taken as not drifting, and wind and current on the ship are ignored.', 'The ship is taken as steady on each new heading at the end of her turn, as in the Fishtail calculator; a real turn needs more room.', 'The table must reach 240° of turn for these manoeuvres; if it stops short the largest figures are used and the result is flagged.', 'Distances can be shown in cables (the default), nautical miles, metres, yards and others; the tool remembers the unit you used last.', 'An aid only. Follow standing orders and the situation, and use the method that suits the circumstances.'],
  },
  'Sun Run Sun (SRS)': {
    concept: 'Two sights of the Sun a few hours apart, with the ship\'s run between them, give an observed position. Each sight gives a line of position; the first line is carried forward by the course and distance run and crossed with the second.',
    steps: [
      'The Sun\'s GHA and declination are worked out for the time of each sight (UT = zone time minus the zone).',
      'The sextant altitude is corrected for index error, dip (from height of eye), refraction (scaled for temperature and pressure), parallax and the Sun\'s semi-diameter (lower limb added, upper limb taken off), giving the true altitude Ho.',
      'The calculated altitude Hc and azimuth Zn come from the DR (for the second sight, the DR carried on by the run): sin Hc = sin Lat sin Dec + cos Lat cos Dec cos LHA.',
      'Intercept = (Ho − Hc) in minutes of arc, towards the Sun if Ho is larger. The position line is at right angles to Zn at the point that far from the DR.',
      'The first line is moved by the run along the course (Mercator sailing); where it crosses the second line is the observed position, at the time of the second sight.',
    ],
    formulas: ['LHA = GHA + East longitude', 'sin Hc = sin φ sin δ + cos φ cos δ cos LHA', 'Intercept (′) = (Ho − Hc) × 60', 'Run = speed × time between sights', 'Dip = −1.758′ √(height of eye in m)'],
    limits: ['The Sun is worked out on the device (about 0.01° or a minute of arc), not read from the Nautical Almanac; compare with the almanac when it matters.', 'Weak when the two azimuths differ by less than about 30°, and the tool says so. Sights below 10° or above 80° are unreliable.', 'Assumes the ship steered the course at the speed given: set and drift are not allowed for.', 'The DR must be the position at the time of the first sight.', 'Refraction and dip use the Sun Run workbook\'s own formulas.'],
  },
  'Sun Run Merpass (SRM)': {
    concept: 'A Sun sight some hours before noon, carried forward by the run to meridian passage, is crossed with the latitude from the meridian altitude. The meridian altitude gives latitude directly; the earlier sight supplies the longitude.',
    steps: [
      'The first sight is reduced as in Sun run Sun, giving a position line.',
      'The time of meridian passage depends on the longitude the ship will have then, so it is worked out on the moving DR until it settles (zone time at which the Sun\'s LHA is zero). Take the highest altitude around that time.',
      'The meridian altitude is corrected to a true altitude. Zenith distance = 90° − Ho, and the latitude is the Sun\'s declination plus the zenith distance when the Sun bears south of the ship (the ship is north of it), or minus it when the Sun bears north.',
      'The first line is carried forward by the run to meridian passage and cut by that parallel of latitude, giving the longitude.',
    ],
    formulas: ['Lat = Dec + (90° − Ho)  (Sun south of the ship)', 'Lat = Dec − (90° − Ho)  (Sun north of the ship)', 'Longitude from the transferred line: Δλ = −Δφ · cos Zn / (sin Zn · cos φ)'],
    limits: ['The Sun is worked out on the device (about 0.01°), not read from the Nautical Almanac.', 'The first sight should be well off the meridian: with the Sun nearly due north or south its line gives no longitude, and the tool says so.', 'If you enter the time you observed the maximum altitude it is used for the run; otherwise the worked-out time is.', 'Assumes the course and speed were held; set and drift are not allowed for.', 'The latitude is reported at the time of meridian passage.'],
  },
  'Compass Conversion': {
    concept: 'A compass course differs from the true course by the ship\'s deviation (her own magnetism) and the local variation. Easterly corrections are added when going from compass to true.',
    steps: [
      'Compass to magnetic: add the deviation (east +, west −).',
      'Magnetic to true: add the variation (east +, west −).',
      'True to compass is the reverse: subtract the variation, then the deviation.',
      'Gyro to true: add the gyro error (east +, when the gyro reads low).',
    ],
    formulas: ['True = Compass + Deviation + Variation', 'Compass = True − Variation − Deviation', 'True = Gyro + Gyro error', 'Memory aid: Compass → True, add East'],
    limits: ['Deviation depends on the ship\'s head: use the value for that heading from the deviation card.', 'Variation changes with place and slowly with time: use the value for the chart and year.'],
  },
  'Radian Rule': {
    concept: 'An angle in radians is the length of an arc divided by its radius. For small angles the arc is almost the same as the distance across, which gives a quick angle from a distance off and a range.',
    steps: [
      'Divide the distance by the range (both in the same unit) to get the angle in radians.',
      'Multiply by about 57.3 to get degrees.',
    ],
    formulas: ['θ (rad) = distance / range', 'θ (deg) = distance / range × 57.3', '1° ≈ 1 in 60'],
    limits: ['Accurate only for small angles (a few degrees). Distance is measured across the line of sight.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.'],
  },
  'Unit Converter': {
    concept: 'Every unit is converted through a base unit (metres, or metres per second for speed), so any unit can be converted to any other.',
    steps: [
      'The value is multiplied by the size of the starting unit in the base unit, then divided by the size of the target unit.',
    ],
    formulas: ['1 nautical mile = 1852 m', '1 cable = 0.1 nm = 185.2 m', '1 yard = 0.9144 m', '1 fathom = 1.8288 m', '1 knot = 1852 / 3600 m/s ≈ 0.5144 m/s'],
    limits: ['The cable is taken as one tenth of a nautical mile (185.2 m), the usual navigational definition. Older texts and some navies use 100 fathoms (182.9 m) or, in the US, 120 fathoms (219.5 m).'],
  },
};
