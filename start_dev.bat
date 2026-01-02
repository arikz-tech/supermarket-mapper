@echo off
echo Starting backend...
start cmd /k "cd backend && set NODE_ENV=development && set GOOGLE_APPLICATION_CREDENTIALS=google-credentials.json && npm start"
echo Starting frontend...
start cmd /k "cd frontend && npm install && npm run dev"
echo Both services are starting in new windows.
echo You may close this window.
