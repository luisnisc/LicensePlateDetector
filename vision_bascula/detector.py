import os

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import cv2
import re
import time
import queue
import logging
import threading
import numpy as np
import requests
import socketio
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from collections import Counter
from dataclasses import dataclass
from ultralytics import YOLO
from paddleocr import PaddleOCR

load_dotenv()


def parse_roi(roi_str):
    if not roi_str or roi_str.strip().lower() == "none":
        return None
    parts = [int(x.strip()) for x in roi_str.split(",")]
    return tuple(parts) if len(parts) == 4 else None


def parse_source(src_str):
    if src_str.isdigit():
        return int(src_str)
    return src_str


@dataclass
class Config:
    BACKEND_URL: str = os.getenv(
        "LOGISTICS_BACKEND_URL", "http://localhost:3000/api/v1/bascula/read"
    )
    SOCKET_SERVER_URL: str = os.getenv("SOCKET_SERVER_URL", "http://localhost:3000")
    CAMERA_ID: str = os.getenv("CAMERA_ID", "CAM_LOGISTICA_01")
    VIDEO_SOURCE = parse_source(
        os.getenv(
            "VIDEO_SOURCE",
            "rtsp://admin:Filip%402807@10.255.40.85:554/Streaming/Channels/101",
        )
    )

    # Límite de VRAM para PaddleOCR por instancia (en MB)
    GPU_MEM_MB: int = int(os.getenv("GPU_MEM_MB", "400"))

    CONF_PLATE: float = float(os.getenv("CONF_PLATE", "0.35"))
    OCR_MIN_PROB: float = float(os.getenv("OCR_MIN_PROB", "0.70"))

    BLUR_THRESHOLD: float = 35.0
    MIN_PLATE_WIDTH: int = 20

    REQUIRED_MATCHES: int = 2
    MAX_ATTEMPTS: int = 4
    PLATE_COOLDOWN_SECONDS: float = 45.0

    CHAR_VOTE_MIN_AGREEMENT: float = 0.6
    ROI_BOX = parse_roi(os.getenv("ROI_BOX", "none"))

    STABILITY_FRAMES: int = 2
    STABILITY_MOVEMENT_PX: int = 60

    RECONNECT_ATTEMPTS: int = 10
    RECONNECT_DELAY: float = 2.0


logging.getLogger("ppocr").setLevel(logging.ERROR)

API_TOKEN = os.getenv("LPR_API_TOKEN")

sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,
    reconnection_delay=2,
)


@sio.event
def connect():
    print(f"[STREAM - {Config.CAMERA_ID}] Conectado al WebSocket de Node.js")


@sio.event
def disconnect():
    print(f"[STREAM - {Config.CAMERA_ID}] Desconectado del WebSocket. Reintentando...")


class PlateTracker:
    """
    Rastrea la estabilidad espacial de cada matrícula detectada de forma independiente,
    evitando que dos matrículas simultáneas (tractora + remolque) se reinicien entre sí.
    """

    def __init__(self, required_frames=2, max_movement_px=60):
        self.tracks = []
        self.required_frames = required_frames
        self.max_movement_px = max_movement_px

    def is_stable(self, bbox):
        now = time.time()
        self.tracks = [t for t in self.tracks if (now - t["last_seen"]) < 1.5]

        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2

        for track in self.tracks:
            dx = abs(cx - track["centroid"][0])
            dy = abs(cy - track["centroid"][1])
            if dx <= self.max_movement_px and dy <= self.max_movement_px:
                track["centroid"] = (cx, cy)
                track["count"] += 1
                track["last_seen"] = now
                return track["count"] >= self.required_frames

        self.tracks.append({"centroid": (cx, cy), "count": 1, "last_seen": now})
        return self.required_frames <= 1


