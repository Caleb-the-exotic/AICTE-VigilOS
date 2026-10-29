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

rem --- Detect Python executable ---
set "PYTHON_EXE="
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
  set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "venv\Scripts\python.exe" (
  set "PYTHON_EXE=venv\Scripts\python.exe"
) else (
  set "PYTHON_EXE=python"
)

rem --- Start backend (FastAPI) ---
start "AICTEProFlow Backend (Port %API_PORT%)" %PYTHON_EXE% -m uvicorn api_server:app --reload --host 127.0.0.1 --port %API_PORT%

rem --- Start frontend (Vite) ---
start "AICTEProFlow Frontend (Port %VITE_PORT%)" cmd /c "pnpm run dev -- --host 0.0.0.0 --port %VITE_PORT%"

echo.
echo Backend:   http://127.0.0.1:%API_PORT%/ (docs: http://127.0.0.1:%API_PORT%/docs)
echo Frontend: http://localhost:%VITE_PORT%/
echo.
echo Press Ctrl+C in this window to stop.

:wait
timeout /t 3600 >nul
goto wait

popd
endlocal
