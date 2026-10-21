// A quick reference: IALA buoyage (Region A, which India uses), the lights and shapes of the International Regulations for
// Preventing Collisions at Sea (the COLREGS), the sound signals, and a summary of the steering and sailing rules. It is a
// summary written for a quick look, not the Regulations: the Regulations, the ship's orders and the current IALA and
// Admiralty publications prevail. Pure data; `node tools/refData.check.ts` checks its shape.

export type BodyShape = 'can' | 'cone' | 'pillar' | 'sphere' | 'spar';
export type Topmark = 'can' | 'cone-up' | 'cone-down' | 'two-cones-up' | 'two-cones-down' | 'two-cones-base' | 'two-cones-point' | 'two-spheres' | 'sphere' | 'x' | 'cross' | null;

export interface Buoy {
  id: string;
  group: 'Lateral' | 'Cardinal' | 'Other';
  name: string;
  colour: string;
  /** how the body is painted, for the picture: horizontal bands from the top (each as a share of the height) or vertical stripes */
  paint: { kind: 'bands'; bands: [string, number][] } | { kind: 'stripes'; colours: [string, string] };
  shape: BodyShape;
  topmark: Topmark;
  topmarkText: string;
  light: string;
  meaning: string;
}

const Y = '#facc15', K = '#111827', RD = '#dc2626', G = '#16a34a', W = '#f8fafc', B = '#2563eb';

