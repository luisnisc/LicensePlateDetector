#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PYTHON_BIN="${SCRIPT_DIR}/venv/bin/python"
[[ ! -x "$PYTHON_BIN" ]] && PYTHON_BIN="python3"

export CAMERA_ID="CAM_REMOLQUE_02"
# export VIDEO_SOURCE="rtsp://usuario:password@10.255.40.87:554/Streaming/Channels/101"
export VIDEO_SOURCE=2
export ROI_BOX="260,250,2000,1200"
export GPU_MEM_MB="400"
export HEADLESS="false"

exec "$PYTHON_BIN" detector.py
