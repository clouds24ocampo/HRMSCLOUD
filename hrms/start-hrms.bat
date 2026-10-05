@echo off
rem Double-click to start everything: Docker, the database and the app.
cd /d "%~dp0"
echo Starting the HRMS. Keep this window open. Close it to stop.
call npm run dev
pause