export const BUOYS: Buoy[] = [
  { id: 'port', group: 'Lateral', name: 'Port-hand mark', colour: 'Red', paint: { kind: 'bands', bands: [[RD, 1]] }, shape: 'can', topmark: 'can', topmarkText: 'Single red can (cylinder)',
    light: 'Red, any rhythm except Fl(2+1)', meaning: 'Leave to PORT when going in the direction of buoyage (entering from seaward).' },
  { id: 'stbd', group: 'Lateral', name: 'Starboard-hand mark', colour: 'Green', paint: { kind: 'bands', bands: [[G, 1]] }, shape: 'cone', topmark: 'cone-up', topmarkText: 'Single green cone, point up',
    light: 'Green, any rhythm except Fl(2+1)', meaning: 'Leave to STARBOARD when going in the direction of buoyage (entering from seaward).' },
  { id: 'pref-stbd', group: 'Lateral', name: 'Preferred channel to starboard', colour: 'Red with one broad green horizontal band', paint: { kind: 'bands', bands: [[RD, 0.35], [G, 0.3], [RD, 0.35]] }, shape: 'can', topmark: 'can', topmarkText: 'Red can, if fitted',
    light: 'Red, Fl(2+1)', meaning: 'At a division of the channel. The main (preferred) channel is to starboard: pass it as a port-hand mark to follow the main channel.' },
  { id: 'pref-port', group: 'Lateral', name: 'Preferred channel to port', colour: 'Green with one broad red horizontal band', paint: { kind: 'bands', bands: [[G, 0.35], [RD, 0.3], [G, 0.35]] }, shape: 'cone', topmark: 'cone-up', topmarkText: 'Green cone, point up, if fitted',
    light: 'Green, Fl(2+1)', meaning: 'At a division of the channel. The main (preferred) channel is to port: pass it as a starboard-hand mark to follow the main channel.' },
  { id: 'north', group: 'Cardinal', name: 'North cardinal', colour: 'Black above yellow', paint: { kind: 'bands', bands: [[K, 0.5], [Y, 0.5]] }, shape: 'pillar', topmark: 'two-cones-up', topmarkText: 'Two black cones, points up',
    light: 'White, VQ continuous, or Q continuous', meaning: 'Safe water is to the NORTH of the mark: pass to the north of it.' },
  { id: 'east', group: 'Cardinal', name: 'East cardinal', colour: 'Black with one broad yellow band', paint: { kind: 'bands', bands: [[K, 0.35], [Y, 0.3], [K, 0.35]] }, shape: 'pillar', topmark: 'two-cones-base', topmarkText: 'Two black cones, bases together',
    light: 'White, VQ(3) every 5 s, or Q(3) every 10 s', meaning: 'Safe water is to the EAST of the mark: pass to the east of it.' },
  { id: 'south', group: 'Cardinal', name: 'South cardinal', colour: 'Yellow above black', paint: { kind: 'bands', bands: [[Y, 0.5], [K, 0.5]] }, shape: 'pillar', topmark: 'two-cones-down', topmarkText: 'Two black cones, points down',
    light: 'White, VQ(6) + LFl every 10 s, or Q(6) + LFl every 15 s', meaning: 'Safe water is to the SOUTH of the mark: pass to the south of it.' },
  { id: 'west', group: 'Cardinal', name: 'West cardinal', colour: 'Yellow with one broad black band', paint: { kind: 'bands', bands: [[Y, 0.35], [K, 0.3], [Y, 0.35]] }, shape: 'pillar', topmark: 'two-cones-point', topmarkText: 'Two black cones, points together',
    light: 'White, VQ(9) every 10 s, or Q(9) every 15 s', meaning: 'Safe water is to the WEST of the mark: pass to the west of it.' },
  { id: 'isolated', group: 'Other', name: 'Isolated danger', colour: 'Black with one or more broad red horizontal bands', paint: { kind: 'bands', bands: [[K, 0.3], [RD, 0.2], [K, 0.2], [RD, 0.2], [K, 0.1]] }, shape: 'pillar', topmark: 'two-spheres', topmarkText: 'Two black spheres, one above the other',
    light: 'White, Fl(2)', meaning: 'A danger of limited size with navigable water all round it. Keep clear of it on any side.' },
  { id: 'safe', group: 'Other', name: 'Safe water mark', colour: 'Red and white vertical stripes', paint: { kind: 'stripes', colours: [RD, W] }, shape: 'sphere', topmark: 'sphere', topmarkText: 'One red sphere, if fitted',
    light: 'White: Iso, Oc, LFl every 10 s, or Mo(A)', meaning: 'Navigable water all round: a mid-channel or landfall mark. It may be passed on any side.' },
  { id: 'special', group: 'Other', name: 'Special mark', colour: 'Yellow', paint: { kind: 'bands', bands: [[Y, 1]] }, shape: 'pillar', topmark: 'x', topmarkText: 'One yellow X, if fitted',
    light: 'Yellow, any rhythm not used for the white lights', meaning: 'Not mainly to help navigation: ODAS and survey buoys, outfalls, cables and pipelines, exercise areas, recreation areas. See the chart.' },
  { id: 'wreck', group: 'Other', name: 'Emergency wreck marking', colour: 'Blue and yellow vertical stripes', paint: { kind: 'stripes', colours: [B, Y] }, shape: 'pillar', topmark: 'cross', topmarkText: 'Upright yellow cross, if fitted',
    light: 'Blue and yellow flashes, alternately', meaning: 'A new, dangerous wreck not yet shown on charts or in Notices to Mariners. Keep well clear.' },
];

export const BUOYAGE_NOTES = [
  'India uses IALA Region A: entering from seaward, leave RED marks to PORT and GREEN marks to STARBOARD. In Region B (the Americas, Japan, Korea, the Philippines) the colours are the other way round.',
  'Cardinal marks: the points of the topmark cones show where the black is. North: both up (black at the top). South: both down (black at the bottom). West: points together, like a waist, the black is in the middle between the two yellow ends. East: bases together, like an egg.',
  'Cardinal lights are white and follow the clock face: East is 3 flashes, South is 6 flashes and a long flash, West is 9 flashes, North is continuous.',
  'Light rhythms: Fl flashing, Q quick (50 to 60 flashes a minute), VQ very quick (100 to 120), Iso isophase (light and dark equal), Oc occulting, LFl a long flash of 2 s or more, Mo(A) Morse A.',
];

// ---- lights and shapes -----------------------------------------------------------------------------------------------------

