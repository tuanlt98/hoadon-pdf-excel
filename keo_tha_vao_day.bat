@echo off
chcp 65001 >nul
REM Keo-tha file PDF/anh (hoac ca thu muc) vao file .bat nay.
REM Ket qua Excel nam canh file .bat nay.
cd /d "%~dp0"
python invoice_to_excel.py %* -o "%~dp0hoa_don_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%.xlsx"
pause
