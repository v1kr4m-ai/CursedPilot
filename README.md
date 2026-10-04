# Cursed Pilot

*Long ND made Short.* A records app for ship handlers: keep each vessel's particulars, turning data and calibration records in one place, and run a few quick navigation calculations. Built as a React web app and wrapped for Android with Capacitor. It works fully offline.

## Features

- **Welcome splash** – animated logo and tagline on launch.
- **Fleet inventory** – add, search, filter (Destroyer, Frigate, Corvette, OPV, Carrier, LST, Tanker, Submarine and more) and remove vessels.
- **Ship particulars** – length and breadth overall, displacement, and stem-to-standard / bridge / RAS point / fueling point distances.
- **Turning data** – one sheet per speed, wheel angle and turn side (Port or Starboard), prefilled with turn amounts from 0° to 345°. Records bearing of MOB, angle, range, transfer, advance, distance to new course, time and speed.
- **Fishtail Calculator** – the fishtail manoeuvre planner is built into the app, not a separate module: calculator with plot, radar and animation views, plus a Battenberg target solver. It works on the selected vessel and reads that vessel's own turning data (there is no separate table library), so changes follow the vessel through backups and exports. *Save* on a plot adds the outcome (type, angles, drop and lateral separation) to the vessel's Fishtails records. Turning data can be entered by hand or imported from Excel, CSV or JSON (the vessel's Excel export imports back cleanly; sheets without speed, wheel and side columns ask for them). Plots export as JPG or SVG.
- **Records** – entry forms for fishtails (speed, rudder, overshoot, cycle time), acceleration/deceleration runs (from/to speed, time, distance), EM log calibration (true speed vs log reading, error worked out for you) and compass swing (compass, residual deviation), each with date and remarks. Open a form from the **+** on the vessel's card (fishtails also from the home screen). Records can be edited (pencil) or deleted. Records saved before editing existed open for re-entry, since their original values were never stored.
- **Navigator's Tools** – nine offline tools behind the Tools button: bearing calculator (reciprocal, relative to true), time/speed/distance (solves any one from the other two), CPA/TCPA, course to steer for set and drift, distance off by vertical sextant angle with visual and radar horizons, wheel-over point (typed advance/transfer, or interpolated from the selected vessel's turning data), compass conversion (true/magnetic/compass and gyro), radian rule, and a unit converter (nm, cables, yards, fathoms, knots and more). Results are aids: each tool states its assumptions, so check them against your own procedures.
- **Print** – the Turning Data Entry screen has a print button (uses the system print dialog).
- **AI particulars (optional)** – fill a vessel's particulars with Gemini-generated estimates. Needs a network connection and an API key; everything else works without either.
- **Themes** – Day, Dark, and Night red (dark theme plus a red filter so only red light reaches the eye, to protect night vision on the bridge). Cycle with the button at the top of the home screen; the choice is remembered. The Fishtail calculator keeps its own dark styling.
- **Persistence** – data is saved in the browser's `localStorage` (key `cursedpilot.ships.v1`) and survives restarts. It is local to the device and is not synced anywhere.
- **Per-vessel export** – the download button on a vessel's screen exports just that vessel as an Excel workbook (one sheet each for particulars, turning data and the four record types), a printable report (open in a browser, then print or save as PDF), or a single-vessel file. Restoring a single-vessel file adds or updates that vessel and leaves the rest of the fleet alone; restoring a full backup still replaces everything.
- **Backup and restore** – *Export* on the home screen saves every vessel to a `cursedpilot-backup-YYYY-MM-DD.json` file (a download on the web, the share sheet on Android, so you can send it to Drive, email or another device). *Restore* loads such a file and replaces all current vessels after a confirmation. Files from other apps or damaged files are rejected without changing anything.

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

React 19, TypeScript, Vite, Tailwind CSS 4 (bundled locally), lucide-react, Capacitor 8, `@google/genai`, `xlsx` (spreadsheet import in the calculator).

## Layout

| Path | Purpose |
| --- | --- |
| `App.tsx` | All views and state |
| `types.ts` | Ship, particulars and record types |
| `constants.tsx` | Seed vessels |
| `tools/` | Navigator's tools: `navMath.ts` (pure maths), `NavTools.tsx` (UI), `navMath.check.ts` (run with `npm run check:nav`) |
| `services/` | Gemini call, backup/restore, per-vessel export (`vesselReport.ts` has the pure builders, checked with `npm run check:export`). `npm run check` runs all the maths and conversion checks |
| `fishtail/` | Fishtail calculator screen, plot/solver components, and import/conversion of turning data (`tableConvert.ts`, checked with `npm run check:tables`) |
| `android/` | Capacitor Android project |

## Known limits

- Data lives in on-device storage: clearing app data or uninstalling erases it. Export a backup regularly; nothing is backed up automatically.
- Restoring a full backup replaces everything; use a single-vessel file to merge one vessel in.
- Records are for reference. Always verify against your ship's own trials and standing orders.
