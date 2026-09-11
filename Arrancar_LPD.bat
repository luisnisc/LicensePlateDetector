@echo off
title Sistema ALPR - Motor de Inferencia (Python)
color 0A

echo =======================================================
echo     SISTEMA ALPR - INICIALIZANDO ENTORNO PYTHON
echo =======================================================
echo.


cd /d "D:\INFORMATICA\Luis\codigo\python\LicensePlateDetector\vision_service"


if exist "D:\INFORMATICA\Luis\codigo\python\LicensePlateDetector\vision_service\alpr_env\Scripts\activate.bat" (
    echo [INFO] Activando entorno virtual 'alpr_env'...
    call "D:\INFORMATICA\Luis\codigo\python\LicensePlateDetector\vision_service\alpr_env\Scripts\activate.bat"
) else (
    echo [ERROR] No se encontro el entorno virtual en la ruta especificada.
    echo [ERROR] Directorio actual: %CD%
    echo.
    pause
    exit /b
)

echo.
echo [INFO] Arrancando modelos de Vision Artificial...
echo.

python detector.py


echo.
echo [SISTEMA] El script ha finalizado o se ha cerrado.
exit
