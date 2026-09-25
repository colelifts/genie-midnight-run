@echo off
cd /d "%~dp0"
if not exist "node_modules\three\package.json" (
  echo Installing game dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
echo.
echo Open http://127.0.0.1:5173/ in your browser.
echo Keep this window open while you play.
echo.
call npm run dev
