# Cursed Pilot

*Long ND made Short.* A records app for ship handlers: keep each vessel's particulars, turning data and calibration records in one place, and run a few quick navigation calculations. Built as a React web app and wrapped for Android with Capacitor. It works fully offline.

## Features

**Fleet and ship screens**

- **Fleet Registry** – 129 Indian Navy ships in service (carriers, destroyers, frigates, corvettes, submarines, patrol vessels, fast attack craft, amphibious ships, fleet tankers, survey and research vessels, training ships), listed by class with pennant, builder, commissioning date, dimensions, propulsion, armament and more. Compiled in October 2026 from open sources (mainly Wikipedia); it is not official data, and everything is editable. Search by name, pennant, class or builder; filter by category; sort by category, name, most used, recently used or newest; pin up to five ships to the top. You can add your own vessels too.
- **Countries** – the Fleet has a chip for each country: India (the default) and the Pakistan, French, Chinese, US, Bangladesh, Sri Lankan, Turkish and South Korean navies (about 900 ships there: principal combatants, submarines and the larger amphibious and support ships). Choose one or more; only those countries' ships are listed, so choosing the USA alone shows no Indian ships. The last chosen country stays on. A search looks through every country by name, pennant, class, builder or country. Ships you add yourself are always listed. Every ship carries its class data inside the app, so displacement, dimensions, speed, complement, propulsion, armament, sensors and aircraft are there without a connection (the ship screen opens with the full details shown, and a short summary from them where the Wikipedia text has not been fetched). Only the Wikipedia picture and longer description need the internet, and are then kept. Ships saved on the device by an earlier version gain any details that were empty, and anything you have typed is kept. The foreign lists are compiled from Wikipedia class and ship tables and are partial and unofficial: the major classes are complete, but small craft and auxiliaries have only what is published, and some figures are blank. Where a source such as Janes gives a figure differently from the one shown, the class entry can carry it and the details show a small *Wiki* / *Janes* flag beside each; no Janes figures are included yet.
- **My Ship dashboard** – the home screen shows your current ship (picture, key facts and the latest calibration records). Star a ship in the Fleet to make it My Ship. The bottom bar has Fleet and a tool slot on the left, My Ship (centre, highlighted) and two tool slots on the right; each slot holds a NavYeo tool: tap an empty slot to choose one, tap a filled slot to open the tool as a page of its own (like Fleet or My Ship, not in the NavYeo window), press and hold to change or remove it. What you enter there is the same as in NavYeo. Add Ship and Backup are in the menu under the anchor on the home screen.
- **Ship screen** – a picture and short description from Wikipedia (fetched when online, then kept for offline use; or use your own photo), key facts, and an *Edit details* form for every field. **Particulars** have a visible *Edit* button, and you can add your own particulars (heading, value, unit) and your own detail headings with text; they are shown, backed up and exported with the ship.
- **Calibration Data** – turning trials, acceleration/deceleration, fishtails, EM log calibration and compass swing in one place. Each card shows its latest record, not just a count; add, edit and delete from the card. Records can be edited (pencil) or deleted; records saved before editing existed open for re-entry.
- **Turning data** – one sheet per speed, wheel angle and side. **Import** from Excel (.xlsx, .xls), CSV, Word (.docx) or JSON, and **export** to Excel, CSV, Word or JSON. An export imports back unchanged (checked in all four formats); files without speed, wheel and side columns ask which table the rows belong to; existing rows for the same table and turn amount are replaced, everything else is kept. Print from the entry screen.
- **Fishtail Calculator** – open it from the **Calculator** button on the Fishtails card. Plot, radar and animation views and a Battenberg solver, working on the selected vessel's own turning data. *Save* adds the outcome to the vessel's Fishtails records; plots export as JPG or SVG.
- **Per-vessel export** – an Excel workbook (details, particulars, turning data and records), a printable report (open in a browser, print or save as PDF), or a single-vessel file. Restoring a single-vessel file adds or updates that vessel and keeps the rest of the fleet.
- **Backup and restore** – the Backup tab saves the whole fleet with your edits, pins, My Ship and usage to a JSON file (a download on the web, the share sheet on Android). Restoring replaces the fleet and tops up any catalogue ships it lacks.

**NavYeo**

