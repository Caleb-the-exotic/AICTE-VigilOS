@echo off
setlocal

set FRONTEND_DIR=%~dp0

set VITE_PORT=8080
set API_PORT=8000

rem --- Ensure script runs from repo root ---
pushd "%FRONTEND_DIR%" || exit /b 1

rem --- Create/ensure .env with required VITE_API_BASE_URL if missing ---
if not exist .env (
  echo VITE_API_BASE_URL=http://localhost:%API_PORT%> .env
) else (
  findstr /b /c:"VITE_API_BASE_URL=" .env >nul
  if errorlevel 1 (
    echo VITE_API_BASE_URL=http://localhost:%API_PORT%>> .env
  )
)

echo Starting backend + frontend...

rem --- Start backend (FastAPI) ---
start "backend" /b cmd /c "if exist venv\Scripts\python.exe ( venv\Scripts\python.exe -m uvicorn api_server:app --reload --host 127.0.0.1 --port %API_PORT% ) else ( py -m uvicorn api_server:app --reload --host 127.0.0.1 --port %API_PORT% || python -m uvicorn api_server:app --reload --host 127.0.0.1 --port %API_PORT% )"

rem --- Start frontend (Vite) ---
start "frontend" /b cmd /c "pnpm run dev -- --host 0.0.0.0 --port %VITE_PORT%"

echo.
echo Backend:   http://127.0.0.1:%API_PORT%/ (docs: http://127.0.0.1:%API_PORT%/docs)
echo Frontend: http://localhost:%VITE_PORT%/
echo.
echo Press Ctrl+C in this window to stop (servers are in separate windows/processes).

:wait
timeout /t 3600 >nul
goto wait

popd
endlocal

