@echo off
REM Windows batch file to run Evacua locally

set PORT=3000

echo Starting Evacua server on http://localhost:%PORT%
echo Press Ctrl+C to stop
echo.

python -m http.server %PORT%

