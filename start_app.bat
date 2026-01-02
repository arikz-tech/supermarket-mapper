@echo off
echo Starting Supermarket Receipt Mapper...

:: Start Backend
echo Starting Backend (Port 3001)...
start "Backend Server" cmd /k "cd backend && set GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json && node server.js"

:: Start Frontend
echo Starting Frontend (Port 3000)...
start "Frontend Client" cmd /k "cd frontend && npm run dev -- --host"

:: Open browser
echo Opening browser...
timeout /t 5 /nobreak
start "" "http://localhost:3000"

echo.
echo Application is running!
echo Access the app at: http://localhost:3000
echo.
pause
