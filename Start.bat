@echo off
chcp 65001 >nul
title TokTok Sha3bola - توكتوك شعبولا
cd /d "%~dp0"

echo ==========================================
echo    توكتوك شعبولا  -  TokTok Sha3bola
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js غير مثبّت على جهازك.
  echo     نزّل النسخة LTS من https://nodejs.org ثم شغّل هذا الملف مرة تانية.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] جاري تثبيت المكتبات ^(مرة واحدة فقط، محتاج إنترنت^)...
  call npm install
  if errorlevel 1 (
    echo [X] فشل تثبيت المكتبات. تأكد من الاتصال بالإنترنت وجرّب تاني.
    pause
    exit /b 1
  )
) else (
  echo [1/3] المكتبات مثبّتة.
)

if not exist public\data\ain-shams-east.json (
  echo [2/3] جاري تحميل شوارع عين شمس الشرقية من OpenStreetMap ^(مرة واحدة^)...
  call npm run fetch-map
  if not exist public\data\ain-shams-east.json (
    echo     تعذر التحميل الآن. اللعبة هتحاول تحمّلها من المتصفح، أو تستخدم خريطة تجريبية.
  )
) else (
  echo [2/3] بيانات الخريطة موجودة.
)

echo [3/3] تشغيل اللعبة... هيفتح المتصفح تلقائيًا على http://localhost:5173
echo       لإغلاق اللعبة اقفل هذه النافذة أو اضغط Ctrl+C.
echo.
call npm run dev
pause
