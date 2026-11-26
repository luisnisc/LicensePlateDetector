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
set "SERVICE_BASCULA=%BASE_DIR%vision_bascula"
set "VENV_ACTIVATE=%SERVICE_ENTRY%\alpr_env\Scripts\activate.bat"

:: Configuración común de Báscula
set "LOGISTICS_BACKEND_URL=http://localhost:3000/api/v1/bascula/read"
set "SOCKET_SERVER_URL=http://localhost:3000"
set "GPU_MEM_MB=350"
set "KMP_DUPLICATE_LIB_OK=TRUE"

if exist "%VENV_ACTIVATE%" (
    echo [INFO] Entorno virtual 'alpr_env' encontrado.
) else (
    echo [ERROR] No se encontró el entorno virtual en:
    echo         "%VENV_ACTIVATE%"
    echo.
    pause
    popd
    exit /b 1
)

if not exist "%SERVICE_BASCULA%\detector.py" (
    echo [ERROR] No se encontró detector.py en:
    echo         "%SERVICE_BASCULA%"
    echo.
    pause
    popd
    exit /b 1
)

echo.
echo [INFO] Arrancando detectores en ventanas independientes...
echo.

:: --- BARRERAS DE ACCESO ---
start "ALPR - Cámara Entrada" cmd /k "pushd "%SERVICE_ENTRY%" && call "%VENV_ACTIVATE%" && python detector.py"
timeout /t 3 /nobreak >nul

start "ALPR - Cámara Salida" cmd /k "pushd "%SERVICE_EXIT%" && call "%VENV_ACTIVATE%" && python detector.py"
timeout /t 3 /nobreak >nul

:: --- BÁSCULA (TRACTORA Y REMOLQUE) ---
:: Nota: Si la contraseña RTSP lleva %40, dentro de un .bat debe escribirse como %%40
start "ALPR - Báscula Tractora" cmd /k "pushd "%SERVICE_BASCULA%" && call "%VENV_ACTIVATE%" && set "CAMERA_ID=CAM_TRACTORA_01" && set "VIDEO_SOURCE=0" && python detector.py"
timeout /t 3 /nobreak >nul

start "ALPR - Báscula Remolque" cmd /k "pushd "%SERVICE_BASCULA%" && call "%VENV_ACTIVATE%" && set "CAMERA_ID=CAM_REMOLQUE_02" && set "VIDEO_SOURCE=1" && python detector.py"

echo [ÉXITO] Las 4 instancias (Accesos y Báscula) se han iniciado correctamente.
popd
exit /b 0
