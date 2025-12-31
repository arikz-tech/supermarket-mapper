@echo off
echo Starting backend...
start cmd /k "cd backend && npm install && npm start"
echo Starting frontend...
start cmd /k "cd frontend && npm install && npm run dev"
echo Both services are starting in new windows.
echo You may close this window.
