@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages...
  call npm install
)
echo ============================================
echo   Oruk.AI frontend: http://localhost:3010
echo ============================================
call npm run dev