class MultiPlateValidator:
    """
    Valida y mantiene un cooldown independiente por cada matrícula detectada.
    Permite leer simultáneamente cabeza tractora (blanca) y remolque (roja)
    sin que una bloquee a la otra.
    """

    def __init__(self):
        self.buffers = {}
        self.sent_timestamps = {}
        self.mutex = threading.Lock()

    def add_read(self, plate_text, confidence, plate_type):
        with self.mutex:
            now = time.time()

            expired = [
                p
                for p, ts in self.sent_timestamps.items()
                if (now - ts) >= Config.PLATE_COOLDOWN_SECONDS
            ]
            for p in expired:
                del self.sent_timestamps[p]

            if plate_text in self.sent_timestamps:
                return None

            bucket_key = len(plate_text)
            buf = self.buffers.setdefault(bucket_key, [])
            buf.append((plate_text, confidence, plate_type))

            raw_texts = [r[0] for r in buf]
            counts = Counter(raw_texts)
            most_common_text, freq = counts.most_common(1)[0]

            candidate = None
            if freq >= Config.REQUIRED_MATCHES:
                candidate = most_common_text
            elif len(buf) >= Config.MAX_ATTEMPTS:
                candidate = self._character_vote(buf)

            if candidate:
                if candidate in self.sent_timestamps:
                    self.buffers[bucket_key].clear()
                    return None

                types = [r[2] for r in buf if r[0] == candidate] or [plate_type]
                final_type = Counter(types).most_common(1)[0][0]

                self.sent_timestamps[candidate] = now
                self.buffers[bucket_key].clear()
                return candidate, final_type

            if len(buf) >= Config.MAX_ATTEMPTS:
                buf.pop(0)

            return None

    def _character_vote(self, candidates):
        length = len(candidates[0][0])
        reconstructed = []
        for i in range(length):
            weighted_votes = {}
            for text, conf, _ in candidates:
                ch = text[i]
                weighted_votes[ch] = weighted_votes.get(ch, 0.0) + conf
            best_char = max(weighted_votes, key=weighted_votes.get)
            if (
                weighted_votes[best_char] / sum(weighted_votes.values())
            ) < Config.CHAR_VOTE_MIN_AGREEMENT:
                return None
            reconstructed.append(best_char)
        return "".join(reconstructed)

    def get_recent_plates(self):
        with self.mutex:
            now = time.time()
            return [p for p, ts in self.sent_timestamps.items() if (now - ts) < 6.0]


class CameraCapture:
    def __init__(self, src):
        self.src = src
        self.lock = threading.Lock()
        self.frame = None
        self.running = True

        if isinstance(self.src, int) or str(self.src).isdigit():
            self.cap = cv2.VideoCapture(int(self.src))
        else:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
            self.cap = cv2.VideoCapture(self.src, cv2.CAP_FFMPEG)

        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()

        print(f"[STREAM - {Config.CAMERA_ID}] Esperando primer fotograma...")
        start_time = time.time()
        while self.frame is None and (time.time() - start_time) < 10.0:
            time.sleep(0.1)

    def _update(self):
        while self.running:
            if not self.cap.isOpened():
                time.sleep(1)
                try:
                    if isinstance(self.src, int) or str(self.src).isdigit():
                        self.cap.open(int(self.src))
                    else:
                        self.cap.open(self.src, cv2.CAP_FFMPEG)
                        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass
                continue

            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.frame = frame
            else:
                time.sleep(0.05)

    def read(self):
        with self.lock:
            if self.frame is not None:
                return True, self.frame.copy()
            return False, None

    def isOpened(self):
        return self.cap.isOpened()

    def release(self):
        self.running = False
        self.thread.join(timeout=1.0)
        self.cap.release()


