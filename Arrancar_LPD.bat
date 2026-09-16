@echo off
title Sistema ALPR - Motor de Inferencia (Python Multi-Cámara)
color 0A

echo =======================================================
echo     SISTEMA ALPR - INICIALIZANDO ENTORNO PYTHON
echo =======================================================
echo.


pushd "%~dp0"

set "BASE_DIR=%~dp0"
set "SERVICE_ENTRY=%BASE_DIR%vision_service"
set "SERVICE_EXIT=%BASE_DIR%vision_service_exit"
set "VENV_ACTIVATE=%SERVICE_ENTRY%\alpr_env\Scripts\activate.bat"


if exist "%VENV_ACTIVATE%" (
    echo [INFO] Activando entorno virtual 'alpr_env'...
) else (
    echo [ERROR] No se encontró el entorno virtual en:
    echo         "%VENV_ACTIVATE%"
    echo.
    pause
    popd
    exit /b 1
)

echo.
echo [INFO] Arrancando detectores en ventanas independientes...
echo.


start "ALPR - Cámara Entrada" cmd /k "pushd "%SERVICE_ENTRY%" && call "%VENV_ACTIVATE%" && python detector.py"

start "ALPR - Cámara Salida" cmd /k "pushd "%SERVICE_EXIT%" && call "%VENV_ACTIVATE%" && python detector.py"

echo [ÉXITO] Instancias de entrada y salida iniciadas correctamente.
popd
exit /b 0