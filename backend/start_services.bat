@echo off
echo Starting Backend Services...

echo.
echo Starting TTS Service (Port 5000)...
start "TTS Service" cmd /k "cd backend\tts_service && python run.py"

echo.
echo Starting PDF Service (Port 8000)...
start "PDF Service" cmd /k "cd backend\pdf_service && python run.py"

echo.
echo Services starting...
echo TTS Service: http://localhost:5000
echo PDF Service: http://localhost:8000
echo.
echo Press any key to exit...
pause
