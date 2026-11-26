#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Usa el python del entorno virtual si existe, si no el del sistema
PYTHON_BIN="${SCRIPT_DIR}/venv/bin/python"
[[ ! -x "$PYTHON_BIN" ]] && PYTHON_BIN="python3"

export CAMERA_ID="CAM_TRACTORA_01"
# export VIDEO_SOURCE="rtsp://usuario:password@10.255.40.86:554/Streaming/Channels/101"
export VIDEO_SOURCE=0
export ROI_BOX="260,250,2000,1200"
export GPU_MEM_MB="400"
export HEADLESS="false"

exec "$PYTHON_BIN" detector.py
