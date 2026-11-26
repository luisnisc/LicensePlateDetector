@echo off
title Sistema ALPR - Motor de Inferencia (Python Multi-Cámara)
color 0A

echo =======================================================
echo     SISTEMA ALPR - INICIALIZANDO ENTORNO PYTHON
echo =======================================================
echo.

:: Monta la ruta UNC (si viene de red) en una letra de unidad temporal (ej. Z:\)
pushd "%~dp0"

:: Usamos %CD%\ (la letra de unidad montada) en lugar de %~dp0 (la ruta UNC)
set "BASE_DIR=%CD%\"
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
    echo [INFO] Entorno virtual 'alpr_env' encontrado en %BASE_DIR%.
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
start "ALPR - Cámara Entrada" /D "%SERVICE_ENTRY%" cmd /k "call "%VENV_ACTIVATE%" && python detector.py"
timeout /t 3 /nobreak >nul

start "ALPR - Cámara Salida" /D "%SERVICE_EXIT%" cmd /k "call "%VENV_ACTIVATE%" && python detector.py"
timeout /t 3 /nobreak >nul

:: --- BÁSCULA (TRACTORA Y REMOLQUE) ---
start "ALPR - Báscula Tractora" /D "%SERVICE_BASCULA%" cmd /k "call "%VENV_ACTIVATE%" && set "CAMERA_ID=CAM_TRACTORA_01" && set "VIDEO_SOURCE=rtsp://admin:Filip%%402807@10.255.40.85:554/Streaming/Channels/101" && python detector.py"
timeout /t 3 /nobreak >nul

start "ALPR - Báscula Remolque" /D "%SERVICE_BASCULA%" cmd /k "call "%VENV_ACTIVATE%" && set "CAMERA_ID=CAM_REMOLQUE_02" && set "VIDEO_SOURCE=rtsp://admin:Filip%%402807@10.255.40.86:554/Streaming/Channels/101" && python detector.py"

echo [ÉXITO] Las 4 instancias (Accesos y Báscula) se han iniciado correctamente.
popd
exit /b 0
