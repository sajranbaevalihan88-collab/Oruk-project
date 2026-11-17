@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
  echo Creating venv...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt 2>nul
python seed_data.py
echo.
echo ============================================
echo   Oruk.AI backend:  http://127.0.0.1:8020
echo   Swagger docs:     http://127.0.0.1:8020/docs
echo ============================================
python run_backend.py