/** A picture of the lights (seen from ahead unless `view` says otherwise) and the day shapes. Colours: w white, r red, g green, y yellow. */
export interface LightSpec { c: 'w' | 'r' | 'g' | 'y'; t: 'masthead' | 'all-round'; opt?: boolean }
export type DayShape = 'ball' | 'diamond' | 'cylinder' | 'cone-up' | 'cone-down' | 'cones-points-together'
export interface LightPic { stack: LightSpec[]; sides?: boolean; stern?: boolean; day?: DayShape[]; view?: string }
export interface RefRow { title: string; lines: string[]; rule?: number | number[]; pic?: LightPic }

export const LIGHT_TYPES: RefRow[] = [
  { title: 'Masthead light', rule: 21, lines: ['White, over the fore and aft centre line, shown over an arc of 225° (from right ahead to 22.5° abaft the beam on each side).'] },
  { title: 'Sidelights', rule: 21, lines: ['Green on the starboard side and red on the port side, each over an arc of 112.5° (from right ahead to 22.5° abaft the beam on its own side).'] },
  { title: 'Sternlight', rule: 21, lines: ['White, over an arc of 135° (67.5° each side of right astern).'] },
  { title: 'Towing light', rule: 21, lines: ['Yellow, the same arc as the sternlight (135°), shown above the sternlight.'] },
  { title: 'All-round light', rule: 21, lines: ['A light over an arc of 360°, in the colour the Rules give.'] },
  { title: 'Flashing light', rule: 21, lines: ['A light that flashes at regular intervals of 120 flashes or more a minute.'] },
];

export const VISIBILITY: { length: string; masthead: string; side: string; stern: string; towing: string; allRound: string }[] = [
  { length: '50 m or more', masthead: '6 nm', side: '3 nm', stern: '3 nm', towing: '3 nm', allRound: '3 nm' },
  { length: '12 m to under 50 m', masthead: '5 nm (3 nm if under 20 m)', side: '2 nm', stern: '2 nm', towing: '2 nm', allRound: '2 nm' },
  { length: 'Under 12 m', masthead: '2 nm', side: '1 nm', stern: '2 nm', towing: '2 nm', allRound: '2 nm' },
];

