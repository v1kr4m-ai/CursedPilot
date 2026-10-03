# Cursed Pilot

*Long ND made Short.* A records app for ship handlers: keep each vessel's particulars, turning data and calibration records in one place, and run a few quick navigation calculations. Built as a React web app and wrapped for Android with Capacitor. It works fully offline.

## Features

- **Welcome splash** – animated logo and tagline on launch.
- **Fleet inventory** – add, search, filter (Destroyer, Frigate, Corvette, OPV, Carrier, LST, Tanker, Submarine and more) and remove vessels.
- **Ship particulars** – length and breadth overall, displacement, and stem-to-standard / bridge / RAS point / fueling point distances.
- **Turning data** – one sheet per speed, wheel angle and turn side (Port or Starboard), prefilled with turn amounts from 0° to 345°. Records bearing of MOB, angle, range, transfer, advance, distance to new course, time and speed.
- **Records** – entry forms for fishtails (speed, rudder, overshoot, cycle time), acceleration/deceleration runs (from/to speed, time, distance), EM log calibration (true speed vs log reading, error worked out for you) and compass swing (compass, residual deviation), each with date and remarks. Open a form from the **+** on the vessel's card (fishtails also from the home screen). Records can be deleted.
- **Navigator's Tools** – bearing reciprocal, radian rule (θ = d/R) and speed rule (S = D/T).
- **Print** – the Turning Data Entry screen has a print button (uses the system print dialog).
- **AI particulars (optional)** – fill a vessel's particulars with Gemini-generated estimates. Needs a network connection and an API key; everything else works without either.
- **Persistence** – data is saved in the browser's `localStorage` (key `cursedpilot.ships.v1`) and survives restarts. It is local to the device and is not synced anywhere.
- **Backup and restore** – *Export* on the home screen saves every vessel to a `cursedpilot-backup-YYYY-MM-DD.json` file (a download on the web, the share sheet on Android, so you can send it to Drive, email or another device). *Restore* loads such a file and replaces all current vessels after a confirmation. Files from other apps or damaged files are rejected without changing anything.

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

React 19, TypeScript, Vite, Tailwind CSS 4 (bundled locally), lucide-react, Capacitor 8, `@google/genai`.

## Layout

| Path | Purpose |
| --- | --- |
| `App.tsx` | All views and state |
| `types.ts` | Ship, particulars and record types |
| `constants.tsx` | Seed vessels |
| `services/geminiService.ts` | Gemini call for particulars |
| `android/` | Capacitor Android project |

## Known limits

- Data lives in on-device storage: clearing app data or uninstalling erases it. Export a backup regularly; nothing is backed up automatically.
- Restore replaces everything. There is no merge.
- Records are for reference. Always verify against your ship's own trials and standing orders.
