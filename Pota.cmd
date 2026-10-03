@echo off
rem Pota'yi baslatir: gerekirse kurar ve derler, sonra yerel sunucuyu acip tarayiciyi baslatir.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js bulunamadi. https://nodejs.org adresinden Node 20 veya ustunu kurun.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Paketler kuruluyor...
  call npm install --no-audit --no-fund || goto :error
)
rem Her acilista derler; boylece guncellenen kod hemen gorunur (birkac saniye surer).
echo Derleniyor...
call npm run build || goto :error
node server\start.mjs --open
goto :eof

:error
echo.
echo Bir hata olustu. Yukaridaki mesajlara bakin.
pause
exit /b 1