class ALPRLogisticsSystem:
    def __init__(self):
        print(
            f"[SISTEMA - {Config.CAMERA_ID}] Cargando detector directo de matrículas (VRAM PaddleOCR limitada a {Config.GPU_MEM_MB} MB)..."
        )
        self.plate_model = YOLO("license_plate_detector.pt")
        self.reader = PaddleOCR(
            use_angle_cls=False,
            lang="en",
            use_gpu=True,
            gpu_mem=Config.GPU_MEM_MB,
            show_log=False,
        )

        self.plate_tracker = PlateTracker(
            required_frames=Config.STABILITY_FRAMES,
            max_movement_px=Config.STABILITY_MOVEMENT_PX,
        )
        self.validator = MultiPlateValidator()
        self.current_detections = []
        self.detection_lock = threading.Lock()
        self.frame_queue = queue.Queue(maxsize=3)
        self._last_stream_ts = 0.0

        self.session = requests.Session()
        retries = Retry(
            total=2, backoff_factor=0.3, status_forcelist=[500, 502, 503, 504]
        )
        self.session.mount("http://", HTTPAdapter(max_retries=retries))
        self.session.mount("https://", HTTPAdapter(max_retries=retries))

        self._warmup()

    def _warmup(self):
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.plate_model(dummy, verbose=False)

    def is_blur(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return variance < Config.BLUR_THRESHOLD

    def is_plausible_plate(self, text):
        if not (4 <= len(text) <= 10):
            return False
        if len(set(text)) == 1:
            return False
        if text.isalpha() or text.isdigit():
            return False
        return True

    def classify_plate_type(self, plate_bgr, clean_text):
        """
        Analiza el color de fondo en espacio HSV para diferenciar matrícula
        roja de remolque frente a matrícula blanca de cabeza tractora.
        """
        hsv = cv2.cvtColor(plate_bgr, cv2.COLOR_BGR2HSV)
        mask_red1 = cv2.inRange(hsv, np.array([0, 85, 60]), np.array([10, 255, 255]))
        mask_red2 = cv2.inRange(hsv, np.array([170, 85, 60]), np.array([180, 255, 255]))
        total_pixels = float(plate_bgr.shape[0] * plate_bgr.shape[1])
        red_ratio = (
            np.count_nonzero(mask_red1 | mask_red2) / total_pixels
            if total_pixels > 0
            else 0.0
        )

        if red_ratio > 0.22 or (clean_text.startswith("R") and len(clean_text) == 8):
            return "REMOLQUE"
        return "TRACTORA"

    def send_to_backend(self, plate_text, plate_type, confidence):
        payload = {
            "plate": plate_text,
            "plate_type": plate_type,
            "confidence": round(confidence, 2),
            "camera_id": Config.CAMERA_ID,
        }

        headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
        }
        try:
            response = self.session.post(
                Config.BACKEND_URL, json=payload, headers=headers, timeout=2.5
            )
            if response.status_code in (200, 201):
                print(
                    f" -> [{Config.CAMERA_ID}] REGISTRADO [{plate_type}]: {plate_text} ({confidence:.2f})"
                )
            else:
                print(
                    f" -> [{Config.CAMERA_ID}] Respuesta HTTP {response.status_code} para {plate_text}"
                )
        except requests.RequestException as e:
            print(f" -> [{Config.CAMERA_ID}] Error enviando lectura {plate_text}: {e}")

    def enhance_image(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
        filtered = cv2.bilateralFilter(resized, d=11, sigmaColor=17, sigmaSpace=17)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(filtered)

    def _scan_plates(self, frame, search_bbox, render_data):
        vx1, vy1, vx2, vy2 = search_bbox
        crop = frame[vy1:vy2, vx1:vx2]
        if crop.size == 0:
            return

        crop_h, crop_w = crop.shape[:2]
        results_plates = self.plate_model(crop, verbose=False, conf=Config.CONF_PLATE)[
            0
        ]

        for plate_box in results_plates.boxes:
            px1, py1, px2, py2 = map(int, plate_box.xyxy[0])
            pw, ph = px2 - px1, py2 - py1
            if (
                pw < Config.MIN_PLATE_WIDTH
                or ph < 10
                or not (2.0 <= pw / float(ph) <= 6.0)
            ):
                continue

            abs_px1, abs_py1 = vx1 + px1, vy1 + py1
            abs_px2, abs_py2 = vx1 + px2, vy1 + py2
            abs_bbox = (abs_px1, abs_py1, abs_px2, abs_py2)

            if not self.plate_tracker.is_stable(abs_bbox):
                render_data.append({"type": "plate", "bbox": abs_bbox})
                render_data.append(
                    {
                        "type": "text",
                        "bbox": abs_bbox,
                        "text": "ESTABILIZANDO...",
                    }
                )
                continue

            plate_conf = float(plate_box.conf[0])
            pad_w, pad_h = int(pw * 0.12), int(ph * 0.05)
            c_y1, c_y2 = max(0, py1 - pad_h), min(crop_h, py2 + pad_h)
            c_x1, c_x2 = max(0, px1 - pad_w), min(crop_w, px2 + pad_w)

            plate_only_crop = crop[c_y1:c_y2, c_x1:c_x2]
            if plate_only_crop.size == 0 or self.is_blur(plate_only_crop):
                continue

            enhanced_plate = self.enhance_image(plate_only_crop)
            ocr_results = self.reader.ocr(enhanced_plate, cls=False)

            if ocr_results and ocr_results[0]:
                for line in ocr_results[0]:
                    text, prob = line[1][0], line[1][1]
                    clean_text = re.sub(r"[^A-Z0-9]", "", text.upper())

                    if (
                        self.is_plausible_plate(clean_text)
                        and prob >= Config.OCR_MIN_PROB
                    ):
                        plate_type = self.classify_plate_type(
                            plate_only_crop, clean_text
                        )
                        render_data.append(
                            {
                                "type": "plate_remolque"
                                if plate_type == "REMOLQUE"
                                else "plate",
                                "bbox": abs_bbox,
                            }
                        )
                        render_data.append(
                            {
                                "type": "text",
                                "bbox": abs_bbox,
                                "text": f"[{plate_type[:3]}] {clean_text} ({prob:.2f})",
                            }
                        )

                        combined_conf = prob * plate_conf
                        result = self.validator.add_read(
                            clean_text, combined_conf, plate_type
                        )

                        if result:
                            validated_plate, validated_type = result
                            threading.Thread(
                                target=self.send_to_backend,
                                args=(validated_plate, validated_type, float(prob)),
                                daemon=True,
                            ).start()

    def process_pipeline(self):
        while True:
            try:
                frame = self.frame_queue.get(timeout=1)
            except queue.Empty:
                continue

            render_data = []
            h, w = frame.shape[:2]

            if Config.ROI_BOX:
                rx1, ry1, rx2, ry2 = Config.ROI_BOX
                search_bbox = (max(0, rx1), max(0, ry1), min(w, rx2), min(h, ry2))
            else:
                search_bbox = (0, 0, w, h)

            self._scan_plates(frame, search_bbox, render_data)

            with self.detection_lock:
                self.current_detections = render_data

    def start(self):
        print(f"[SISTEMA - {Config.CAMERA_ID}] Iniciando pipeline directo...")
        threading.Thread(target=self.process_pipeline, daemon=True).start()

        try:
            sio.connect(
                Config.SOCKET_SERVER_URL,
                transports=["websocket"],
                wait_timeout=10,
            )
        except Exception as e:
            print(f"[ERROR STREAM - {Config.CAMERA_ID}] WebSocket: {e}")

        cap = CameraCapture(Config.VIDEO_SOURCE)
        reconnect_attempts = 0

        while True:
            if not cap.isOpened():
                reconnect_attempts += 1
                if reconnect_attempts > Config.RECONNECT_ATTEMPTS:
                    break
                time.sleep(Config.RECONNECT_DELAY)
                cap = CameraCapture(Config.VIDEO_SOURCE)
                continue

            ret, frame = cap.read()
            if not ret or frame is None:
                if cap.isOpened():
                    time.sleep(0.05)
                    continue
                reconnect_attempts += 1
                if reconnect_attempts > Config.RECONNECT_ATTEMPTS:
                    break
                cap.release()
                time.sleep(Config.RECONNECT_DELAY)
                cap = CameraCapture(Config.VIDEO_SOURCE)
                continue

            reconnect_attempts = 0

            if self.frame_queue.full():
                try:
                    self.frame_queue.get_nowait()
                except queue.Empty:
                    pass
            self.frame_queue.put(frame.copy())

            with self.detection_lock:
                render_data = list(self.current_detections)

            if Config.ROI_BOX:
                rx1, ry1, rx2, ry2 = Config.ROI_BOX
                cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), (255, 128, 0), 1)

            for item in render_data:
                x1, y1, x2, y2 = item["bbox"]
                if item["type"] == "plate":
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 200, 0), 2)
                elif item["type"] == "plate_remolque":
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                elif item["type"] == "text":
                    cv2.putText(
                        frame,
                        item["text"],
                        (x1, max(20, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (0, 255, 255),
                        2,
                    )

            recent = self.validator.get_recent_plates()
            hud_text = (
                f"REGISTRADAS: {', '.join(recent)}"
                if recent
                else "MODO REGISTRO: TRACTORA / REMOLQUE"
            )
            cv2.putText(
                frame,
                hud_text,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
            )

            now_stream = time.time()
            if sio.connected and (now_stream - self._last_stream_ts) >= 0.065:
                self._last_stream_ts = now_stream
                h, w = frame.shape[:2]
                target_w = 1280
                if w > target_w:
                    scale = target_w / float(w)
                    stream_frame = cv2.resize(
                        frame, (target_w, int(h * scale)), interpolation=cv2.INTER_AREA
                    )
                else:
                    stream_frame = frame

                ret_enc, encoded_image = cv2.imencode(
                    ".jpg", stream_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                )
                if ret_enc:
                    sio.emit(
                        "video_frame",
                        {"cam_id": Config.CAMERA_ID, "image": encoded_image.tobytes()},
                    )

            cv2.imshow(f"ALPR Registro - {Config.CAMERA_ID}", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

            time.sleep(0.03)

        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    app = ALPRLogisticsSystem()
    app.start()
