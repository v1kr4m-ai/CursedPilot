# Cursed Pilot

*Long ND made Short.* A records app for ship handlers: keep each vessel's particulars, turning data and calibration records in one place, and run a few quick navigation calculations. Built as a React web app and wrapped for Android with Capacitor. It works fully offline.

## Features

**Fleet and ship screens**

- **Fleet Registry** – 129 Indian Navy ships in service (carriers, destroyers, frigates, corvettes, submarines, patrol vessels, fast attack craft, amphibious ships, fleet tankers, survey and research vessels, training ships), listed by class with pennant, builder, commissioning date, dimensions, propulsion, armament and more. Compiled in October 2026 from open sources (mainly Wikipedia); it is not official data, and everything is editable. Search by name, pennant, class or builder; filter by category; sort by category, name, most used, recently used or newest; pin up to five ships to the top. You can add your own vessels too.
- **Other navies** – ships of the Pakistan, French, Chinese, US, Bangladesh, Sri Lankan, Turkish and South Korean navies (about 900, principal combatants, submarines and the larger amphibious and support ships) are in the Fleet too, but are listed only while their country chip is switched on, or when a search finds them (by name, pennant, class or country). Ships not yet in service (for example later Arleigh Burke hulls) carry a status. These lists are compiled from Wikipedia class and ship tables and are partial and unofficial: many dimensions, builders and dates are blank, and some classes (Chinese Type 022 boats, for instance) have no names published. Where a source such as Janes gives a figure differently from the one shown, the class entry can carry it and the details show a small *Wiki* / *Janes* flag beside each; no Janes figures are included yet.
- **My Ship dashboard** – the home screen shows your current ship (picture, key facts and the latest calibration records). Star a ship in the Fleet to make it My Ship. The bottom bar has Fleet and a tool slot on the left, My Ship (centre, highlighted) and two tool slots on the right; each slot holds a NavYeo tool: tap an empty slot to choose one, tap a filled slot to open the tool as a page of its own (like Fleet or My Ship, not in the NavYeo window), press and hold to change or remove it. What you enter there is the same as in NavYeo. Add Ship and Backup are in the menu under the anchor on the home screen.
- **Ship screen** – a picture and short description from Wikipedia (fetched when online, then kept for offline use; or use your own photo), key facts, and an *Edit details* form for every field. **Particulars** have a visible *Edit* button, and you can add your own particulars (heading, value, unit) and your own detail headings with text; they are shown, backed up and exported with the ship.
- **Calibration Data** – turning trials, acceleration/deceleration, fishtails, EM log calibration and compass swing in one place. Each card shows its latest record, not just a count; add, edit and delete from the card. Records can be edited (pencil) or deleted; records saved before editing existed open for re-entry.
- **Turning data** – one sheet per speed, wheel angle and side. **Import** from Excel (.xlsx, .xls), CSV, Word (.docx) or JSON, and **export** to Excel, CSV, Word or JSON. An export imports back unchanged (checked in all four formats); files without speed, wheel and side columns ask which table the rows belong to; existing rows for the same table and turn amount are replaced, everything else is kept. Print from the entry screen.
- **Fishtail Calculator** – open it from the **Calculator** button on the Fishtails card. Plot, radar and animation views and a Battenberg solver, working on the selected vessel's own turning data. *Save* adds the outcome to the vessel's Fishtails records; plots export as JPG or SVG.
- **Per-vessel export** – an Excel workbook (details, particulars, turning data and records), a printable report (open in a browser, print or save as PDF), or a single-vessel file. Restoring a single-vessel file adds or updates that vessel and keeps the rest of the fleet.
- **Backup and restore** – the Backup tab saves the whole fleet with your edits, pins, My Ship and usage to a JSON file (a download on the web, the share sheet on Android). Restoring replaces the fleet and tops up any catalogue ships it lacks.

**NavYeo**

