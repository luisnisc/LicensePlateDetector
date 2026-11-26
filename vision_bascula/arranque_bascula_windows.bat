@echo off
cd /d "%~dp0"

:: Variables comunes (coinciden exactamente con os.getenv de tu .py)
set LOGISTICS_BACKEND_URL=http://192.168.1.50:3000/api/v1/bascula/read
set SOCKET_SERVER_URL=http://192.168.1.50:3000
set LPR_API_TOKEN=puL04ku10jfrSfVES22gBSYGAxZHsESIizgAqw2oGZQupLys5iWJ71hH27cI3eimeg3VS1vyDf
set GPU_MEM_MB=400
set KMP_DUPLICATE_LIB_OK=TRUE

:: Instancia 1: Tractora
start "ALPR Tractora" cmd /k "set CAMERA_ID=CAM_TRACTORA_01 && set VIDEO_SOURCE=rtsp://admin:Filip%%402807@10.255.40.85:554/Streaming/Channels/101 && venv\Scripts\python.exe lpr_registro.py"

timeout /t 4 /nobreak >nul

:: Instancia 2: Remolque
start "ALPR Remolque" cmd /k "set CAMERA_ID=CAM_REMOLQUE_02 && set VIDEO_SOURCE=rtsp://admin:Filip%%402807@10.255.40.86:554/Streaming/Channels/101 && venv\Scripts\python.exe lpr_registro.py"
