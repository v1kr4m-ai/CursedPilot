// The methods of calibrating and checking the ship's navigation equipment, as cards to read, in the words of the books: Handbook on Navigation (2019)
// chapter 8 paragraphs 1 to 31, BR 45(1)(2) paras 1521 and 1522 (radar range and bearing errors) and BR 45(3) para 0427 (speed log calculations and
// examples 4-5 and 4-6). Each card says where it comes from. Only characters broken in the text extraction are mended (degree signs, a few misread
// letters); the formulas, which are drawn as pictures in the books, are written out in the form BR 45(3) prints them. The figures in the books are
// not reproduced. The books remain the authority.
// The calculators for most of these are the saved records in Calibration Data.

export interface MethodCard { title: string; /** where the words come from */ source: string; points: string[] }
export interface MethodTopic { id: string; title: string; cards: MethodCard[] }

export const CAL_METHODS: MethodTopic[] = [
 {
  "id": "radar",
  "title": "Radar",
  "cards": [
   {
    "title": "Para 1. Radar Range Error Checks",
    "source": "Handbook on Navigation (2019), chapter 8, para 1",
    "points": [
     "Whilst alongside, compare radar and charted ranges of conspicuous objects. I.E. = True Range - Radar Range Example: For true range of 1′.0 and radar range of 0′.98, the IE = 1.00 - 0.98 = + 0′.02. Hence, I.E. of + 0′.02 is to be added to the radar range to obtain true range."
    ]
   },
   {
    "title": "Para 2. Two-Mark Method",
    "source": "Handbook on Navigation (2019), chapter 8, para 2",
    "points": [
     "When passing directly between two conspicuous objects. Measure the two ranges, add them together and compare them with the charted distance. The index error will be half the difference between the radar and charted distance because two radar ranges have been used. l.E. = [(Charted Rge between two objects)--(Radar Range + Radar Range2)]",
     "Index Error = [ (Charted range between the two objects) - (Radar range 1 + Radar range 2) ] / 2"
    ]
   },
   {
    "title": "Para 3. Two-Ship Method",
    "source": "Handbook on Navigation (2019), chapter 8, para 3",
    "points": [
     "Two ships proceed in line abreast and close in until a double echo appears on the radar."
    ]
   },
   {
    "title": "Para 4. Three-Ship Method",
    "source": "Handbook on Navigation (2019), chapter 8, para 4",
    "points": [
     "Three ships proceed in line abreast and simultaneously measure ranges one from another. Ship A provides true range B to C and ship C provides true range A to B, so all three ships can obtain their index error."
    ]
   },
   {
    "title": "Para 5. Radar Bearing Checks",
    "source": "Handbook on Navigation (2019), chapter 8, para 5",
    "points": [
     "Apart from range errors, it is essential to determine the bearing error of the radar as well. This may be determined, whilst at anchorage/ along side, by taking the visual and radar bearings of a suitable object (which should be conspicuous visually and on the radar) and comparing the two. E.g. if the gyro bearing of an object is 180 and the radar bearing is 179, the bearing error = 180 - 179 = +1 degree, indicating that the radar bearing needs to be adjusted by +1 degree. However, the element of gyro error may still be present in this calculation, if not catered for initially."
    ]
   },
   {
    "title": "Para 6. Radar Calibration Chart",
    "source": "Handbook on Navigation (2019), chapter 8, para 6",
    "points": [
     "Take an HSA fix and compare charted and radar ranges from a conspicuous object. This may also be done by fixing your position using any other suitably reliable method and comparing the ranges thereafter."
    ]
   },
   {
    "title": "Para 7. Reduction of ‘Cocked Hat’",
    "source": "Handbook on Navigation (2019), chapter 8, para 7",
    "points": [
     "If three radar ranges produce a ‘cocked hat’, the radius of a circle contained within the hat provides a check on index error (this is not as accurate as the other methods above)."
    ]
   },
   {
    "title": "1521a. Radar Index Error",
    "source": "BR 45(1)(2) para 1521a",
    "points": [
     "The radar Index Error is the difference between the measured radar range and the true range. Radar range is intrinsically a function of time and is measured from the radar aerial. Ideally, the transmitter and receiver should be adjacent to the aerial but this is rarely possible. The following factors must therefore be taken into account before accurate range measurement is possible; together they comprise the (range) ‘Index Error’, which may be measured by several methods (see Paras 1521c-k).",
     "• Tx to Ae. The time take for a pulse to travel from the transmitter through the waveguide to the aerial.",
     "• Synchronisation. The time between reception of the synchronisation pulse at the display timebase generator and the start of the timebase scan.",
     "• Ae to Rx. The time taken for a pulse to travel from the aerial to the receiver.",
     "• Rx Delays. The time taken for the echo pulse to pass through the receiver and to be applied to the radar display.",
     "Radar Index Error is not constant and every opportunity (particularly before Blind Pilotage) should be taken to obtain a check for each range scale; after each check, the updated Index Error should be marked on each display. Allowance may have to be made for any range difference between the aerial and the Fixing position (normally the Bridge). The Index Error should be applied to all Fixes, Parallel Indices (PIs), etc. Many radar displays are set to under-range slightly and the radar Index Error then has to be added to the measured range. On some radars, maintenance staff may be able to adjust Index Error and either reduce or eliminate it."
    ]
   },
   {
    "title": "1521b. Other Causes of Range Errors",
    "source": "BR 45(1)(2) para 1521b",
    "points": [
     "In addition to Index Error, other possible causes of range errors are due the nature of the object itself or to operator technique, as follows:",
     "• Object's Reflecting Properties. Range errors may be caused by the reflecting properties of different objects and their incidence to a radar beam (eg vertical granite cliffs will give a much stronger echo than a sloping sandy beach).",
     "• Intertidal Areas. When comparing the radar picture to the chart, allowance must be made for the Height of Tide (HOT) in Intertidal areas (areas which cover and uncover depending on the HOT). As the HOT changes on a sloping shore, the appearance of the radar picture may be very different from that indicated by the charted coastline.",
     "• Operator Technique - Choice of Range Scales and Pulse Length. Provided that all the required objects can be displayed, the shortest possible range scale should be used for ranging (ie the 3 n.mile range scale is preferable to the 6 n.mile, the 6 n.mile to the 12 n.mile range scale etc). Off-centring the display may enable all the necessary ranges to be measured at a shorter range scale than would have been possible if the display remained centred. The operator should always use the shortest practicable Pulse Length and should always range on the near side of the echo."
    ]
   },
   {
    "title": "1521c. Establishing Radar Index Error by Radar Calibration Chart",
    "source": "BR 45(1)(2) para 1521c",
    "points": [
     "Large-Scale radar calibration charts are produced by UKHO for Portsmouth [UK] and Plymouth [UK] with curves of equal subtended angle between pairs of charted objects for use with Horizontal Sextant Angles (HSAs); range arcs for specific radar conspicuous objects at relatively long range are overlaid on the charts. This combination of chart Scale, HSA curves and radar range information (see Fig 15-11 below), allows the vessel's position to be plotted very accurately while providing equally large-Scale radar range information. When at anchor or secured to a buoy, these charts enable a ship to Fix its position to within 10 yards by HSA (see Para 0808) or even more accurately by DGPS (or equivalent); this allows the precise radar Index Error to be established very quickly and easily. This method provides a very accurate means of establishing radar Index Error, provided that the range can be read off the radar display with sufficient accuracy; for this reason, the method is more suited to calibrating weapon fire-control radars (which can display radar range to the nearest yard at very long distances) than calibrating navigational radars. In Fig 15-11 (above), the following HSAs have been used to Fix the ship's position at point X: A to C = 40° and C to B = 50°. The true range of a radar conspicuous mark can therefore be established from the chart and compared with a radar range taken simultaneously with the Fix; any difference is the Index Error. Example 15.1 - Radar Index Error by Radar Calibration Chart. Charted range 21565 yards Radar range 21545 yards Radar Index Error 20 yards (under-ranging) Thus a correction of +20 yards must be applied to all radar ranges."
    ]
   },
   {
    "title": "1521d. Establishing the Radar Index Error by a Normal Chart",
    "source": "BR 45(1)(2) para 1521d",
    "points": [
     "If the ship is alongside in a harbour and radar-conspicuous objects are available, then charted and radar ranges of the object may be compared. The difference is the Index Error."
    ]
   },
   {
    "title": "1521e. Establishing Radar Index Error by Two-Mark Method",
    "source": "BR 45(1)(2) para 1521e",
    "points": [
     "The two-mark method may be used if two radar-conspicuous objects are available, the range between them is known accurately from the chart and the ship is proceeding directly between the marks. In Fig 15-12 (below), simultaneous radar ranges of both objects (A and B ) are taken as the ship crosses the line between them. Both radar ranges include Index Error. AB is the charted distance between the two objects; ‘a’ is the radar range between the ship and object A; ‘b’ is the radar range between the ship and object B. Thus: AB = a + Index Error + b + Index Error 2 x Index Error = AB - (a + b) Index Error = AB - (a + b) . . . 15.6 2",
     "Index Error = [ AB - (a + b) ] / 2 (formula 15.6)"
    ]
   },
   {
    "title": "1521f. Establishing Radar Index Error by Three-Mark Method",
    "source": "BR 45(1)(2) para 1521f",
    "points": [
     "When three well charted, radar-conspicuous objects are situated around the ship, simultaneous radar ranges of all three objects may be taken. If the range arcs from the objects are drawn on the chart and produce a ‘radar cocked hat’, then the Index Error is the radius of the circle drawn tangential to the three range arcs (see Fig 15-13 below)."
    ]
   },
   {
    "title": "1521g. Establishing Radar Index Error by the HSA Method",
    "source": "BR 45(1)(2) para 1521g",
    "points": [
     "This method may be carried out underway when running on a transit with a third fixing mark available roughly abeam (see Fig 15-14 below). A table of true ranges of the radar mark against the HSAs may be compiled in advance. Radar ranges are read off as the HSA is measured. The differences between true and radar ranges are then averaged to obtain the mean; the Index Error may then be obtained."
    ]
   },
   {
    "title": "1521h. Establishing Radar Index Error by the Two-Ship Method",
    "source": "BR 45(1)(2) para 1521h",
    "points": [
     "The two-ship method involves the use of double echoes, which will usually be produced by two ships proceeding in line abreast at close range (see Fig 15-15 below). Range A between own ship and the consort includes Index Error, but range B between the consort and the double echo does not; thus, range B is the true range and the difference between this and the radar range A is the Index Error."
    ]
   },
   {
    "title": "1521i. Establishing Radar Index Error by the Three-Ship Method",
    "source": "BR 45(1)(2) para 1521i",
    "points": [
     "Three ships proceed in line abreast and simultaneously measure range of each from from one another (see Fig 15-16 below). Ship A provides true range BC and ship C provides true range AB; all three ships may thus obtain their respective Index Errors. This method suffers from reliance on external measurements that are not under the direct control of own ship."
    ]
   },
   {
    "title": "1521j. Establishing Radar Index Error by Comparison to Weapon Radar",
    "source": "BR 45(1)(2) para 1521j",
    "points": [
     "Weapon fire-control radars typically have precise ranging characteristics and are very accurately calibrated. Thus the weapon radar range of a common object held by both systems may be established as a reference with which a navigational radar may be compared to obtain its Index Error."
    ]
   },
   {
    "title": "1521k. Correcting for Radar Index Error",
    "source": "BR 45(1)(2) para 1521k",
    "points": [
     "Having found the radar Index Error for a particular radar, the error may be allowed for as follows:",
     "• Adjustment and Elimination. On some radars, maintenance staff may be able to adjust Index Error and either reduce or eliminate it.",
     "• Manual Allowance. Any residual Index Error should be noted on the front of the display and subsequently applied to all ranges taken by the operator."
    ]
   },
   {
    "title": "1522a. Causes of Radar Bearing Errors",
    "source": "BR 45(1)(2) para 1522a",
    "points": [
     "Bearing errors are invariably present to some extent in all radar equipments and their magnitude is hard to estimate. Therefore, radar bearings should ALWAYS be treated with CAUTION. A bearing error of 1° is equivalent to about 35 yards at 1 n.mile or about 1 cable at 6 n.mile (see Para 0127 - Radian Rule). Likely causes of radar bearing errors are as follows:",
     "• Half Beam Width Error. Horizontal Beam Width causes a distorted picture to be displayed (see Para 1512 / Fig 15-1).",
     "• Parallax (Older Radars). When curved ‘Cathode Ray Tube’ displays are viewed from different angles, parallax errors are introduced. In addition, any separation of the plotting surface from the display surface also generated parallax errors. The fitting of reflection plotters to older radars greatly reduced these errors. Modern displays use flat or nearly flat screens and normally include electronic plotting for contacts, PIs and mapping lines; thus the previously common parallax errors are now generally absent.",
     "• Centring. Incorrect centring of the radar display will cause bearing errors.",
     "• Inaccurate Bearing Observations. Using a longer range scale than necessary, and thus observing bearings too close to the centre of the display instead of near its circumference, reduces the bearing accuracy of the observations.",
     "• Equipment Limitations. Limitations of the equipment may cause bearing errors, as follows:",
     "• Ship's Head Marker. Difficulty in lining up the ship's head marker to an accuracy of less than / may cause bearing errors (older radars).",
     "• Compass. Any Gyro Compass error and/or in its transmission system will cause bearing errors.",
     "• Aerial Alignment. Difficulty in lining up the radar aerial on the masthead to an accuracy of less than 1/may cause bearing errors.",
     "• Aerial Backlash. Backlash in the aerial training motor may cause bearing errors.",
     "• Squint Error. In end-fed slotted waveguide aerials, the radar beam is offset from the aerial's line of sight between ½° and 2½° (known as ‘Squint Error’). Squint Error is at a minimum when the radar is first installed, but the oscillator frequency tends to drift with age, causing the Squint Error to vary. When the magnetron is changed, the frequency will be different and this may also produce a significant Squint Error."
    ]
   },
   {
    "title": "1522b. Bearing Alignment Accuracy Check",
    "source": "BR 45(1)(2) para 1522b",
    "points": [
     "At regular intervals, when using radar for navigation, the alignment of the radar picture and display should be checked, as follows:",
     "• Centring. Check that the radar display is centred and adjust as necessary.",
     "• Ship's Head Marker. Check that the ship's head marker is aligned with Gyro Compass heading. Adjust as necessary (normally a maintenance item).",
     "• Method 1. If possible, compare the radar and visual bearings of a well defined radar conspicuous object with good bearing discrimination characteristics (eg a small ship or isolated lighthouse etc) at medium range.",
     "• Method 2. If a suitable visual object is not available, compare the line of bearing (transit) between two suitable charted radar conspicuous objects on the radar display and on the chart (see Fig 15-17 below). Objects should be chosen to minimise Half Beam Width Error (see Para 1512 / Fig 15-1)."
    ]
   }
  ]
 },
 {
  "id": "log",
  "title": "Speed log (EM log)",
  "cards": [
   {
    "title": "Para 8. EM Logs",
    "source": "Handbook on Navigation (2019), chapter 8, para 8",
    "points": [
     "EM log is the most common log being used in Indian Navy. The accuracy of EM log depends on the type of sensor being used and its position on the hull. The signal output from the sensor is directly related to water flow and is rarely linear over the whole speed range of the vessel. EM log works on the principle of Faraday's law of electromagnetic interference."
    ]
   },
   {
    "title": "Para 9. Occasions for Log Calibration",
    "source": "Handbook on Navigation (2019), chapter 8, para 9",
    "points": [
     "The log should be calibrated on the first installation and thereafter on following occasions -",
     "(a) Annually.",
     "(b) On completion of refits.",
     "(c) On any addition/ alteration to the underwater outfit of the ship.",
     "(d) When in doubt in respect of log performance."
    ]
   },
   {
    "title": "Para 10. Considerations during Calibration",
    "source": "Handbook on Navigation (2019), chapter 8, para 10",
    "points": [
     "The following considerations are germane while undertaking log calibration:-",
     "(a) Calm sea conditions with no/ minimal swell and Nil or known tidal conditions.",
     "(b) Winds below 10 kn.",
     "(c) The ship should be in normal loading conditions, with all equipment fitted as in actual, e.g. Sonar dome lowered, etc. However, in the case of ships fitted with towed arrays, the same should be housed.",
     "(d) The rudder should be used sparingly during the calibration.",
     "(e) The propeller RPM and pitch (if relevant) should be maintained constant during the runs.",
     "(f) The log is required to be calibrated across the entire spectrum of speed regimes to obviate the possibility of any undetected errors. This is generally done for speeds in multiples of 6 kn viz. 6, 12, 18, 24 etc through the full range of speed.",
     "(g) The log speed should be noted every 15 sec for speeds below 20 kn and every 10 sec for speeds above 20 kn.",
     "(h) Irrespective of the method in use, the ship should settle on the desired course for about 05 min to permit all parameters to settle, prior commencing the actual measured mile."
    ]
   },
   {
    "title": "Para 11. Methods of Calibration",
    "source": "Handbook on Navigation (2019), chapter 8, para 11",
    "points": [
     "Calibration involves concurrently ascertaining the mean speed of the ship as displayed by the log and the mean speed over ground. Various methods for calibration are available as follows:-",
     "(a) The Measured Mile Run. This method entails running on a measured mile, normally marked with transits. The course selected should be along the direction of prevailing set, if any, and should be free of traffic/ navigational hazards. ‘Speed through Water’ (Log speed) needs to be noted. In case of error in ship's log, accurate assessment of set is to be made (estimated from ECDIS), prior building up to full power, by conduct of one-mile run measured by DGPS/ GPS, on reciprocal courses along the prevailing set in the area. In the event that DGPS/ GPS is used for determining speed attained in FPT, it is to be the correct ‘Speed through Water’, that is to be recorded by adjusting the ‘Speed over Ground’ noted on DGPS/ GPS for the prevailing set.",
     "(b) The DGPS/ GPS Method. In this method, a reference position may be fed into the DGPS and the ship thereafter proceeds with two/ four runs as in sub Para 6 (a) above.",
     "(c) Danbuoy Method. The use of a danbuoy accrues the benefit of permitting the calibration to be done in deep waters, precluding shallow water effects, etc.",
     "(d) In this procedure, the ship lays two danbouys about 3 Nm apart along a radial perpendicular to the direction of the prevailing wind. Thereafter, the ship commences from one of the danbouys and sets course for the other. Once settled on course, it should not be changed, irrespective of relative change in the position of the buoy. The range of the buoy is measured on the Nav Fire Control radar and the ship undertakes a measured mile run to the target buoy, e.g. if the range of the dan is 2.5 Nm at the time of commencement the VRM is put to 1.5 Nm and the speeds measured till such time that the dan reaches the 1.5 Nm circle.",
     "Reference: Art 1220, p 12-14, BR 45 (I) (2) ed 2008."
    ]
   },
   {
    "title": "Para 12",
    "source": "Handbook on Navigation (2019), chapter 8, para 12",
    "points": [
     "Normally, two runs at each speed suffice, but in case a tidal stream or winds prevail, then it is advisable to undertake two runs each on both headings. The difference between the mean log speed and the mean speed over ground is the log error and should be calculated both in knots and as a percentage of the log speed. For detailed procedures for the above method, the navigator should refer to BR 45 (3)/ 2011."
    ]
   },
   {
    "title": "Para 13. Calculation from Speed Log Calibration",
    "source": "Handbook on Navigation (2019), chapter 8, para 13",
    "points": [
     "The vessel's mean as shown by the speed log is compared with the Ground Speed actually achieved and from this the Percentage Speed Log Correction may be calculated. The Percentage Speed Log Correction must always be calculated as a percentage of (Speed Log) Water Speed and Not of Ground Speed.",
     "(a) Observation and Recording of Log Speed – Method. For Speed Logs providing a direct measure of speed, the reading of the speed indicator should be noted every 15 seconds (every 10 seconds for speeds of 20 kn and over). The readings of the distance recorder should also be noted so that any discrepancy may be identified and corrected.",
     "(b) Calculating of Percentage Speed Log Correction. The mean Ground Speed and Speed Log mean Water Speed at each calibration speed should be calculated for each run, both in knots and as a Percentage Speed Log Correction, where: C = Percentage Speed Log Correction V1, V2, V3, V4 = Ground Speeds Measured on runs 1, 2, 3 and 4 respectively. L1, L2, L3, L4 = Mean Water Speed measured on runs 1, 2, 3 and 4 respectively.",
     "(i) Two Run Formula. If it is only necessary to carry out two runs at each calibration speed (when the Tidal Strem may be assumed to be zero or constant), the Percentage Speed Log Correction is given by formula C = 100 [ (V1 + V2) / (L1 + L2) - 1 ] (formula 4.9, BR 45(3) para 0427b).",
     "(ii) Four Run Formula. When the Tidal steram is changing, an accurate Percentage Speed log Correction can only be obtained if 4 runs (i.e 2 in each direction) are carried out. In this case the Percentage Speed Log Correction is given by formula: C = 100 [ (V1 + 3V2 + 3V3 + V4) / (L1 + 3L2 + 3L3 + L4) - 1 ] (formula 4.10, BR 45(3) para 0427b).",
     "(c) Keltron V3. The problem being faced with Keltron V3 is that the correction is only available for fixed error. Therefore the log is to be corrected closer to economic speed and residual % error for 2-3 speed groups should be done again and noted for reference."
    ]
   },
   {
    "title": "0427. Calculations from Speed Log Calibration",
    "source": "BR 45(3) para 0427",
    "points": [
     "The vessel's mean Water Speed, as shown by the Speed Log, is compared with the Ground Speed actually achieved and from this the Percentage Speed Log Correction may be calculated. The Percentage Speed Log Correction must always be calculated as a percentage of (Speed Log) Water Speed and NOT of Ground Speed.",
     "a. Observation and Recording of Log Speed – Method. For Speed Logs providing a direct measure of speed, the reading of the speed indicator should be noted every 15 seconds (every 10 seconds for speeds of 20kn and over). The readings of the distance recorder should also be noted so that any discrepancy may be identified and corrected.",
     "b. Calculation of Percentage Speed Log Correction. The mean Ground Speed and Speed Log mean Water Speed at each calibration speed should be calculated for each run, both in knots and as a Percentage Speed Log Correction, where: C = Percentage Speed Log Correction; V1, V2, V3, V4 = Ground Speeds measured on runs 1, 2, 3 and 4 respectively; L1, L2, L3, L4 = Mean Water Speed measured on runs 1, 2, 3 and 4 respectively.",
     "Note 4-2. Ground Speeds are measured in International Nautical Miles (nm) [1852 metres] per hour, and allowance must be made for this if the ‘Measured Distance’ as shown on the chart is of a different length.",
     "• Two-Run Formula. If it is only necessary to carry out two runs at each calibration speed (when the Tidal Stream may be assumed to be zero or constant), the Percentage Speed Log Correction is given by formula (4.9): C = 100 [ (V1 + V2) / (L1 + L2) - 1 ]",
     "• Four-Run Formula. When the Tidal Stream is changing, an accurate Percentage Speed Log Correction can only be obtained if 4 runs (ie 2 in each direction) are carried out. In this case the Percentage Speed Log Correction is given by formula (4.10): C = 100 [ (V1 + 3V2 + 3V3 + V4) / (L1 + 3L2 + 3L3 + L4) - 1 ]",
     "• Mean of Mean Speeds. A Tidal Stream may be eliminated by four calibration runs spaced at equal intervals of time. The mean of the mean Ground Speeds recorded is calculated from formula (4.13): Mean of Mean Ground Speeds = (V1 + 3V2 + 3V3 + V4) / 8. It can be shown that formula (4.13) leads to formula (4.10)."
    ]
   },
   {
    "title": "Example 4-5. Speed Log Calibration - Constant Tidal Stream (Two-Run Method)",
    "source": "BR 45(3) para 0427d",
    "points": [
     "A ship calibrates its Speed Log over a ‘Measured Distance’ of 1.0nm (1852m). Two calibration runs are made, with and against the Tidal Stream, which is considered to be constant for the duration of the two runs. The results are: Run 1: Time 3 mins 38 secs (ie 218 secs), Mean (Speed Log) Water Speed 14.9kn. Run 2: Time 4 mins 00 secs (ie 240 secs), Mean (Speed Log) Water Speed 15.1kn.",
     "Question: What is the Percentage Speed Log Correction? V1 = 3600 / 218 = 16.5kn; V2 = 3600 / 240 = 15.0kn. From formula (4.9): C = 100 [ (16.5 + 15.0) / (14.9 + 15.1) - 1 ] = 100 x 0.05 = + 5.0%.",
     "Answer: The Percentage Speed Log Correction is +5.0% and the Speed Log should be increased by 5 per cent to read ‘True’ (ie correctly calibrated) Water Speed."
    ]
   },
   {
    "title": "Example 4-6. Speed Log Calibration - Variable Tidal Stream (Four-Run Method)",
    "source": "BR 45(3) para 0427d",
    "points": [
     "A ship calibrates its Speed Log over a ‘Measured Distance’ of 1.0nm (1852m). Four calibration runs are made, with and against the Tidal Stream, which is considered to be variable. The results, assuming that the formula (4.8) calculations have been made, are: Run 1: Ground Speed 21.59kn, Mean (Speed Log) Water Speed 20.3kn. Run 2: Ground Speed 17.76kn, Mean (Speed Log) Water Speed 20.8kn. Run 3: Ground Speed 21.27kn, Mean (Speed Log) Water Speed 20.6kn. Run 4: Ground Speed 18.37kn, Mean (Speed Log) Water Speed 20.7kn.",
     "Question: What is the Percentage Speed Log Correction? C = 100 [ (21.59 + 3(17.76) + 3(21.27) + 18.37) / (20.3 + 3(20.8) + 3(20.6) + 20.7) - 1 ] (formula 4.10) = 100 [ 157.05 / 165.2 - 1 ] = 100 x (-0.05) = -5%.",
     "Answer: The Percentage Speed Log Correction is -5.0% and the Speed Log should be reduced by 5 per cent to read ‘True’ (ie correctly calibrated) Water Speed."
    ]
   }
  ]
 },
 {
  "id": "lubber",
  "title": "Lubber's line alignment",
  "cards": [
   {
    "title": "Para 14. Importance of Correct Alignment",
    "source": "Handbook on Navigation (2019), chapter 8, para 14",
    "points": [
     "Compass repeaters on the bridge, bridge wings and elsewhere in the ship are aligned to the main gyro ship's head. It the lubber's line on the relative bearing ring of the repeater is not on the fore and aft line of the ship, then gyro bearings taken from the repeater will be inaccurate. It is important therefore to check the orientation of the lubber's line as it can easily be displaced by maintenance work or gunfire."
    ]
   },
   {
    "title": "Para 15. Method of Alignment Check",
    "source": "Handbook on Navigation (2019), chapter 8, para 15",
    "points": [
     "(a) A centre line repeater from which the Jackstaff (or some other fixed centre line object) can be seen may be checked by direct comparison of the lubber's line bearing with that of the Jackstaff.",
     "(b) For a repeater displaced from the centre line, as in the diagram, one method of checking is by knowing the toe-in-angle, E, from the fore and aft line and the bearing of the Jackstaff. This can be calculated by finding the displacement of the repeater from the centre line, d, and its fore-and-aft distance from the Jackstaff. The wing repeater is to be aligned so that the bearing of the Jackstaff reads as the ship's head + E.",
     "(c) An alternative method for checking a repeater displaced from the centre line is by taking the relative bearing of a distant object simultaneously, from both the displaced repeater and a correctly aligned centre line repeater. With a displacement of 6 metres, the angular difference is less than half a degree at ranges over half a mile, and insignificant at ranges of more than 1 mile. However, the toe-in angle method is more accurate.",
     "(d) It is recommended that the repeater supplies be switched off, prior checking the toe-in angle, to obviate any errors that may creep in due to ships movement alongside."
    ]
   },
   {
    "title": "Para 16. Occasions for Checking Repeater Alignment",
    "source": "Handbook on Navigation (2019), chapter 8, para 16",
    "points": [
     "Repeaters lubber's line alignment should be checked at regular intervals and especially on the following occasions: -",
     "(a) After work on the repeater or in its immediate vicinity.",
     "(b) Before sailing or berthing.",
     "(c) Before replenishment.",
     "(d) In the event of heavy shock such as that caused by gunfire, collision, etc."
    ]
   }
  ]
 },
 {
  "id": "swing",
  "title": "Swinging ship",
  "cards": [
   {
    "title": "Para 17",
    "source": "Handbook on Navigation (2019), chapter 8, para 17",
    "points": [
     "This part is intended as an aide memoire to specialist Navigating Officers on swinging ship. The reference books (Navigation VoIs. (BR 45(1), 45(3), 45(4)) and BR 100) should be read beforehand to refresh the memory on points of detail."
    ]
   },
   {
    "title": "Para 18. Swinging Ship",
    "source": "Handbook on Navigation (2019), chapter 8, para 18",
    "points": [
     "This expression is used to describe the whole operation of adjusting the magnetic compass. This includes ascertaining the deviation, the adjustment (during which correctors are placed to reduce the same), and observation of the residual deviation."
    ]
   },
   {
    "title": "Para 19. Occasions on which a Ship should be swung",
    "source": "Handbook on Navigation (2019), chapter 8, para 19",
    "points": [
     "A ship should be swung on the following occasions: -",
     "(a) Before sea trials of a new ship.",
     "(b) After extensive structural alterations near the compass.",
     "(c) After considerable change of magnetic latitude.",
     "(d) After refitting, or lying in one direction for a long period.",
     "(e) If any other corrector magnets have been altered.",
     "(f) After modification or repair of D.G. equipment.",
     "(g) After wiping or flashing treatment.",
     "(h) At least once a year."
    ]
   },
   {
    "title": "Para 20. Methods of Swinging Ship",
    "source": "Handbook on Navigation (2019), chapter 8, para 20",
    "points": [
     "Methods of swinging ship depend on the methods of comparing compass bearings with magnetic bearings so that the values of deviation can be obtained. Since deviation changes with heading, the ship is turned to appropriate headings (normally the cardinal points) and necessary adjustments are carried out to reduce the deviations. Thereafter, the ship is swung through 360° to obtain the deviations remaining after correction. There are five methods of swinging ship as follows:-.",
     "(a) By Bearing of a Heavenly Body.",
     "(i) The elevation of the body should be less than 30°.",
     "(ii) The rate of change of bearing should be small.",
     "(iii) The sun is a suitable body during morning and evening hours.",
     "(iv) True bearings can be obtained from Sight Reduction table or from Weir's Azimuth Diagram for the period of swing and tabulated beforehand at intervals of about 4 minutes and converted to magnetic bearings.",
     "(v) Using this method, the ship is not restricted in her movement.",
     "(b) By Bearing of a Distant Object.",
     "(i) This method requires the ship's position to be known.",
     "(ii) The magnetic bearing of distant object is then obtained using chart from the ship's position.",
     "(iii) The accuracy of this method will depend on the accuracy of bearing obtained from chart.",
     "(iv) This method may be used when at a buoy, at single anchor or underway.",
     "(c) By Transits.",
     "(i) The ship is made to turn on a known bearing of two or more conspicuous objects in line.",
     "(ii) This method involves turning the ship through various headings maintaining the ship on transit, which becomes very difficult particularly if there is wind, sea or stream.",
     "(d) By Reciprocal Bearing.",
     "(i) This involves taking bearing of a shore compass or bearing plate set up ashore.",
     "(ii) The bearings obtained by the shore are signaled by radio. The reciprocal of this bearing is to be used for comparison with compass bearing of ship.",
     "(e) By Gyro Compass.",
     "(i) The ship's head by Gyro and Magnetic Compass can be compared on different headings.",
     "(ii) The Gyro error, if any, must be accurately known and allowed for.",
     "(iii) This method is convenient for use while placing corrector magnets but should only be used for obtaining deviation if no other method is practicable, as the accuracy of deviation is dependent upon the accuracy of the Gyro Compass."
    ]
   },
   {
    "title": "Para 21. Obtaining Deviation of Between-Deck Compasses",
    "source": "Handbook on Navigation (2019), chapter 8, para 21",
    "points": [
     "The deviation of between decks compasses are obtained by comparison of ship's head with the standard compass."
    ]
   },
   {
    "title": "Para 22. Methods of Obtaining Variation",
    "source": "Handbook on Navigation (2019), chapter 8, para 22",
    "points": [
     "The variation can be obtained from the chart for the swinging ground. The variation can also be calculated from the mean compass error."
    ]
   },
   {
    "title": "Para 23. Planning",
    "source": "Handbook on Navigation (2019), chapter 8, para 23",
    "points": [
     "(a) Decide the method to be used for swinging ship.",
     "(b) Select suitable swinging ground.",
     "Reference: Art 0121 & 0811 BR 45 Vol (1) (Part I) and Art 1312 (m) & 1323 (h) BR 45 Vol (1) (part II) both ed 2008 and Good practice mandates establishing gyro error prior cast off, in pilotage waters and daily. Art 1312 (m) p13-12, BR 45(1)(2) ed 2008."
    ]
   },
   {
    "title": "Para 24. Time for Swinging Ship",
    "source": "Handbook on Navigation (2019), chapter 8, para 24",
    "points": [
     "As a general rule the following minimum time should be allowed for swinging ship:-",
     "(a) Harbour adjustment - 1 hour",
     "(b) Swinging without DG - 1.5 hours",
     "(c) Swinging with DG on",
     "(i) Compass with DG corrector coils - 3 hours",
     "(ii) Compass without DG corrector coils - 1.5 hours"
    ]
   },
   {
    "title": "Para 25. Preparations",
    "source": "Handbook on Navigation (2019), chapter 8, para 25",
    "points": [
     "Inspect the compass, about a week prior to the swing. The points to be checked are as follows:-",
     "(a) Before undertaking the first swing of a new ship. Refer pages 363 & 364, Chapter XXVI of BR 45 (3) / 2011. Note: lt is highly desirable that an inspection on these lines is carried out by the swinging officer before all occasions of swinging. This is particularly necessary after long refits.",
     "(b) Before Subsequent Swinging of the Ship.",
     "(i) Record of last swing should be checked to:-",
     "(aa) Note any remarks.",
     "(ab) Adjust positions of spheres (coefficients D & E).",
     "(ac) Line up steering compass lubbers line (coefficient A).",
     "(ii) Lubbers line of standard compass.",
     "(iii) Binnacle keys.",
     "(iv) Testing Compass Card for Friction. To test the card for friction, the card should be deflected about 20° by a magnet and then released. If it comes to rest in its original position the card is reasonably free from friction. The test should be carried out when there is no chance of the ship's head moving, i.e. the ship should be secured fore and aft.",
     "(v) Presence of Bubble in the Compass Bowl. A bubble generally indicates a leak and therefore a defective compass. This should be returned and replaced by a new one. The presence of bubble makes the compass less accurate and harder to read. If the bowl cannot be replaced then the leakage should be stopped and the bubble removed. The bowls are fitted with a mixture of alcohol and distilled water. The alcohol is added to reduce the freezing point of the mixture. To remove the bubble, the bowl will have to be first unshipped. Then remove the plug from the filling hole, keeping it uppermost, and fill the bowl with the mixture till it overflows. Flock the bowl from side to side to assist any air to escape and replace the plug after ensuring all air has been removed.",
     "(vi) Spare magnets, spanners, screw drivers and Azimuth ring etc. should be available.",
     "(vii) Communication. Communication with various compass positions, Bridge and DG operating panel should be available and tested.",
     "(viii) DG Equipment. The DG equipment should be serviceable and available for operation. Necessary current settings for the area should be known."
    ]
   },
   {
    "title": "Para 26. Conditions for swinging ship",
    "source": "Handbook on Navigation (2019), chapter 8, para 26",
    "points": [
     "The following conditions should be ensured before swinging ship: -",
     "(a) The funnels should be at their normal sea-going temperature.",
     "(b) The ship should be upright to avoid heeling error.",
     "(c) All moveable iron should be in its sea-going position, e.g. guns, boats, cranes etc. in stowed position.",
     "(d) The ship should be clear of other vessels by at least 3 cables during the swing.",
     "(e) If swinging with DG ON, then it should be switched on for at least four hours before the swing, to allow DG to reach its operating temperature."
    ]
   },
   {
    "title": "Para 27. Harbour Adjustments",
    "source": "Handbook on Navigation (2019), chapter 8, para 27",
    "points": [
     "(a) Soft Iron Correctors.",
     "(i) Check and adjust the amount of FLINDERS BAR if required (Flinders bar corrects for c rod coefficient - B). This is normally not required to be adjusted for subsequent swings, unless there is a large change in magnetic latitude.",
     "(ii) Check and adjust the position of SPHERES (spheres correct a & e rods. Coefficient - D & E). The record of previous swing should be consulted to ascertain this.",
     "(b) Permanent Magnet Correctors.",
     "(i) Heeling Error Correction. Heeling error is corrected by vertical permanent magnets. The required number and position of these magnets is determined by using the heeling error instrument.",
     "(ii) If there is no ‘g’ rod effect at the compass, as is usually the case at a well designed compass position, the ship's heading for this correction is immaterial. In case a ‘g’ rod is present, however, it is preferable to place the ship's head within 10° of East or West (Magnetic) before correcting the heeling error. Note: For swinging ship with DG ON, the heeling error correction must be carried out with DG operating."
    ]
   },
   {
    "title": "Para 28. At Sea Adjustments",
    "source": "Handbook on Navigation (2019), chapter 8, para 28",
    "points": [
     "(a) Adjustment.",
     "(i) Correct Heeling error if not already done.",
     "(ii) Place ship's head East or West by compass and insert/ adjust fore and aft magnet, to correct coefficient B until there is no deviation.",
     "(iii) Place ship's head North or South by compass and insert athwart -ship magnets, adjust the magnets until there is no deviation.",
     "(iv) If there was large uncorrected deviation at (iii) repeat (ii).",
     "(v) Place the ship's head on the opposite heading to (ii) and halve the remaining deviation by re-adjusting the fore and aft magnets.",
     "(vi) Place the ship's head on the opposite heading to (iii) and halve the remaining deviation by re-adjusting the athwart-ship magnets.",
     "(vii) Place the ship's head on the inter-cardinal point between those used in (v) and (vi) and check the setting of spheres.",
     "(b) The Swing. Turn the ship slowly round and obtain deviation on at least eight, but preferably sixteen points. Note: If possible the ship should be steadied on each heading, rather than maintaining a continuous swing and at least 40 min. should be taken for the complete swing."
    ]
   }
  ]
 },
 {
  "id": "echo",
  "title": "Echo sounder",
  "cards": [
   {
    "title": "Para 29. Occasions for Calibration",
    "source": "Handbook on Navigation (2019), chapter 8, para 29",
    "points": [
     "The echo sounder is one of the most important navigational aids available towards ensuring safe navigation. Hence, its reliability has to be beyond doubt and complete at all times. Towards this end, calibration of the echo sounder is required to be undertaken on the following occasions-",
     "(a) Every time the ship enters dry docks.",
     "(b) Annually.",
     "(c) Post each refit.",
     "(d) Post any major modification / repair on the equipment.",
     "(e) When in doubt of the accuracy.",
     "(f) Preferably, every time prior cast off, with the aid of a hand lead line."
    ]
   },
   {
    "title": "Para 30",
    "source": "Handbook on Navigation (2019), chapter 8, para 30",
    "points": [
     "The echo sounder may be calibrated using any or all of the following methods-",
     "(a) While dry docking, prior shutting down of power supply for change over and before the ship rests on the chocks. The calibration is done by comparing the depth of the dock as marked and that indicated by the echo sounder. lt is important to note that the sounding should be checked when the transducer is in line with the dock markings. However if this happens to be in vicinity of the dock gate, the possibility of sludge accumulated cannot be ruled out, which may lead to false echoes.",
     "(b) With hand lead line, preferably on each occasion prior leaving harbour. This practice is important not only for calibration of the echo sounder, but also as a cross check on the exact depth available at the berth. Maintenance of hand lead lines is also a duty that falls on the navigator as per the Regs l.N, Part l, Art 1316.",
     "(c) The ‘Bar Check Method’ is commonly used in a large part of the world. This entails positioning a metal bar below the echo sounder transducer and lowering it by measured distance from the transducer while simultaneously comparing the readings provided by the echo sounder with respect to the bar. This method, however, is currently not in vogue in the Indian Navy."
    ]
   },
   {
    "title": "Para 31",
    "source": "Handbook on Navigation (2019), chapter 8, para 31",
    "points": [
     "When Special Sea Dutymen (SSD) or their equivalents are closed up, or at any other times when ordered, an additional person should close up to monitor and report depths / soundings. The operator should suffix the depth / sounding with ‘Steady’, ‘Deepening’, ‘Shoaling’ or ‘Below Minimum Depth / Sounding’. Standard reports should be at intervals of not greater than 1 minute, or as follows:-",
     "(a) Report every 01 meter change when operating in area under 0-20 m.",
     "(b) Report every 05 meters change when operating in area under 20-40 m.",
     "(c) Report every 10 meters change when operating in area above 40 m.",
     "Reference: Art 0924(a)-(b) p9-12, BR 45(1)(1) ed 2008."
    ]
   }
  ]
 }
];