export const VESSEL_LIGHTS: RefRow[] = [
  { title: 'Power-driven vessel underway (Rule 23)', rule: 23, pic: { stack: [{ c: 'w', t: 'masthead' }, { c: 'w', t: 'masthead' }], sides: true }, lines: ['Masthead light forward; a second masthead light abaft it and higher if 50 m or more (optional if under 50 m); sidelights; sternlight.', 'Under 12 m: may show one all-round white light and sidelights instead.', 'Day: none.'] },
  { title: 'Sailing vessel underway (Rule 25)', rule: 25, pic: { stack: [{ c: 'r', t: 'all-round', opt: true }, { c: 'g', t: 'all-round', opt: true }], sides: true, day: ['cone-down'] }, lines: ['Sidelights and sternlight. Under 20 m: sidelights and sternlight may be in one tricolour light at the masthead.', 'May also show, at or near the masthead, two all-round lights in a vertical line, red over green (not with the tricolour).', 'Under sail and engine together: day shape a cone, point down, forward. Under 7 m: if unable to show the lights, a white torch or lantern.'] },
  { title: 'Towing, tow 200 m or less (Rule 24)', rule: 24, pic: { stack: [{ c: 'w', t: 'masthead' }, { c: 'w', t: 'masthead' }], sides: true }, lines: ['Two masthead lights in a vertical line, sidelights, sternlight, and a yellow towing light above the sternlight.', 'The vessel towed: sidelights and sternlight.'] },
  { title: 'Towing, tow over 200 m (Rule 24)', rule: 24, pic: { stack: [{ c: 'w', t: 'masthead' }, { c: 'w', t: 'masthead' }, { c: 'w', t: 'masthead' }], sides: true, day: ['diamond'] }, lines: ['As above but three masthead lights in a vertical line. Day: a diamond shape where the tow is over 200 m.'] },
  { title: 'Trawling (Rule 26)', rule: 26, pic: { stack: [{ c: 'g', t: 'all-round' }, { c: 'w', t: 'all-round' }], sides: true, day: ['cones-points-together'] }, lines: ['Two all-round lights in a vertical line: green over white. With way on: sidelights and sternlight as well.', 'Day: two cones with points together, one above the other.', 'Gear extending more than 150 m horizontally: another all-round white light in the direction of the gear (day: a cone, point up).'] },
  { title: 'Fishing, not trawling (Rule 26)', rule: 26, pic: { stack: [{ c: 'r', t: 'all-round' }, { c: 'w', t: 'all-round' }], sides: true, day: ['cones-points-together'] }, lines: ['Two all-round lights in a vertical line: red over white. With way on: sidelights and sternlight as well. Day: two cones, points together.'] },
  { title: 'Not under command (Rule 27)', rule: 27, pic: { stack: [{ c: 'r', t: 'all-round' }, { c: 'r', t: 'all-round' }], day: ['ball', 'ball'] }, lines: ['Two all-round red lights in a vertical line. Making way: sidelights and sternlight as well.', 'Day: two balls in a vertical line.'] },
  { title: 'Restricted in ability to manoeuvre (Rule 27)', rule: 27, pic: { stack: [{ c: 'r', t: 'all-round' }, { c: 'w', t: 'all-round' }, { c: 'r', t: 'all-round' }], day: ['ball', 'diamond', 'ball'] }, lines: ['Three all-round lights in a vertical line: red, white, red. Making way: masthead lights, sidelights and sternlight as well. At anchor: the anchor lights as well.', 'Day: three shapes in a vertical line: ball, diamond, ball.'] },
  { title: 'Constrained by her draught (Rule 28)', rule: 28, pic: { stack: [{ c: 'r', t: 'all-round' }, { c: 'r', t: 'all-round' }, { c: 'r', t: 'all-round' }, { c: 'w', t: 'masthead' }, { c: 'w', t: 'masthead' }], sides: true, day: ['cylinder'] }, lines: ['In addition to the lights for a power-driven vessel, three all-round red lights in a vertical line. Day: a cylinder.'] },
  { title: 'Pilot vessel on duty (Rule 29)', rule: 29, pic: { stack: [{ c: 'w', t: 'all-round' }, { c: 'r', t: 'all-round' }], sides: true }, lines: ['Two all-round lights in a vertical line: white over red. Underway: sidelights and sternlight as well; at anchor: the anchor lights as well.'] },
  { title: 'At anchor (Rule 30)', rule: 30, pic: { stack: [{ c: 'w', t: 'all-round' }, { c: 'w', t: 'all-round' }], day: ['ball'], view: 'The upper light is the forward one' }, lines: ['50 m or more: an all-round white light forward and another, lower, at or near the stern. A vessel of 100 m or more must also use her working or equivalent lights to illuminate her decks.', 'Under 50 m: one all-round white light where it can best be seen.', 'Day: one ball in the forepart.'] },
  { title: 'Aground (Rule 30)', rule: 30, pic: { stack: [{ c: 'w', t: 'all-round' }, { c: 'w', t: 'all-round' }, { c: 'r', t: 'all-round' }, { c: 'r', t: 'all-round' }], day: ['ball', 'ball', 'ball'] }, lines: ['The anchor lights, and two all-round red lights in a vertical line. Day: three balls in a vertical line.'] },
  { title: 'Overtaken vessel / any vessel seen from astern', rule: 21, pic: { stack: [], stern: true, view: 'Seen from astern' }, lines: ['Only the sternlight is seen from the overtaking sector, more than 22.5° abaft the beam.'] },
];

