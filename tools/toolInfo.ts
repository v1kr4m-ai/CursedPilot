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
  'Battenberg': {
    concept: 'The course to steer to take up, or change, station on a Guide. The Guide moves, so the track you want is the track relative to her, and the course is found from the relative velocity triangle (BR 45(6) para 0423). The stations are shown on a Battenberg-style diagram with the Guide at the centre heading up, and the bearings on her bow, beam, quarter and astern marked.',
    steps: [
      'Enter the Guide\'s true course and speed and your own stationing speed (the speed you will use to close).',
      'Give where you are now and the ordered station, each as the angle off the Guide\'s bow (0 to 180) on her port or starboard side and the distance. You can tap the diagram instead.',
      'Your ground velocity is the Guide\'s velocity plus your velocity relative to her, and that relative velocity must lie along the line from where you are to the ordered station. The course is the direction of your ground velocity at the stationing speed.',
      'When the stationing speed is below the Guide\'s, two courses can work; the quicker is given first, and the other is shown too.',
      'Deceleration Distance = (stationing speed minus the Guide\'s speed) x loss of speed per knot (para 0424). Along the relative track it is scaled by relative speed over own speed and measured back from the station; there the Guide bears the bearing shown and you reduce to her speed.',
    ],
    formulas: ['Own velocity = Guide velocity + k x (unit vector from now to station)', '|own velocity| = stationing speed, solved for k > 0', 'Time = relative distance / k', 'Slow-down point = Deceleration Distance x (k / stationing speed) back from the station'],
    limits: ['As in BR 45(6) para 0423, the course does not allow for the turn: add advance and transfer (see Wheel-over) and the loss of speed in the turn.', 'It takes the Guide on a steady course and speed. Alter and recalculate when she does.', 'The worked example 4-1 in the book is read from a plot; the exact solution of the triangle differs by a few degrees.', 'The loss of speed per knot comes from the selected ship\'s deceleration runs when they are recorded, and can be typed over.', 'An aid. Follow the OTC\'s signals and the ship\'s standing orders.'],
  },
  'Anchor': {
    concept: 'How much cable to veer for the depth, and the circles the ship swings in at anchor: the Safety Swinging Circle (must be clear of the minimum LDL), the Bridge Swinging Circle (the anchor watch: a fix of the Bridge outside it means the ship is dragging), the Stern Swinging Circle, and the Minimum Swinging Radius used to space ships in an anchorage. All from BR 45(1)(2) Chapter 14.',
    steps: [
      'Cable: take the greatest depth expected, the charted depth plus the maximum height of tide. Forged steel needs 1½ times the square root of the depth in metres in shackles (2 times the square root of the depth in fathoms); aluminium bronze needs the square root of the depth in metres (the square root of 1.3 times the depth in fathoms). A shackle is 15 fathoms (27.4 m).',
      'Safety Swinging Circle radius: the maximum cable that can be veered, plus the length of the ship, plus a safety margin (at least one cable to start with). It does not depend on the cable actually veered or on the MSR chosen.',
      'Bridge Swinging Circle radius: the cable veered plus the distance from the stem to the standard compass (the Bridge). Stern Swinging Circle radius: the cable veered plus the length of the ship.',
      'Normal MSR: the length of the ship plus the cable veered. Reduced MSR: the length of the ship plus 45 metres (50 yards).',
      'For two ships, Double MSR is the two radii added; Single MSR is the larger of the two.',
    ],
    formulas: ['Cable, steel (shackles) = 1½ √depth (m) (14.1) or 2 √depth (fm) (14.2)', 'Cable, aluminium bronze = √depth (m) (14.3) or √(1.3 depth (fm)) (14.4)', 'Safety circle = max cable + ship + margin', 'Bridge circle = cable veered + stem to standard', 'Stern circle = Normal MSR = ship + cable veered (14.5)', 'Reduced MSR = ship + 45 m (14.7)', 'Double MSR = MSR1 + MSR2 (14.6, 14.8)'],
    limits: ['The cable formulae are for a fine-hulled vessel in calm conditions with up to 5 kn of stream, and allow a slight margin; in strong wind or stream more cable will be needed. BR 45 notes the cable could be cut by 60% in 15 to 20 kn of wind with under 2 kn of stream, after which the margin falls quickly.', 'The two printed forms of the aluminium bronze formula (14.3 in metres, 14.4 in fathoms) do not give exactly the same answer; the tool uses each as printed, according to the depth unit chosen.', 'The Safety margin should be raised for a poor fix, a difficult approach, deep water or a bad holding ground (para 1410d).', 'An aid. Follow the ship\'s standing orders and the Captain\'s direction.'],
  },
  'Tides': {
    concept: 'The sea does not rise and fall at an even rate between a high water and the next low water: it moves slowly at first, fastest in the middle, and slowly again at the end. Given the two tides either side of the time you want, the tool works out the height at that time (or the time a given height is reached), whether the tide is flooding or ebbing, and from the Moon\'s phase whether the tides are springs or neaps.',
    steps: [
      'Enter the high water and the following low water (or the low water and the next high water): their times and heights from the tide tables for the port.',
      'The duration is the time between them and the range is the difference in height.',
      'Rule of twelfths: the tide rises or falls 1, 2, 3, 3, 2, 1 twelfths of the range in the six equal parts of its duration. Half-cosine: the height follows a cosine curve between the two tides.',
      'For a given time the height is the first tide\'s height plus the share of the range gone; for a given height the share is turned back into a time.',
      'The Moon\'s longitude less the Sun\'s gives the phase. Within about 2.5 days of new or full Moon the tides are springs; within about 2.5 days of a quarter they are neaps; between, they are making towards springs or falling off towards neaps.',
    ],
    formulas: ['Rule of twelfths: cumulative share 0, 1/12, 3/12, 6/12, 9/12, 11/12, 1 at each sixth of the duration', 'Half-cosine: h = h1 + (h2 − h1) (1 − cos(π t / T)) / 2', 'Elongation = λMoon − λSun; spring near 0° or 180°, neap near 90° or 270°'],
    limits: ['Both methods are approximations. They suit a normal semi-diurnal tide and are less exact in ports with a distorted tide curve, double high waters or river effects. Check the tide tables for the port.', 'Springs and neaps are taken from the Moon\'s phase: the highest springs come a day or two after new or full Moon, and weather and air pressure can change the height.', 'Heights are in the same unit and datum as the tide table (metres above chart datum).'],
  },
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
    concept: 'Two cards. VSA gives the distance off an object from a sextant angle, by the method of the book you use (BR 45 methods, or your own formula). Horizon and visibility gives the horizon, the range at which an object is first seen, and the radar horizon, with the coefficients of the book you choose.',
    steps: [
      'Height of object, base visible (BR 45 8.1): distance = height x cot (corrected angle). The corrected angle is the observed angle plus the index error; the charted elevation (above MHWS) is increased by the height of the tide below MHWS.',
      'Width of object (8.1a): distance = width x 360 / (2 pi x angle in degrees).',
      'Object beyond the horizon (Appendix 6): the angle from the sea horizon is corrected for index error and dip, then for terrestrial refraction (8% of the distance in nautical miles, in minutes of arc, found by repeating), and cos (d + t) = (R + h) / (R + H) x cos t gives the arc d, with R 3437.75 nm.',
      'Horizon method (8.3): with no height known, the angle of the waterline below the horizon plus the dip is theta, and theta (minutes) = 1.8563 h / d + 0.42 d (h in metres) is solved for d, taking the smaller root.',
      'Horizon: distance in nautical miles = coefficient x the square root of the height in metres. BR 45 uses 2.08 (optical) and 2.23 (radar); Norie\'s uses 2.095, the Admiralty List of Lights 2.03, the geometric horizon 1.93; 2.21 is the radar figure used before. An object is first seen where the horizon distances of the observer and the object add up.',
      'My own formula: type an expression in H (height, m), W (width, m), A (corrected angle, degrees), a (observed angle), ie (index error, minutes) and h (height of eye, m).',
    ],
    formulas: ['d = H cot(A)  (8.1)', 'd = W x 360 / (2 pi A)  (8.1a)', 'cos (d + t) = (R + h)/(R + H) cos t  (A6.1)', 'theta = 1.8563 h/d + 0.42 d  (8.3b)', 'Visual horizon = 2.08 x sqrt(h) (BR 45), radar 2.23 x sqrt(h); 2.21 as used before', 'Range first seen = 2.08 x (sqrt(h_eye) + sqrt(h_object))'],
    limits: ['The sextant method ignores earth curvature and refraction, so use it for short distances and small heights above the water.', 'Lengths can be typed and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers the unit you used last.', 'Heights are above sea level at the state of tide the object\'s height is charted for.', 'Real visibility also depends on weather, light and the target\'s size.', 'The BR 45 examples check: 1.65 nm for 8.1 (Example 8-1), 24.6 nm for A6.1 (Example A6-1), 1.42 nm for the horizon method (Example 8-3), 20.37 nm for the dipping range (Example 8-2).', 'Long-range sextant ranges are approximate, and abnormal refraction spoils them. Do not use a peak that is part of a chain unless it is positively identified.'],
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
      'The calculated altitude Hc and azimuth Zn come from the DR (for the second sight, from the point on the first position line carried on by the run, as on the chart): sin Hc = sin Lat sin Dec + cos Lat cos Dec cos LHA.',
      'Intercept = (Ho − Hc) in minutes of arc, towards the Sun if Ho is larger. The position line is at right angles to Zn at the point that far from the DR.',
      'The first line is moved by the run along the course (Mercator sailing); where it crosses the second line is the observed position, at the time of the second sight.',
    ],
    formulas: ['LHA = GHA + East longitude', 'sin Hc = sin φ sin δ + cos φ cos δ cos LHA', 'Intercept (′) = (Ho − Hc) × 60', 'Run = speed × time between sights', 'Dip = −1.758′ √(height of eye in m)'],
    limits: ['The Sun is worked out on the device (about 0.01° or a minute of arc), not read from the Nautical Almanac; compare with the almanac when it matters.', 'Weak when the two azimuths differ by less than about 30°, and the tool says so. Sights below 10° or above 80° are unreliable.', 'Assumes the ship steered the course at the speed given: set and drift are not allowed for.', 'The DR must be the position at the time of the first sight.', 'Refraction and dip use the Sun Run workbook\'s own formulas.', 'The filled Sight Form (NP 98) is worked for the chosen position (whole-degree latitude, longitude chosen for a whole LHA) and interpolated like the Sight Reduction Tables, to the tenth of a minute. It is calculated, not looked up, so it can differ from the books by about 0.1′. The tool shows its position beside the direct figure so the two can be compared.'],
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
  'Four Star Fix': {
    concept: 'Four stars (or planets, or the Moon) taken in quick succession at twilight, while the horizon and the bodies can both be seen, give four position lines that cross close together. The tool says when to start the stopwatch and which to take, and then works the fix, either with each body on its own Sight Form or the rapid way from one chosen position.',
    steps: [
      'Planning: civil twilight is when the Sun\'s centre is 6° below the horizon. Observations start the chosen number of minutes before it. LHA Aries at that time is rounded to a whole number of degrees, and the time that gives it is found; the stopwatch starts two minutes earlier, so the stars are taken about two minutes after zero.',
      'Bodies: the 57 stars and the planets Venus, Mars, Jupiter and Saturn above the horizon at that time are worked out, and four of altitude 30° to 70° with their bearings spread round the horizon are suggested, the brighter ones preferred. The Moon is left for you to choose.',
      'Each sight is at zero time plus its stopwatch reading. The star\'s GHA is the GHA of Aries plus its SHA, with SHA and declination worked out for the date from the star catalogue (proper motion, precession, nutation and aberration).',
      'The sextant altitude is corrected for index error, dip and refraction. A planet also has its horizontal parallax; the Moon has parallax and its semi-diameter increased for altitude (lower limb added, upper limb taken off). Each is reduced on the Sight Form from its own chosen position, a planet or the Moon with the almanac\'s v and d corrections.',
      'Each position line is carried to the time of the fix by the course and speed, and the best crossing of all the lines (least squares) is the observed position. How far the fix lies from each line shows how well the sights agree.',
    ],
    formulas: ['GHA star = GHA Aries + SHA', 'LHA Aries at t0 = a whole number of degrees; t0 = zero time + 2 min', 'sin Hc = sin φ sin δ + cos φ cos δ cos LHA', 'Intercept (′) = (Ho − Hc) × 60', 'Fix: minimise Σ (miss from line)² over the lines'],
    limits: ['The star positions are from the Hipparcos catalogue (epoch 1991.25), moved to the date; they agree with the Nautical Almanac to a few seconds of arc, but they are calculated, not read from it. The planets are worked from the VSOP87 theory (about an arcsecond) and the Moon from Meeus\'s tables (about 10 arcseconds), both well inside 0.1 minute of arc.', 'A wrong star (misidentified) shows as a large miss from its line, and the tool warns when any line misses the fix by more than 2 nm.', 'Star bearings should be spread round the horizon; the tool warns when there is a sector of more than 150° with no star.', 'The DR is taken as the position at zero time and the course and speed as held; set and drift are not allowed for.', 'The time of the fix is zero time, as in the rapid method, or the last sight if you choose. The filled Sight Forms use the star lines of the form (SHA, Aries increment, no d correction).'],
  },
  'Polaris Latitude': {
    concept: 'Polaris is within a degree of the north celestial pole, so its true altitude is nearly the observer\'s latitude. The small difference depends on where Polaris is in its little circle round the pole, which the hour angle gives.',
    steps: [
      'The time gives GHA Aries (from the sidereal time) and, with Polaris\'s SHA for the date, the GHA and then the LHA of Polaris for the DR longitude.',
      'The sextant altitude is corrected for index error, dip and refraction to the true altitude Ho.',
      'The latitude is the one at which the altitude formula gives Ho: sin Ho = sin Lat sin Dec + cos Lat cos Dec cos LHA. This is the exact form of Lat = Ho − 1° + a0 + a1 + a2.',
      'The first-order part of the correction is −p cos LHA, and the second-order part is ½ p² sin² LHA tan Lat, where p is Polaris\'s polar distance (about 0.7°). The almanac\'s a0, a1 and a2 together equal the whole correction, split in the book\'s own way.',
    ],
    formulas: ['sin Ho = sin φ sin δ + cos φ cos δ cos LHA', 'φ ≈ Ho − p cos LHA + ½ p² sin² LHA tan φ', 'Lat = Ho − 1° + (a0 + a1 + a2)', 'LHA Polaris = GHA Aries + SHA + East longitude'],
    limits: ['Polaris is seen only from the northern hemisphere, and the tool warns when it is under 5° (refraction is uncertain) or not above the horizon.', 'Only the DR longitude is used, for the hour angle: a degree of longitude error is under a minute of latitude.', 'Polaris\'s position is from the Hipparcos catalogue moved to the date; the worked example in your notes (8°41.9′N) is reproduced.', 'An aid only: compare the sum a0 + a1 + a2 with the almanac.'],
  },
  'Rise, Set and Twilight': {
    concept: 'The times at which the Sun\'s centre reaches given altitudes for the position and date: rising and setting, and the three twilights. The true bearing of the Sun at rising and setting (the amplitude) gives the error of the gyro or compass.',
    steps: [
      'The meridian passage is found first (when the LHA of the Sun is 0°), and each event is searched for in the morning before it and the evening after it.',
      'At each trial time the Sun\'s altitude is worked out from the position, and the time is found where it equals the wanted altitude: −50′ for rising and setting (34′ refraction and 16′ semi-diameter, as in the almanac, less the dip when seen from the height of eye), and −6°, −12°, −18° for civil, nautical and astronomical twilight.',
      'The true bearing at that moment follows from the same spherical formula; the amplitude is its angle from east or west.',
      'Gyro or compass error = true bearing − bearing observed. Positive means the compass reads too low (error east).',
    ],
    formulas: ['sin h = sin φ sin δ + cos φ cos δ cos LHA', 'Rising/setting: h = −50′ (−50′ − dip from the eye)', 'Twilight: h = −6°, −12°, −18°', 'Error = True − Observed'],
    limits: ['The Sun is worked out on the device, so times are good to about a minute; the almanac and local refraction can differ by a minute or two.', 'Near the poles the Sun may not reach the altitude: the tool says so.', 'The DR position is used as it is; for a moving ship use the DR for that time.', 'A bearing is only as good as the observation: take it with the Sun just clear of the horizon and enter the time if not at rising or setting.'],
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

// ASTRO is one tool with five tabs: its explanation is the five joined, each part headed by the tab's name.
const ASTRO_PARTS: [string, string][] = [['Sun Run Sun (SRS)', 'Sun Run Sun'], ['Sun Run Merpass (SRM)', 'Sun Run Merpass'], ['Four Star Fix', '4 Star Fix'], ['Polaris Latitude', 'Polaris'], ['Rise, Set and Twilight', 'Rise & Set']];
TOOL_INFO['ASTRO'] = {
  concept: 'The astronomical tools in one place, as tabs: ' + ASTRO_PARTS.map(([, t]) => t).join(', ') + '. ' + ASTRO_PARTS.map(([n, t]) => `${t}: ${TOOL_INFO[n].concept}`).join(' '),
  steps: ASTRO_PARTS.flatMap(([n, t]) => TOOL_INFO[n].steps.map(x => `${t}: ${x}`)),
  formulas: ASTRO_PARTS.flatMap(([n]) => TOOL_INFO[n].formulas),
  limits: ASTRO_PARTS.flatMap(([n, t]) => TOOL_INFO[n].limits.map(x => `${t}: ${x}`)),
};
ASTRO_PARTS.forEach(([n]) => { delete TOOL_INFO[n]; });
