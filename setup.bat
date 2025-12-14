@echo off
echo Installing Backend Dependencies...
cd backend
call npm install
cd ..

echo Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

echo Setup Complete! You can now run start_app.bat
pause
