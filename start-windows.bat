@echo off
rem Cursed Pilot - Windows launcher for testing.
rem   start-windows.bat          menu
rem   start-windows.bat dev      dev server, opens the browser
rem   start-windows.bat test     type check + all self-checks + production build
rem   start-windows.bat apk      build the Android debug APK (needs JDK 21)
rem Set NOPAUSE=1 to skip the final "press any key", NOOPEN=1 to not open a browser.
setlocal EnableExtensions
cd /d "%~dp0"
title Cursed Pilot

set "PORT=3100"
set "VITE=node node_modules\vite\bin\vite.js"
set "TSC=node node_modules\typescript\bin\tsc"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node 22 or newer from https://nodejs.org and run this again.
  goto :end_fail
)
rem the self-checks run TypeScript directly in Node, which needs 22.18+ (or any 23.6+)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>23||(a===23&&b>=6)||(a===22&&b>=18)||a>=24?0:1)"
if errorlevel 1 (
  echo Your Node.js is older than 22.18. Update from https://nodejs.org - the self-checks need it.
  goto :end_fail
)

rem node_modules\.bin is missing on some copies of this folder, so call vite and tsc through node.
if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies - first run only...
  call npm install
  if errorlevel 1 ( echo npm install failed. & goto :end_fail )
)

if /i "%~1"=="dev"  goto :dev
if /i "%~1"=="test" goto :test
if /i "%~1"=="apk"  goto :apk

:menu
echo.
echo   Cursed Pilot
echo   ------------
echo   1  Start dev server and open the browser
echo   2  Run checks: type check, self-checks, production build
echo   3  Build Android debug APK
echo   4  Quit
echo.
choice /c 1234 /n /m "Choose 1-4: "
if errorlevel 4 goto :end_ok
if errorlevel 3 goto :apk
if errorlevel 2 goto :test
goto :dev

:dev
echo.
echo Starting on http://localhost:%PORT% - press Ctrl+C to stop.
echo If that port is busy, Vite picks the next free one and prints it below.
echo.
if defined NOOPEN ( %VITE% --port %PORT% ) else ( %VITE% --port %PORT% --open )
goto :end_ok

:test
echo.
echo [1/3] Type check
%TSC% --noEmit
if errorlevel 1 ( echo TYPE CHECK FAILED & goto :end_fail )
echo OK
echo.
echo [2/3] Self-checks
call npm run check --silent
if errorlevel 1 ( echo SELF-CHECKS FAILED & goto :end_fail )
echo.
echo [3/3] Production build
%VITE% build >nul 2>nul
if errorlevel 1 ( echo BUILD FAILED - run "%VITE% build" to see why & goto :end_fail )
echo OK
echo.
echo All checks passed.
goto :end_ok

:apk
rem Gradle 8 cannot run on JDK 25, so prefer a JDK 21 and say which one is used.
if not defined JAVA21 (
  if exist "C:\Program Files\Android\openjdk\jdk-21.0.8\bin\java.exe" set "JAVA21=C:\Program Files\Android\openjdk\jdk-21.0.8"
)
if defined JAVA21 set "JAVA_HOME=%JAVA21%"
if not defined JAVA_HOME (
  echo No JDK found. Set JAVA21 to a JDK 21 folder, then run this again.
  goto :end_fail
)
echo Using JDK: %JAVA_HOME%
echo.
echo Building web assets and syncing to Android...
call npm run android --silent
if errorlevel 1 ( echo SYNC FAILED & goto :end_fail )
pushd android
call gradlew.bat assembleDebug --console=plain
set "RC=%ERRORLEVEL%"
popd
if not "%RC%"=="0" ( echo APK BUILD FAILED & goto :end_fail )
echo.
echo APK: %CD%\android\app\build\outputs\apk\debug\app-debug.apk
goto :end_ok

:end_fail
if not defined NOPAUSE pause
exit /b 1

:end_ok
if not defined NOPAUSE pause
exit /b 0
