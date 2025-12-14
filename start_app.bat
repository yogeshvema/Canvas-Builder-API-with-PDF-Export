@echo off
echo Starting Backend...
start cmd /k "cd backend && npm start"

echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"

echo Application started!
echo Backend running on http://localhost:3000
echo Frontend running on http://localhost:5173