- A floating navigator's assistant (a text and voice assistant is planned). Drag the icon anywhere; it remembers its place. Tap it and a window opens in the centre of the screen, growing out of the icon and fitted to the screen, so every feature is reachable wherever the icon is. Tap outside, press the collapse button or Esc and it shrinks back into the icon. It works on every screen.
- Offline tools: bearings, time/speed/distance, CPA/TCPA, ATB (angle on the bow), course to steer for set and drift, distance off and horizon, HSA (horizontal sextant angles: position fix from two angles between three objects, distance off from one angle, and the length of an object from the bearings of its two ends), wheel-over point (typed or from the vessel's turning data), compass conversion and units. The **(i)** on each tool explains the concept, the method and the formulas.
- Also: man overboard turns (Williamson and Scharnow, worked from the vessel's turning data), and **Sun Run Sun** and **Sun Run Merpass**, which give an observed position from two Sun sights, or a Sun sight and the meridian altitude, with the run between them. The Sun's position is worked out on the device (to about a minute of arc, not the Nautical Almanac), so nothing needs looking up. A **Four Star Fix** tool plans the stopwatch start and four well-spread stars (57 navigational stars from the Hipparcos catalogue, worked to the date, and Venus, Mars, Jupiter, Saturn and the Moon, worked out on the device) and fixes the position from the four sights. Each of these can save the filled **Sight Form (NP 98)** (all 37 lines, one form per sight, plus the plotting data) as a printable page, with the position by the form method shown beside the direct calculation as a cross-check. Based on the SRS and SRM workbook, with the Sun, altitude corrections and fix checked against an exact solution of the altitude circles.
- Also: **Polaris Latitude** (the almanac's Lat = Ho − 1° + a0 + a1 + a2, worked from Polaris's own position, reproducing the class example), and **Rise, Set and Twilight** (sunrise, sunset, meridian passage and the three twilights, the Sun's true bearing at rising and setting, and gyro or compass error from an observed bearing). The Sun, star, planet and Moon forms take a deck watch error (D.W.T. worked back from the G.M.T.), and the four star fix offers a rapid mode with one chosen position for all four bodies.
- Also: **Rules & Buoyage** (the International Regulations for Preventing Collisions at Sea, rules 1 to 41, with the light pictures and short notes, and a random Rules of the Road question quiz), **Tides**, **Anchor**, **Fuel Planning** (from the ship's own fuel data), **Flying Corpen**, and the manoeuvring tools worked from the vessel's turning data where it has them:
  - **Corpen** (column and abreast): the stopwatch time and the bearing at which to alter, for a turn of **any angle** (not only 90°); advance, transfer, time to turn and distance lost are taken from the ship's turning data for that speed, side and angle, and can be typed over. The radian rule is shown for 90°.
  - **Station from Bows** (BR 45(6) 0425), **Station Changes**, **Relative Motion**, **Regain Track** and **RAS Approach** (choose the Guide and the approach ship and the evolution: SKBDL bridge to bridge, RASAP point to point, UNREP fuelling point to fuelling point; the surge comes from the deceleration rate, the speed advantage and the ships' RAS-point positions).
  - **Battenberg**: stations from relative bearing and speed, or from true bearing, distance, course and speed for both ships.
- **Calibration Methods**: short cards with the method for each calibration (lubber's line, gyro, EM log, compass swing and the others) in the books' own words with the source; the books remain the authority. Ship Checks save the five calibration record types into Calibration Data, filled from the ship's own data (including wing repeater distances).
- Type a request in the box at the bottom (or tap the microphone): it matches keywords, so "tactical diameter at 15 kn 20 wheel" answers from the vessel's turning data and "cpa own course 090 ..." opens CPA filled in. It is not an AI.
- Lengths can be entered and shown in cables (the default), nautical miles, metres, yards, kilometres, feet or fathoms; each tool remembers its own last unit. What you last entered stays until you press the clear-all icon (units are kept).

**General**

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
| `data/` | The fleet catalogue (`indianNavy.ts`), the other navies (`foreignNavies.ts` and `navies/*.ts`, one file per navy), registry logic (`fleet.ts`), calibration summaries and custom fields; each with a `.check.ts` |
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
