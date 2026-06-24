
@echo off
:: Check for admin rights and auto-elevate if not present
>nul 2>&1 fsutil dirty query %systemdrive% || (
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /b
)
:: Your commands below
net stop mariaDB
pause
    