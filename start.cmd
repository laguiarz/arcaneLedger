@echo off
title Arcanist's Ledger
cd /d "%~dp0"
echo Starting Arcanist's Ledger dev server...
echo (Press Ctrl+C in this window to stop the app.)
echo.
call npm run dev -- --port 5180 --strictPort --open
