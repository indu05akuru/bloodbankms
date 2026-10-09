@echo off
cd /d "%~dp0backend"
echo Starting Blood Bank Management System...
echo Open http://127.0.0.1:8000 in your browser
echo API docs at http://127.0.0.1:8000/docs
python3.12 -m uvicorn main:app --reload --port 8000
pause
