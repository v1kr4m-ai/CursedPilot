// The methods of calibrating and checking the ship's navigation equipment, as cards to read: Handbook on Navigation (2019) chapter 8, with the
// BR 45(1)(2) para 1521 radar index error methods and BR 45(3) para 0427 for the speed log formulas. Written as short points, not verbatim.
// The calculators for most of these are the saved records in Calibration Data; these cards cover the procedures themselves.

export interface MethodCard { title: string; points: string[] }
export interface MethodTopic { id: string; title: string; cards: MethodCard[] }

export const CAL_METHODS: MethodTopic[] = [
  {
    id: 'radar', title: 'Radar',
    cards: [
      { title: 'Range index error: what it is', points: [
        'The difference between the radar range and the true range. Add the error to a radar range to get the true range.',
        'It comes from the transmitter-to-aerial and aerial-to-receiver times, the synchronisation delay and the receiver delays, so it is not constant: check it on each range scale, and mark the latest value on the display.',
        'Many displays under-range slightly, so the error is then added to the measured range. Apply it to all fixes and parallel indices. Maintenance staff may be able to adjust it out.'] },
      { title: 'Alongside, charted range (normal chart)', points: [
        'Compare the charted and radar ranges of a radar-conspicuous object while alongside. Index error = charted range - radar range.',
        'Allow for any range difference between the aerial and the fixing position, and for the height of tide on a sloping shore.'] },
      { title: 'Radar calibration chart', points: [
        'Large-scale calibration charts have curves of equal subtended angle between pairs of charted objects, with range arcs of radar-conspicuous marks.',
        'Fix the ship by HSA (or DGPS) at anchor or on a buoy, read the true range of the mark from the chart, and compare it with the radar range taken at the same moment.',
        'Very accurate; best suited to weapon fire-control radars that read range to the nearest yard.',
        'Example: charted 21565 yd, radar 21545 yd: index error 20 yd (under-ranging), so add 20 yd to all ranges.'] },
      { title: 'Two-mark method', points: [
        'Needs two radar-conspicuous objects whose distance apart is known from the chart, with the ship running directly between them.',
        'Take both radar ranges together as she crosses the line between the marks. Both ranges carry the error, so: index error = (charted distance AB - (a + b)) / 2.'] },
      { title: 'Three-mark method (radar cocked hat)', points: [
        'Take simultaneous radar ranges of three well-charted marks around the ship and draw the range arcs on the chart.',
        'The arcs make a radar cocked hat; the index error is the radius of the circle tangent to the three arcs. The record form works this out from the marks\' positions and ranges.'] },
      { title: 'HSA method', points: [
        'Run on a transit with a third mark roughly abeam. Compile beforehand a table of the true ranges of the radar mark against the horizontal sextant angle.',
        'Read the radar range as each HSA is measured; average the differences between true and radar ranges to get the index error.'] },
      { title: 'Two-ship method (double echo)', points: [
        'Two ships proceed in line abreast at close range until a double echo appears on the radar.',
        'The range between own ship and the consort (A) includes the index error; the range between the consort and the double echo (B) does not. B is the true range, so index error = B - A.'] },
      { title: 'Three-ship method', points: [
        'Three ships proceed in line abreast and each measures the range of the others at the same time.',
        'Ship A provides the true range BC and ship C the true range AB, so all three ships can find their errors. It relies on measurements outside own ship\'s control.'] },
      { title: 'Comparison with the weapon radar', points: [
        'Weapon fire-control radars range very precisely and are carefully calibrated. Take the weapon radar range of an object both radars hold as the reference and compare the navigational radar range with it.'] },
      { title: 'Bearing checks and alignment', points: [
        'Take the visual and radar bearing of an object that shows well on both, alongside or at anchor, and compare them. Example: gyro bearing 180, radar bearing 179: error +1 degree, so adjust radar bearings by +1.',
        'Allow for any gyro error in the visual bearing first. Radar bearings should always be treated with caution: 1 degree is about 35 yd at 1 nm.',
        'Other causes include beam width, centring, ship\'s head marker, aerial alignment, backlash and squint error.'] },
    ],
  },
  {
    id: 'log', title: 'Speed log (EM log)',
    cards: [
      { title: 'When to calibrate', points: [
        'On first installation, then annually, on completion of refits, after any addition or alteration to the underwater outfit, and when in doubt about the log.',
        'The EM log works on Faraday\'s law; its accuracy depends on the sensor type and where it is on the hull, and its output is rarely linear over the whole speed range.'] },
      { title: 'Conditions and preparation', points: [
        'Calm sea with little or no swell; tidal stream nil or known; wind below 10 kn.',
        'Ship in normal loading with all equipment as in service (sonar dome lowered; towed arrays housed).',
        'Use the rudder sparingly; keep the revolutions and pitch constant during the runs.',
        'Calibrate across the whole speed range, generally in multiples of 6 kn (6, 12, 18, 24 and so on).',
        'Note the log speed every 15 seconds below 20 kn and every 10 seconds above 20 kn, and the distance recorder too.',
        'Settle on the course for about 5 minutes before starting the measured run.'] },
      { title: 'Measured mile run', points: [
        'Run on a measured mile normally marked with transits, on a course along the prevailing set, if any, and clear of traffic and hazards.',
        'Note the speed through the water (log speed). If the log may be in error, first assess the set accurately (from ECDIS), before building up to full power, by a one-mile run measured by DGPS or GPS on reciprocal courses along the set.',
        'If GPS is used for the speed in the full-power run, correct the speed over ground for the set so that the speed through the water is what is recorded.',
        'Two runs at each speed usually suffice; with tidal stream or wind, make two runs on each heading (four runs).'] },
      { title: 'DGPS / GPS method', points: [
        'Feed a reference position into the DGPS and make two or four runs as for the measured mile.',
        'The ground speed comes from the GPS, corrected for the set to give speed through the water.'] },
      { title: 'Danbuoy method', points: [
        'Allows the calibration in deep water, avoiding shallow-water effects.',
        'Lay two danbuoys about 3 nm apart along a radial perpendicular to the direction of the prevailing wind.',
        'Start from one danbuoy and set course for the other. Once settled on the course do not change it, whatever the relative change in the position of the buoy.',
        'Measure the range of the buoy on the navigation fire-control radar and run a measured mile towards it. Example: the dan is at 2.5 nm at the start; put the VRM at 1.5 nm and measure the speeds until the dan reaches the 1.5 nm circle.'] },
      { title: 'Working out the correction', points: [
        'The log error is the mean log speed less the mean speed over ground, in knots and as a percentage of the log speed.',
        'The percentage correction is always a percentage of the log (water) speed, not of the ground speed.',
        'Two runs (stream steady): C = 100 ((V1 + V2) / (L1 + L2) - 1). Four runs (stream changing): C = 100 ((V1 + 3 V2 + 3 V3 + V4) / (L1 + 3 L2 + 3 L3 + L4) - 1). V is ground speed, L the mean log speed.',
        'It should be good to about 1 %. For a Keltron V3, where only a fixed error can be corrected, correct the log nearer economical speed and note the residual error for 2 or 3 speed groups.'] },
    ],
  },
  {
    id: 'lubber', title: 'Lubber\'s line alignment',
    cards: [
      { title: 'Why it matters', points: [
        'Compass repeaters on the bridge, the wings and elsewhere are aligned to the gyro. If a repeater\'s lubber\'s line is not on the fore and aft line, gyro bearings taken from it are wrong.',
        'It is easily displaced by maintenance work or gunfire.'] },
      { title: 'Methods', points: [
        'Centre line repeater from which the Jackstaff can be seen: compare the bearing by the lubber\'s line directly with the bearing of the Jackstaff.',
        'Repeater off the centre line: find the toe-in angle E from the offset d of the repeater and its fore and aft distance to the Jackstaff (tan E = d / distance). The wing repeater is aligned so that the Jackstaff reads the ship\'s head plus E (port side) or minus E (starboard side).',
        'Alternative: take the relative bearing of a distant object together from the displaced repeater and from a correctly aligned centre line repeater. With 6 m of displacement the difference is under half a degree at over half a mile, and insignificant beyond a mile, but the toe-in method is more accurate.',
        'Switch the repeater supplies off before checking the toe-in angle, so that ship movement alongside causes no error.'] },
      { title: 'When to check', points: [
        'At regular intervals, and especially after work on the repeater or near it, before sailing or berthing, before replenishment, and after a heavy shock such as gunfire or collision.'] },
    ],
  },
  {
    id: 'swing', title: 'Swinging ship',
    cards: [
      { title: 'What and when', points: [
        'Swinging ship is the whole operation of adjusting the magnetic compass: finding the deviation, adjusting it with correctors, and observing the residual deviation.',
        'Swing before sea trials of a new ship; after extensive structural alterations near the compass; after a considerable change of magnetic latitude; after refit or lying a long time in one direction; if any corrector magnets have been altered; after modification or repair of degaussing (DG) equipment; after wiping or flashing treatment; and at least once a year.'] },
      { title: 'Methods of comparing bearings', points: [
        'By bearing of a heavenly body: elevation under 30 degrees, small rate of change of bearing (the sun in the morning or evening). True bearings from sight reduction tables or Weir\'s azimuth diagram, tabulated beforehand about every 4 minutes and converted to magnetic. The ship is not restricted in her movement.',
        'By bearing of a distant object: the ship\'s position must be known; the magnetic bearing is taken from the chart, so the accuracy depends on the chart. Can be used at a buoy, at single anchor or underway.',
        'By transits: turn the ship on a known bearing of two or more objects in line; difficult to hold through the headings in wind, sea or stream.',
        'By reciprocal bearing: take the bearing of a shore compass or bearing plate; the shore signals the bearings by radio, and the reciprocal is compared with the ship\'s compass bearing.',
        'By gyro compass: compare the ship\'s head by gyro and magnetic compass on different headings; the gyro error must be accurately known and allowed for. Convenient when placing correctors, but use it for the deviation only if nothing else is practicable.',
        'Deviation of between-deck compasses comes from comparing the ship\'s head with the standard compass. Variation can be taken from the chart or calculated from the mean compass error.'] },
      { title: 'Planning, time and preparation', points: [
        'Decide the method and choose a swinging ground. Minimum time to allow: harbour adjustment 1 hour; swinging without DG 1.5 hours; with DG on, 3 hours for a compass with DG corrector coils and 1.5 hours without them.',
        'A week before, inspect the compass. Before a first swing of a new ship, follow the new-ship inspection in BR 45(3). Before later swings check the record of the last swing, adjust the spheres (coefficients D and E), line up the steering compass lubber\'s line (coefficient A), and check the lubber\'s line of the standard compass and the binnacle keys.',
        'Test the card for friction: deflect it about 20 degrees with a magnet and release it; it should return to its original position (secure the ship fore and aft first).',
        'A bubble in the bowl suggests a leak; replace the bowl, or stop the leak and refill with the alcohol and distilled water mixture, rocking the bowl to free the air.',
        'Have spare magnets, spanners, screwdrivers and the azimuth ring ready, communications with the compass positions, the bridge and the DG panel tested, and the DG equipment serviceable with the current settings known.'] },
      { title: 'Conditions for the swing', points: [
        'Funnels at their normal sea-going temperature; ship upright to avoid heeling error; all moveable iron (guns, boats, cranes) in its sea-going position.',
        'Ship at least 3 cables clear of other vessels during the swing.',
        'If swinging with DG on, switch it on at least four hours before so that it reaches its operating temperature.'] },
      { title: 'Harbour adjustments', points: [
        'Soft iron correctors: check and adjust the Flinders bar (corrects the c rod, coefficient B; usually only after a large change of magnetic latitude) and the position of the spheres (a and e rods, coefficients D and E, from the record of the previous swing).',
        'Permanent magnet correctors: correct heeling error with vertical permanent magnets, using the heeling error instrument. With no g rod effect the ship\'s head does not matter; if there is one, place the ship\'s head within 10 degrees of east or west (magnetic) first. With DG on, do the heeling correction with the DG operating.'] },
      { title: 'Adjustments at sea and the swing', points: [
        'Correct heeling error if not already done. Put the ship\'s head east or west by compass and adjust the fore and aft magnet (coefficient B) until there is no deviation; put it north or south and adjust the athwartships magnets; repeat the first if the deviation was large.',
        'On the opposite headings halve the remaining deviation by re-adjusting the fore and aft, and then the athwartships magnets. On the intercardinal point between those used, check the setting of the spheres.',
        'The swing: turn the ship slowly round and obtain the deviation on at least eight, preferably sixteen, headings. If possible steady on each heading, and take at least 40 minutes for the whole swing.',
        'Enter the deviations in the Compass Swing record to get the coefficients and the deviation card.'] },
    ],
  },
  {
    id: 'echo', title: 'Echo sounder',
    cards: [
      { title: 'When to calibrate', points: [
        'Every time the ship enters dry dock, annually, after each refit, after any major modification or repair, when in doubt of its accuracy, and preferably before every cast-off with a hand lead line.'] },
      { title: 'Methods', points: [
        'Dry dock: with the power supply still on, before the ship rests on the chocks, compare the depth of the dock as marked with the echo sounder depth. Check when the transducer is in line with the dock markings; near the dock gate, accumulated sludge can give false echoes.',
        'Hand lead line: preferably before leaving harbour. It also cross-checks the depth at the berth. Keeping the lead lines in order is the navigator\'s duty.',
        'Bar check: lower a metal bar below the transducer by measured distances and compare the sounder readings with the bar. Not currently in use in the Indian Navy.'] },
      { title: 'Reporting depths', points: [
        'When special sea dutymen are closed up, or when ordered, an additional person monitors and reports depths, suffixing the depth with Steady, Deepening, Shoaling or Below Minimum Depth.',
        'Standard reports at least once a minute, or on each change of 1 m in under 20 m of water, 5 m between 20 and 40 m, and 10 m above 40 m.'] },
    ],
  },
];
