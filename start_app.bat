@echo off
echo Starting Supermarket Receipt Mapper...

:: Start Backend
echo Starting Backend (Port 3001)...
start "Backend Server" cmd /k "cd backend && node server.js"

:: Start Frontend
echo Starting Frontend (Port 3000)...
start "Frontend Client" cmd /k "cd frontend && npm run dev -- --host"

echo.
echo Application is running!
echo Access the app at: http://localhost:3000
echo.
pause