export const SHAPES: RefRow[] = [
  { title: 'Ball', rule: [24, 25, 26, 27, 28, 30], lines: ['At anchor (one, forward); not under command (two); aground (three); restricted in ability to manoeuvre (top and bottom of three).'] },
  { title: 'Cone, point up', rule: [24, 25, 26, 27, 28, 30], lines: ['Fishing gear extending more than 150 m; a vessel under sail and engine shows it point down.'] },
  { title: 'Cone, point down', rule: [24, 25, 26, 27, 28, 30], lines: ['Sailing vessel that is also using her engine.'] },
  { title: 'Two cones, points together', rule: [24, 25, 26, 27, 28, 30], lines: ['A vessel engaged in fishing.'] },
  { title: 'Cylinder', rule: [24, 25, 26, 27, 28, 30], lines: ['A vessel constrained by her draught.'] },
  { title: 'Diamond', rule: [24, 25, 26, 27, 28, 30], lines: ['A vessel towing when the length of the tow is over 200 m; the middle of three for restricted in ability to manoeuvre.'] },
];

// ---- sound signals ---------------------------------------------------------------------------------------------------------

export const SOUND_MANOEUVRING: RefRow[] = [
  { title: 'Short blast and prolonged blast', rule: 32, lines: ['A short blast is about 1 second. A prolonged blast is 4 to 6 seconds.'] },
  { title: 'One short blast', rule: 34, lines: ['I am altering my course to starboard.'] },
  { title: 'Two short blasts', rule: 34, lines: ['I am altering my course to port.'] },
  { title: 'Three short blasts', rule: 34, lines: ['I am operating astern propulsion.'] },
  { title: 'Five short and rapid blasts (or more)', rule: 34, lines: ['I do not understand your intentions, or I doubt that you are taking enough action to avoid collision (danger signal). May be backed by a flashing light.'] },
  { title: 'In a narrow channel, overtaking (Rule 34c)', rule: 34, lines: ['Two prolonged then one short: I intend to overtake you on your starboard side.', 'Two prolonged then two short: I intend to overtake you on your port side.', 'The vessel to be overtaken, if she agrees, sounds one prolonged, one short, one prolonged, one short, in that order.'] },
  { title: 'Approaching a bend (Rule 34e)', rule: 34, lines: ['One prolonged blast; a vessel that hears it on the other side of the bend answers with one prolonged blast.'] },
];

export const SOUND_FOG: RefRow[] = [
  { title: 'Power-driven vessel making way', rule: 35, lines: ['One prolonged blast at intervals of not more than 2 minutes.'] },
  { title: 'Power-driven vessel underway, stopped and making no way', rule: 35, lines: ['Two prolonged blasts in succession, about 2 seconds between them, at intervals of not more than 2 minutes.'] },
  { title: 'Not under command, restricted in ability to manoeuvre, constrained by draught, sailing, fishing, towing or pushing', rule: 35, lines: ['One prolonged and two short blasts at intervals of not more than 2 minutes.'] },
  { title: 'Vessel towed (the last one, if manned)', rule: 35, lines: ['One prolonged and three short blasts at intervals of not more than 2 minutes, after the towing vessel\'s signal when possible.'] },
  { title: 'At anchor', rule: 35, lines: ['Ring the bell rapidly for about 5 seconds at intervals of not more than 1 minute. A vessel of 100 m or more also sounds a gong rapidly for about 5 seconds aft, after the bell.', 'May also sound one short, one prolonged and one short blast to warn an approaching vessel.'] },
  { title: 'Aground', rule: 35, lines: ['The anchor signal, and three separate and distinct strokes of the bell before and after the rapid ringing. May also sound an appropriate whistle signal.'] },
  { title: 'Pilot vessel on duty', rule: 35, lines: ['May add four short blasts to the fog signal for her kind of vessel.'] },
];

export const REFERENCE_NOTE = 'A summary for a quick look. The International Regulations for Preventing Collisions at Sea, the ship\'s orders and the current IALA and Admiralty publications (for example NP 735, IALA Maritime Buoyage System) are the authority.';
