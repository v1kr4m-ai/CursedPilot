// United States Navy: carriers, destroyers (Arleigh Burke and Zumwalt), amphibious ships, and the strategic and attack submarines. Written from the commonly published
// class figures and hull numbers (Wikipedia class tables, Oct 2026). Years are commissioning years. NOT complete (no mine or support ships or patrol craft; Arleigh Burke
// from DDG-125 and Ticonderoga hulls other than the five active are left out) and status changes after the sources were read may be missing: check the Naval Vessel Register.
import type { NavyData } from '../foreignNavies.ts';
import { cls } from './_util.ts';
import type { ShipRow } from '../indianNavy.ts';

/** [hull number, name, commissioned year] -> rows with the pennant written as the hull symbol and number */
const rows = (sym: string, list: [number, string, string][]): ShipRow[] => list.map(([n, name, y]) => [name, `${sym}-${n}`, y]);

export const USA: NavyData = {
  navy: { id: 'us', label: 'USA', prefix: 'USS', words: 'usa us united states american usn uss' },
  classes: {
    nimitz: cls('Nimitz class', 'Aircraft Carriers', 'Nimitz-class_aircraft_carrier', { builder: 'Newport News Shipbuilding', displacement: '~100,000 t (full load)', length: '332.8 m', beam: '40.8 m (waterline), 76.8 m (flight deck)', draught: '11.3 m', speed: '30+ kn', propulsion: '2 × A4W nuclear reactors; 4 shafts', complement: '~5,000 (incl. air wing)', aircraft: '60+ aircraft' }),
    ford: cls('Gerald R. Ford class', 'Aircraft Carriers', 'Gerald_R._Ford-class_aircraft_carrier', { builder: 'Newport News Shipbuilding', displacement: '~100,000 t (full load)', length: '337 m', beam: '41 m (waterline), 78 m (flight deck)', speed: '30+ kn', propulsion: '2 × A1B nuclear reactors; 4 shafts', aircraft: '75+ aircraft' }),
    ddg1: cls('Arleigh Burke class (Flight I/II)', 'Destroyers', 'Arleigh_Burke-class_destroyer', { builder: 'Bath Iron Works / Ingalls', displacement: '8,300 t (full load)', length: '153.8 m', beam: '20.4 m', draught: '9.4 m', speed: '30+ kn', propulsion: '4 × GE LM2500 gas turbines; 2 shafts', complement: '~300' }),
    ddg2a: cls('Arleigh Burke class (Flight IIA)', 'Destroyers', 'Arleigh_Burke-class_destroyer', { builder: 'Bath Iron Works / Ingalls', displacement: '9,200 t (full load)', length: '155.3 m', beam: '20.4 m', draught: '9.3 m', speed: '30+ kn', propulsion: '4 × GE LM2500 gas turbines; 2 shafts', complement: '~320', aircraft: '2 × MH-60R helicopters' }),
    ddg3: cls('Arleigh Burke class (Flight III)', 'Destroyers', 'Arleigh_Burke-class_destroyer', { builder: 'Bath Iron Works / Ingalls', displacement: '9,700 t (full load)', length: '155.3 m', beam: '20.4 m', speed: '30+ kn', complement: '~380' }),
    zumwalt: cls('Zumwalt class', 'Destroyers', 'Zumwalt-class_destroyer', { builder: 'Bath Iron Works', displacement: '15,900 t (full load)', length: '183 m', beam: '24.6 m', draught: '8.4 m', speed: '30 kn' }),
    america: cls('America class (LHA)', 'Amphibious Ships', 'America-class_amphibious_assault_ship', { builder: 'Ingalls Shipbuilding', displacement: '45,000 t (full load)', length: '257 m', beam: '32 m (waterline)', speed: '22 kn' }),
    wasp: cls('Wasp class (LHD)', 'Amphibious Ships', 'Wasp-class_amphibious_assault_ship', { builder: 'Ingalls Shipbuilding', displacement: '41,000 t (full load)', length: '257 m', beam: '32 m (waterline)', draught: '8.1 m', speed: '22 kn' }),
    sanantonio: cls('San Antonio class (LPD)', 'Amphibious Ships', 'San_Antonio-class_amphibious_transport_dock', { builder: 'Ingalls / Avondale', displacement: '24,900 t (full load)', length: '208.4 m', beam: '31.9 m', draught: '7 m', speed: '22 kn' }),
    tico: cls('Ticonderoga class (CG)', 'Cruisers', 'Ticonderoga-class_cruiser', { builder: 'Ingalls / Bath Iron Works', displacement: '9,800 t (full load)', length: '172.8 m', beam: '16.8 m', draught: '10.2 m', speed: '32.5 kn' }),
    la: cls('Los Angeles class (SSN)', 'Submarines', 'Los_Angeles-class_submarine', { builder: 'Newport News / General Dynamics Electric Boat', displacement: '6,927 t (submerged)', length: '110 m', beam: '10 m', draught: '9.4 m', speed: '25+ kn (submerged)', propulsion: '1 × S6G PWR nuclear reactor; 1 shaft' }),
    lcs2: cls('Independence class (LCS)', 'Corvettes', 'Independence-class_littoral_combat_ship', { builder: 'Austal USA, Mobile', displacement: '3,100 t (full load)', length: '127.4 m', beam: '31.6 m', draught: '4.3 m', speed: '40+ kn' }),
    lcs1: cls('Freedom class (LCS)', 'Corvettes', 'Freedom-class_littoral_combat_ship', { builder: 'Marinette Marine', displacement: '3,500 t (full load)', length: '118.1 m', beam: '17.5 m', draught: '3.9 m', speed: '40+ kn' }),
    harpers: cls('Harpers Ferry class (LSD)', 'Amphibious Ships', 'Harpers_Ferry-class_dock_landing_ship', { builder: 'Avondale Shipyards', displacement: '16,740 t (full load)', length: '185.6 m', beam: '25.6 m', draught: '6.3 m', speed: '22 kn' }),
    blueridge: cls('Blue Ridge class (command ship)', 'Other', 'Blue_Ridge-class_command_ship', { builder: 'Philadelphia Naval Shipyard / Newport News', displacement: '18,600 t (full load)', length: '194 m', beam: '33 m', speed: '23 kn' }),
    ohio: cls('Ohio class (SSBN)', 'Submarines', 'Ohio-class_submarine', { builder: 'General Dynamics Electric Boat', displacement: '18,750 t (submerged)', length: '170.7 m', beam: '12.8 m', draught: '11.1 m', speed: '25 kn (submerged)', propulsion: '1 × S8G PWR nuclear reactor; 1 shaft' }),
    ssgn: cls('Ohio class (SSGN, guided-missile conversion)', 'Submarines', 'Ohio-class_submarine', { builder: 'General Dynamics Electric Boat', displacement: '18,750 t (submerged)', length: '170.7 m', beam: '12.8 m', draught: '11.1 m', speed: '25 kn (submerged)' }),
    virginia: cls('Virginia class (SSN)', 'Submarines', 'Virginia-class_submarine', { builder: 'General Dynamics Electric Boat / Newport News', displacement: '7,900 t (submerged)', length: '115 m', beam: '10.4 m', draught: '9.3 m', speed: '25+ kn (submerged)', propulsion: '1 × S9G PWR nuclear reactor; 1 shaft (pump-jet)' }),
    seawolf: cls('Seawolf class (SSN)', 'Submarines', 'Seawolf-class_submarine', { builder: 'General Dynamics Electric Boat', displacement: '9,138 t (submerged)', length: '107.6 m', beam: '12.9 m', speed: '35 kn (submerged)' }),
  },
  ships: {
    nimitz: rows('CVN', [[68, 'Nimitz', '1975'], [69, 'Dwight D. Eisenhower', '1977'], [70, 'Carl Vinson', '1982'], [71, 'Theodore Roosevelt', '1986'], [72, 'Abraham Lincoln', '1989'],
      [73, 'George Washington', '1992'], [74, 'John C. Stennis', '1995'], [75, 'Harry S. Truman', '1998'], [76, 'Ronald Reagan', '2003'], [77, 'George H. W. Bush', '2009']]),
    ford: rows('CVN', [[78, 'Gerald R. Ford', '2017']]),
    ddg1: rows('DDG', [[51, 'Arleigh Burke', '1991'], [52, 'Barry', '1992'], [53, 'John Paul Jones', '1993'], [54, 'Curtis Wilbur', '1994'], [55, 'Stout', '1994'], [56, 'John S. McCain', '1994'],
      [57, 'Mitscher', '1994'], [58, 'Laboon', '1995'], [59, 'Russell', '1995'], [60, 'Paul Hamilton', '1995'], [61, 'Ramage', '1995'], [62, 'Fitzgerald', '1995'], [63, 'Stethem', '1995'],
      [64, 'Carney', '1996'], [65, 'Benfold', '1996'], [66, 'Gonzalez', '1996'], [67, 'Cole', '1996'], [68, 'The Sullivans', '1997'], [69, 'Milius', '1996'], [70, 'Hopper', '1997'],
      [71, 'Ross', '1997'], [72, 'Mahan', '1998'], [73, 'Decatur', '1998'], [74, 'McFaul', '1998'], [75, 'Donald Cook', '1998'], [76, 'Higgins', '1999'], [77, "O'Kane", '1999'], [78, 'Porter', '1999']]),
    ddg2a: rows('DDG', [[79, 'Oscar Austin', '2000'], [80, 'Roosevelt', '2000'], [81, 'Winston S. Churchill', '2001'], [82, 'Lassen', '2001'], [83, 'Howard', '2001'], [84, 'Bulkeley', '2001'],
      [85, 'McCampbell', '2002'], [86, 'Shoup', '2002'], [87, 'Mason', '2003'], [88, 'Preble', '2002'], [89, 'Mustin', '2003'], [90, 'Chafee', '2003'], [91, 'Pinckney', '2004'], [92, 'Momsen', '2004'],
      [93, 'Chung-Hoon', '2004'], [94, 'Nitze', '2005'], [95, 'James E. Williams', '2005'], [96, 'Bainbridge', '2005'], [97, 'Halsey', '2005'], [98, 'Forrest Sherman', '2006'], [99, 'Farragut', '2006'],
      [100, 'Kidd', '2007'], [101, 'Gridley', '2007'], [102, 'Sampson', '2007'], [103, 'Truxtun', '2009'], [104, 'Sterett', '2008'], [105, 'Dewey', '2010'], [106, 'Stockdale', '2009'], [107, 'Gravely', '2010'],
      [108, 'Wayne E. Meyer', '2009'], [109, 'Jason Dunham', '2010'], [110, 'William P. Lawrence', '2011'], [111, 'Spruance', '2011'], [112, 'Michael Murphy', '2012'], [113, 'John Finn', '2017'],
      [114, 'Ralph Johnson', '2017'], [115, 'Rafael Peralta', '2017'], [116, 'Thomas Hudner', '2018'], [117, 'Paul Ignatius', '2019'], [118, 'Daniel Inouye', '2021'], [119, 'Delbert D. Black', '2020'],
      [120, 'Carl M. Levin', '2021'], [121, 'Frank E. Petersen Jr.', '2022'], [122, 'John Basilone', ''], [123, 'Lenah Sutcliffe Higbee', '2022'], [124, 'Harvey C. Barnum Jr.', '']]),
    zumwalt: rows('DDG', [[1000, 'Zumwalt', '2016'], [1001, 'Michael Monsoor', '2019'], [1002, 'Lyndon B. Johnson', '2022']]),
    america: rows('LHA', [[6, 'America', '2014'], [7, 'Tripoli', '2020']]),
    wasp: rows('LHD', [[1, 'Wasp', '1989'], [2, 'Essex', '1992'], [3, 'Kearsarge', '1993'], [4, 'Boxer', '1995'], [5, 'Bataan', '1997'], [7, 'Iwo Jima', '2001'], [8, 'Makin Island', '2009']]),
    sanantonio: rows('LPD', [[17, 'San Antonio', '2006'], [18, 'New Orleans', '2007'], [19, 'Mesa Verde', '2008'], [20, 'Green Bay', '2009'], [21, 'New York', '2009'], [22, 'San Diego', '2012'],
      [23, 'Anchorage', '2013'], [24, 'Arlington', '2013'], [25, 'Somerset', '2014'], [26, 'John P. Murtha', '2016'], [27, 'Portland', '2017'], [28, 'Fort Lauderdale', '2022'], [29, 'Richard M. McCool Jr.', '2022']]),
    tico: rows('CG', [[59, 'Princeton', '1989'], [62, 'Robert Smalls', '1989'], [64, 'Gettysburg', '1991'], [65, 'Chosin', '1991'], [71, 'Cape St. George', '1993']]),
    la: rows('SSN', [[750, 'Newport News', '1989'], [752, 'Pasadena', '1989'], [753, 'Albany', '1990'], [754, 'Topeka', '1989'], [756, 'Scranton', '1991'], [757, 'Alexandria', '1991'], [758, 'Asheville', '1991'], [759, 'Jefferson City', '1992'], [760, 'Annapolis', '1992'], [761, 'Springfield', '1993'], [762, 'Columbus', '1993'], [763, 'Santa Fe', '1994'], [764, 'Boise', '1992'], [765, 'Montpelier', '1993'], [766, 'Charlotte', '1994'], [767, 'Hampton', '1993'], [768, 'Hartford', '1994'], [769, 'Toledo', '1995'], [770, 'Tucson', '1995'], [771, 'Columbia', '1995'], [772, 'Greeneville', '1996'], [773, 'Cheyenne', '1996']]),
    lcs2: rows('LCS', [[6, 'Jackson', '2015'], [8, 'Montgomery', '2016'], [10, 'Gabrielle Giffords', '2017'], [12, 'Omaha', '2018'], [14, 'Manchester', '2018'], [16, 'Tulsa', '2019'], [18, 'Charleston', '2019'], [20, 'Cincinnati', '2019'], [22, 'Kansas City', '2020'], [24, 'Oakland', '2021'], [26, 'Mobile', '2021'], [28, 'Savannah', '2022'], [30, 'Canberra', '2023'], [32, 'Santa Barbara', '2023'], [34, 'Augusta', '2023'], [36, 'Kingsville', '2024'], [38, 'Pierre', '2025']]),
    lcs1: rows('LCS', [[13, 'Wichita', '2019'], [15, 'Billings', '2019'], [17, 'Indianapolis', '2019'], [19, 'St. Louis', '2020'], [21, 'Minneapolis-Saint Paul', '2022'], [23, 'Cooperstown', '2023'], [25, 'Marinette', '2023'], [27, 'Nantucket', '2024'], [29, 'Beloit', '2024'], [31, 'Cleveland', '2026']]),
    harpers: rows('LSD', [[49, 'Harpers Ferry', '1995'], [50, 'Carter Hall', '1995'], [51, 'Oak Hill', '1996'], [52, 'Pearl Harbor', '1998']]),
    blueridge: rows('LCC', [[19, 'Blue Ridge', '1970'], [20, 'Mount Whitney', '1971']]),
    ohio: rows('SSBN', [[730, 'Henry M. Jackson', '1984'], [731, 'Alabama', '1985'], [732, 'Alaska', '1986'], [733, 'Nevada', '1986'], [734, 'Tennessee', '1988'], [735, 'Pennsylvania', '1989'],
      [736, 'West Virginia', '1990'], [737, 'Kentucky', '1991'], [738, 'Maryland', '1992'], [739, 'Nebraska', '1993'], [740, 'Rhode Island', '1994'], [741, 'Maine', '1995'], [742, 'Wyoming', '1996'], [743, 'Louisiana', '1997']]),
    ssgn: rows('SSGN', [[726, 'Ohio', '1981'], [727, 'Michigan', '1982'], [728, 'Florida', '1983'], [729, 'Georgia', '1984']]),
    virginia: rows('SSN', [[774, 'Virginia', '2004'], [775, 'Texas', '2006'], [776, 'Hawaii', '2007'], [777, 'North Carolina', '2008'], [778, 'New Hampshire', '2008'], [779, 'New Mexico', '2010'],
      [780, 'Missouri', '2010'], [781, 'California', '2011'], [782, 'Mississippi', '2012'], [783, 'Minnesota', '2013'], [784, 'North Dakota', '2014'], [785, 'John Warner', '2015'], [786, 'Illinois', '2016'],
      [787, 'Washington', '2017'], [788, 'Colorado', '2018'], [789, 'Indiana', '2018'], [790, 'South Dakota', '2019'], [791, 'Delaware', '2020'], [792, 'Vermont', '2020'], [793, 'Oregon', '2022'],
      [794, 'Montana', '2022'], [795, 'Hyman G. Rickover', '2023'], [796, 'New Jersey', '2024'], [797, 'Iowa', '2025'], [798, 'Massachusetts', '2026'], [799, 'Idaho', '2026']]),
    seawolf: rows('SSN', [[21, 'Seawolf', '1997'], [22, 'Connecticut', '1998'], [23, 'Jimmy Carter', '2005']]),
  },
};