- A floating navigator's assistant, typed or spoken. Drag the icon anywhere; it remembers its place. Tap it and a window opens in the centre of the screen, growing out of the icon and fitted to the screen, so every feature is reachable wherever the icon is. Tap outside, press the collapse button, Esc or Android's back and it shrinks back into the icon. It works on every screen.
- Offline tools: **Bearings & Positions** (one tool with tabs: bearings, compass and gyro, units, latitude and longitude written as decimal degrees, degrees and minutes or degrees, minutes and seconds, and distance and bearing between two positions by great circle and by rhumb line, or the position reached from a start, course and distance), **Radian Rule** (with a Time-Speed-Distance tab), CPA/TCPA (range in nm by default; true or relative head-up bearing; shows the bearing and range it worked from), ATB (angle on the bow), **Course to Steer** for set and drift (with a Regain Track tab), **VSA** (distance off by vertical sextant angle, table interpolation, horizon and radar range, sighting range, as tabs), HSA (horizontal sextant angles: position fix from two angles between three objects, distance off from one angle, and the length of an object from the bearings of its two ends), **Wheel-over Point** (typed or from the vessel's turning data) with a **Bearing Calculator** tab: an object's bearing and range along its track every 5 cables or 1 nm, from its bearing, course and initial or final range, and its closest approach. The **(i)** on each tool explains the concept, the method and the formulas.
- Also: man overboard turns (Williamson and Scharnow, worked from the vessel's turning data), and **Sun Run Sun** and **Sun Run Merpass**, which give an observed position from two Sun sights, or a Sun sight and the meridian altitude, with the run between them. The Sun's position is worked out on the device (to about a minute of arc, not the Nautical Almanac), so nothing needs looking up. A **Four Star Fix** tool plans the stopwatch start and four well-spread stars (57 navigational stars from the Hipparcos catalogue, worked to the date, and Venus, Mars, Jupiter, Saturn and the Moon, worked out on the device) and fixes the position from the four sights. Each of these can save the filled **Sight Form (NP 98)** (all 37 lines, one form per sight, plus the plotting data) as a printable page, with the position by the form method shown beside the direct calculation as a cross-check. Based on the SRS and SRM workbook, with the Sun, altitude corrections and fix checked against an exact solution of the altitude circles.
- Also: **Polaris Latitude** (the almanac's Lat = Ho − 1° + a0 + a1 + a2, worked from Polaris's own position, reproducing the class example), and **Rise, Set and Twilight** (sunrise, sunset, meridian passage and the three twilights, the Sun's true bearing at rising and setting, and gyro or compass error from an observed bearing). The Sun, star, planet and Moon forms take a deck watch error (D.W.T. worked back from the G.M.T.), and the four star fix offers a rapid mode with one chosen position for all four bodies.
- Also: **Rules & Buoyage** (the International Regulations for Preventing Collisions at Sea, rules 1 to 41, with the light pictures and short notes, and a random Rules of the Road question quiz), **Tides**, **Anchor**, **Fuel Planning** (from the ship's own fuel data), **Flying Corpen**, and the manoeuvring tools worked from the vessel's turning data where it has them:
  - **Corpen** (column and abreast): the stopwatch time and the bearing at which to alter, for a turn of **any angle** (not only 90°); advance, transfer, time to turn and distance lost are taken from the ship's turning data for that speed, side and angle, and can be typed over. The radian rule is shown for 90°.
  - **Relative Motion**.
  - **RAS Approach**, worked as on the bridge: choose the evolution (SKBDL bridge to bridge, RASAP RAS point to RAS point, UNREP fuelling point to fuelling point), the Guide and her rig (tankers carry Port Fwd, Port Aft, Stbd Fwd and Stbd Aft rigs, Jyoti also Stern; positions entered under Edit Particulars), and the approach ship. Surge = speed advantage x the ship's surge rate (yd per knot), marked between the two marks that come abreast; **x** = surge - the Guide's mark to her stern - your stem to your mark (the gap from her stern to your stem, negative when overlapping); **θ** = tan⁻¹((x + your stem to bridge) / distance between ships), so you come down in speed when her **stern** bears θ forward of your beam. With the radar's distance from the stem it also gives the radar range of her stern for the VRM. A table repeats it for other speed advantages, and the **Diagram** shows it from above (given figures in blue, worked-out in amber) and saves it as a picture.
  - **Battenberg & Stationing** (one tool, three tabs): **Battenberg** gives the course to steer to take or change station, from relative bearing and speed or from true bearing, distance, course and speed for both ships; **From the bows** works joining from ahead (BR 45(6) 0425), reads the ship's turning data for advance, transfer, turn time and loss of speed, and shows two pictures: the working with the Guide at the centre, and **your radar** (own ship at the centre, head or north up) with the EBL and VRM to set for the wheel-over, the Guide's blips coming in minute by minute and a table of her bearing and range; **Station changes** gives round the clock, reversing the column and losing distance (BR 45(6) 0427 to 0429).
- **BATTENBERG (version 1)** – one radar picture for every station-keeping problem, kept fixed at the top: the shared figures (Guide and own course and speed, stationing speed, own station and the next station) are entered once, each problem has a button (Station, In time, CPA, Rel-vel, Bows, Fishtail, RTC, RAS) with its own few figures in a sheet, and the answer is given as text and drawn on the picture with the Guide or own ship at the centre, head or north up, played in time. The separate tools stay until it is complete.
- **Calibration Methods**: short cards with the method for each calibration (lubber's line, gyro, EM log, compass swing and the others) in the books' own words with the source; the books remain the authority. Ship Checks save the five calibration record types into Calibration Data, filled from the ship's own data (including wing repeater distances).
- **Voice assistant** – hold the NavYeo icon (about half a second) and a full-screen voice conversation opens and starts listening, in the manner of a voice chat: say a request, NavYeo works it out, reads the answer aloud and listens again, hands-free, until you end it. The orb shows whether it is listening, working or speaking, the words you say appear as you speak, and **Show …** opens the tool it filled in. It uses the phone's own speech recogniser and voice (so it can work offline where the speech pack is installed), asks for any missing number, and a short tap on the icon still opens the normal window.
- **The NavYeo model** – a small language model that runs on the phone (llama.cpp, no connection needed; Android app only). NavYeo first tries its keyword rules, which answer most requests at once; only when they do not understand does the model read what was said (in your own words, with number words like "fifty five") and turn it into a request that the app's own calculators then work out, or answer a question from the app's own definitions. **The model never does the arithmetic**, and its replies are held to a fixed shape by a grammar, so a wrong guess shows as "I could not turn that into a calculation" and never as a made-up number. In the voice screen the **Online / Offline** chip shows the connection (the phone's speech recogniser changes by itself: online service when connected, its offline speech pack otherwise) and the **NavYeo** chip opens a sheet to import or remove the model. Any Qwen2.5 0.5B Instruct GGUF (about 490 MB) works now; copy it to the phone once, tap *Import*, and it is stored inside the app. A model tuned on this app can later replace it the same way. The native part is in `android/app/src/main/cpp` (a vendored llama.cpp, MIT licence) and `NavLlmPlugin.java`; build it with JDK 21 (`-PwithX86` adds the emulator ABI).
- Type a request in the box at the bottom (or tap the microphone). Keyword rules come first; loose wording is matched **by meaning** with a small sentence model that runs offline in the app (MiniLM, 23 MB, fetched by `npm run build`), so "will that ship hit us, she bears 045 at 6 miles" opens CPA and "what does set mean" is answered from the app's own definitions. Either way it **works the answer out** with the same sums as the tools and opens the tool with the numbers filled in: "cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8", "atb bearing 045 green 30", "12 nm at 15 knots", "course to steer track 090 speed 12 set 045 drift 2", "compass 045 dev 2 W var 3 E", "off track 2 cables throw-off 10", "corpen astern 5 cables speed 12 turn 60 to starboard" (advance, transfer and time from the ship's turning data), "fuel for 300 nm at 14 knots" (from the ship's fuel data), "convert 5 nm to metres", "horizon eye 16 m", "distance and bearing from 12 30 n 072 45 e to 15 10 n 073 50 e", "convert 51 28.5 n to decimal", and "tactical diameter at 15 kn 20 wheel" from the vessel's turning data. When a number is missing it asks for one thing at a time ("What is your course?") and a bare reply ("090", "twelve knots") fills it in.
- Lengths can be entered and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers its own last unit. What you last entered stays until you press the clear-all icon (units are kept).

**General**

- **Tool names and tabs** – rename any tool (the pencil beside its title, or hold its tile and choose *Rename*; leave it empty for the original name). Tabs can be put in any order: press and hold one, then slide it.
- **Drop-downs** – every list opens as a sheet; longer ones have a search box (type a few letters, Enter picks the first).
- **Android back** – steps back one layer at a time (voice screen, NavYeo, sheet, page); at home a second back within two seconds leaves the app.
- **Themes** – Day, Dark and Night red (dark theme plus a red filter so only red light reaches the eye). Cycle with the button at the top of the home screen.
- **Offline** – everything works without a network except the Wikipedia picture and description, and the optional AI particulars (needs a Gemini key). Data is stored on the device (`localStorage`) and is not synced anywhere.

## Quick start on Windows

Double-click `start-windows.bat` for a menu, or pass an option:

```bat
start-windows.bat dev     :: dev server on http://localhost:3100, opens the browser
start-windows.bat test    :: type check, all self-checks and a production build
start-windows.bat apk     :: Android debug APK (uses a JDK 21)
```

It installs dependencies on the first run. Needs Node.js 22.18 or newer.

## Run on the web

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

The dev server listens on port 3000.

To enable the AI particulars button, create `.env.local`:

```
GEMINI_API_KEY=your-key
```

The key is injected at build time, so it ends up in the built bundle. Don't ship a build with a key you wouldn't want exposed.

## Build the Android app

Requires JDK 21 and the Android SDK (Android Studio installs both).

```bash
npm run android        # build the web app and sync it into android/
npm run android:open   # open the project in Android Studio
```

To build a debug APK from the command line, point `JAVA_HOME` at JDK 21 first (Gradle 8 does not run on JDK 25):

```bash
cd android
./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. The app ID is `com.cursedpilot.app`.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4 (bundled locally), lucide-react, Capacitor 8, `@google/genai`, `xlsx` (spreadsheets), `jszip` (Word files).

## Layout

| Path | Purpose |
| --- | --- |
| `App.tsx` | All views and state |
| `types.ts` | Ship, particulars and record types |
| `data/` | The fleet catalogue (`indianNavy.ts`), the other navies (`foreignNavies.ts`, `navies/*.ts` one file per navy for the ships and `navies/specs/*.ts` for each class's specification), registry logic (`fleet.ts`), calibration summaries and custom fields; each with a `.check.ts` |
| `navyeo/` | The floating assistant: `NavYeo.tsx`, window placement maths and the tool explanations' card |
| `tools/` | NavYeo tools: `navMath.ts` (pure maths), `NavTools.tsx` and `SunTools.tsx` (UI), `kit.tsx` (shared form pieces), `sunEphemeris.ts` and `sunSights.ts` (the Sun and the two fixes), `toolInfo.ts` (how each works), `toolMemory.ts` (remembered entries) |
| `components/` | Fleet Registry, bottom bar, My Ship card, ship info panel and form, calibration group, import control |
| `services/` | Gemini call, backup/restore, per-vessel export (`vesselReport.ts` the pure export builders, `docx.ts` a small Word reader/writer, `turningExport.ts`, `shipLookup.ts` the Wikipedia lookup). `npm run check` runs all the self-checks (maths, conversions, round trips through every file format, registry logic, layout) |
| `fishtail/` | Fishtail calculator screen, plot/solver components, and import/conversion of turning data (`tableConvert.ts`, checked with `npm run check:tables`) |
| `android/` | Capacitor Android project |

## Known limits

- Data lives in on-device storage: clearing app data or uninstalling erases it. Export a backup regularly; nothing is backed up automatically.
- Restoring a full backup replaces everything; use a single-vessel file to merge one vessel in.
- The fleet catalogue is compiled from public sources and the fleet changes constantly (commissionings, decommissionings, refits). Check anything that matters against official records, and correct it in the app. Ships launched but not yet commissioned are not listed; landing craft, tugs and other small auxiliaries are left out.
- Submarine details in the catalogue are unofficial open-source estimates.
- The other navies' lists are partial (see above), and every ship you can see is saved on the device, which costs about a megabyte of storage.
- Corpen for a turn other than 90° is worked from the geometry of the turn; the abreast (Corpen 'S') rule is the school's 90° form, so for other angles it is only an estimate.
- Word import reads tables in .docx files only (not .doc or PDF); merged cells are read as Word stores them.
- Records are for reference. Always verify against your ship's own trials and standing orders.
