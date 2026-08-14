import cv2
import re
import time
import queue
import logging
import threading
import numpy as np
import requests
import os
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from collections import Counter
from dataclasses import dataclass
from ultralytics import YOLO
from paddleocr import PaddleOCR
from flask import Flask, Response
from waitress import serve


@dataclass
class Config:
    BACKEND_URL: str = "http://localhost:3000/api/v1/access"
    CAMERA_ID: str = "BARRERA_ACCESO_01"
    VIDEO_SOURCE = 0

    CONF_VEHICLE: float = 0.50
    CONF_PLATE: float = 0.40
    OCR_MIN_PROB: float = 0.70

    BLUR_THRESHOLD: float = 60.0
    MIN_PLATE_WIDTH: int = 20

    REQUIRED_MATCHES: int = 4
    MAX_ATTEMPTS: int = 6
    COOLDOWN_SECONDS: int = 5
    DENIED_COOLDOWN_SECONDS: int = 8

    CHAR_VOTE_MIN_AGREEMENT: float = 0.6
    PLATE_REGEX: str = None
    ROI_BOX = None

    STABILITY_FRAMES: int = 5
    STABILITY_MOVEMENT_PX: int = 15

    RECONNECT_ATTEMPTS: int = 10
    RECONNECT_DELAY: float = 2.0

    STREAM_PORT: int = 5000

logging.getLogger('ppocr').setLevel(logging.ERROR)

load_dotenv()

API_TOKEN = os.getenv("LPR_API_TOKEN")

flask_app = Flask(__name__)
output_frame = None
frame_lock = threading.Lock()

@flask_app.route('/video_feed')
def video_feed():
    def generate():
        global output_frame, frame_lock
        while True:
            with frame_lock:
                if output_frame is None:
                    time.sleep(0.1)
                    continue
                frame_copy = output_frame.copy()

            small_frame = cv2.resize(frame_copy, (640, 360))
            ret, encoded_image = cv2.imencode('.jpg', small_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])

            if not ret:
                continue

            frame_bytes = encoded_image.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

            time.sleep(0.1)

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


class PlateValidator:
    def __init__(self):
        self.reads = []
        self.locked_plate = None
        self.lock_timestamp = 0
        self.denied_plate = None
        self.denied_timestamp = 0
        self.mutex = threading.Lock()

    def add_read(self, plate_text, confidence):
        with self.mutex:
            if self._is_locked_internal(): return None
            self.reads.append((plate_text, confidence))
            raw_texts = [r[0] for r in self.reads]
            valid_texts = [t for t in raw_texts if not any((t != o and t in o) for o in raw_texts)]
            candidate = None
            if len(valid_texts) >= Config.REQUIRED_MATCHES:
                counts = Counter(valid_texts)
                most_common_text, frequency = counts.most_common(1)[0]
                if frequency >= Config.REQUIRED_MATCHES:
                    candidate = most_common_text
            if candidate is None and len(self.reads) >= Config.MAX_ATTEMPTS:
                candidate = self._character_vote_internal()
            if candidate:
                if self._is_recently_denied_internal(candidate):
                    self.reads.clear()
                    return None
                self.locked_plate = candidate
                self.lock_timestamp = time.time()
                self.reads.clear()
                return candidate
            if len(self.reads) >= Config.MAX_ATTEMPTS:
                self.reads.pop(0)
            return None

    def _character_vote_internal(self):
        if not self.reads: return None
        lengths = Counter(len(t) for t, _ in self.reads)
        common_length, len_count = lengths.most_common(1)[0]
        if len_count < Config.REQUIRED_MATCHES: return None
        candidates = [(t, c) for t, c in self.reads if len(t) == common_length]
        reconstructed = []
        for i in range(common_length):
            weighted_votes = {}
            for text, conf in candidates:
                ch = text[i]
                weighted_votes[ch] = weighted_votes.get(ch, 0.0) + conf
            best_char = max(weighted_votes, key=weighted_votes.get)
            if (weighted_votes[best_char] / sum(weighted_votes.values())) < Config.CHAR_VOTE_MIN_AGREEMENT:
                return None
            reconstructed.append(best_char)
        return "".join(reconstructed)

    def mark_denied(self, plate_text):
        with self.mutex:
            self.denied_plate = plate_text
            self.denied_timestamp = time.time()
            self.locked_plate = None
            self.reads.clear()

    def unlock(self):
        with self.mutex:
            self.locked_plate = None
            self.reads.clear()

    def _is_recently_denied_internal(self, plate_text):
        if self.denied_plate == plate_text:
            if (time.time() - self.denied_timestamp) < Config.DENIED_COOLDOWN_SECONDS:
                return True
            self.denied_plate = None
        return False

    def _is_locked_internal(self):
        if self.locked_plate:
            if (time.time() - self.lock_timestamp) < Config.COOLDOWN_SECONDS:
                return True
            self.locked_plate = None
        return False

    def is_locked(self):
        with self.mutex: return self._is_locked_internal()

    def get_locked_plate(self):
        with self.mutex: return self.locked_plate


class ALPRSystem:
    def __init__(self):
        print("[SISTEMA] Inicializando tensores y modelos en GPU...")
        self.vehicle_model = YOLO('yolov8n.pt')
        self.plate_model = YOLO('license_plate_detector.pt')
        self.reader = PaddleOCR(use_angle_cls=False, lang='en', use_gpu=True, show_log=False)

        self.validator = PlateValidator()
        self.current_detections = []
        self.detection_lock = threading.Lock()
        self.frame_queue = queue.Queue(maxsize=3)

        self.last_centroid = None
        self.stable_count = 0

        self.session = requests.Session()
        retries = Retry(total=2, backoff_factor=0.3, status_forcelist=[500, 502, 503, 504])
        self.session.mount("http://", HTTPAdapter(max_retries=retries))
        self.session.mount("https://", HTTPAdapter(max_retries=retries))

        self._warmup()

    def _warmup(self):
        print("[SISTEMA] Calentando modelos...")
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self.vehicle_model(dummy, verbose=False)
        self.plate_model(dummy, verbose=False)

    def is_blur(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        return variance < Config.BLUR_THRESHOLD, variance

    def is_plausible_plate(self, text):
        if not (4 <= len(text) <= 10): return False
        if len(set(text)) == 1: return False
        if Config.PLATE_REGEX and not re.fullmatch(Config.PLATE_REGEX, text): return False
        return True

    def _point_in_roi(self, x, y):
        if not Config.ROI_BOX: return True
        rx1, ry1, rx2, ry2 = Config.ROI_BOX
        return rx1 <= x <= rx2 and ry1 <= y <= ry2

    def send_to_backend(self, plate_text, confidence):
        payload = {
            "plate": plate_text,
            "confidence": round(confidence, 2),
            "camera_id": Config.CAMERA_ID
        }

        headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json"
            }
        try:
            response = self.session.post(Config.BACKEND_URL, json=payload, headers=headers, timeout=2.5)
            if response.status_code in (200, 201):
                print(f" -> [API HTTP {response.status_code}] Acceso AUTORIZADO: {plate_text}")
            elif response.status_code in (401, 403, 404):
                print(f" -> [API HTTP {response.status_code}] DENEGADO: {plate_text}.")
                self.validator.mark_denied(plate_text)
            else:
                self.validator.unlock()
        except requests.RequestException:
            self.validator.unlock()

    def enhance_image(self, image):
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
        filtered = cv2.bilateralFilter(resized, d=11, sigmaColor=17, sigmaSpace=17)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(filtered)

    def _select_target_vehicle(self, results_vehicles, render_data):
        boxes_in_roi = []
        for vb in results_vehicles.boxes:
            vx1, vy1, vx2, vy2 = map(int, vb.xyxy[0])
            cx, cy = (vx1 + vx2) // 2, (vy1 + vy2) // 2
            if not self._point_in_roi(cx, cy):
                render_data.append({"type": "vehicle_ignored", "bbox": (vx1, vy1, vx2, vy2)})
                continue
            boxes_in_roi.append((vx1, vy1, vx2, vy2))
            render_data.append({"type": "vehicle", "bbox": (vx1, vy1, vx2, vy2)})

        if not boxes_in_roi: return None
        return max(boxes_in_roi, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))

    def _update_stability(self, bbox):
        centroid = ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
        if self.last_centroid is not None:
            dx = abs(centroid[0] - self.last_centroid[0])
            dy = abs(centroid[1] - self.last_centroid[1])
            if dx <= Config.STABILITY_MOVEMENT_PX and dy <= Config.STABILITY_MOVEMENT_PX:
                self.stable_count += 1
            else:
                self.stable_count = 0
        self.last_centroid = centroid

    def _scan_plate(self, frame, vehicle_bbox, render_data):
        vx1, vy1, vx2, vy2 = vehicle_bbox
        car_crop = frame[vy1:vy2, vx1:vx2]
        if car_crop.size == 0: return

        car_h, car_w = car_crop.shape[:2]
        results_plates = self.plate_model(car_crop, verbose=False, conf=Config.CONF_PLATE)[0]

        for plate_box in results_plates.boxes:
            px1, py1, px2, py2 = map(int, plate_box.xyxy[0])
            pw, ph = px2 - px1, py2 - py1
            if pw < Config.MIN_PLATE_WIDTH or ph < 10 or not (2.0 <= pw / float(ph) <= 6.0): continue

            plate_conf = float(plate_box.conf[0])
            abs_px1, abs_py1 = vx1 + px1, vy1 + py1
            abs_px2, abs_py2 = vx1 + px2, vy1 + py2
            render_data.append({"type": "plate", "bbox": (abs_px1, abs_py1, abs_px2, abs_py2)})

            pad_w, pad_h = int(pw * 0.12), int(ph * 0.05)
            c_y1, c_y2 = max(0, py1 - pad_h), min(car_h, py2 + pad_h)
            c_x1, c_x2 = max(0, px1 - pad_w), min(car_w, px2 + pad_w)

            plate_only_crop = car_crop[c_y1:c_y2, c_x1:c_x2]
            if plate_only_crop.size == 0: continue

            blur_flag, _ = self.is_blur(plate_only_crop)
            if blur_flag: continue

            enhanced_plate = self.enhance_image(plate_only_crop)
            ocr_results = self.reader.ocr(enhanced_plate, cls=False)

            if ocr_results and ocr_results[0]:
                for line in ocr_results[0]:
                    text, prob = line[1][0], line[1][1]
                    clean_text = re.sub(r'[^A-Z0-9]', '', text.upper())

                    if self.is_plausible_plate(clean_text) and prob >= Config.OCR_MIN_PROB:
                        render_data.append({
                            "type": "text",
                            "bbox": (abs_px1, abs_py1, abs_px2, abs_py2),
                            "text": f"{clean_text} ({prob:.2f})"
                        })
                        combined_conf = prob * plate_conf
                        validated_plate = self.validator.add_read(clean_text, combined_conf)

                        if validated_plate:
                            threading.Thread(
                                target=self.send_to_backend,
                                args=(validated_plate, float(prob)),
                                daemon=True
                            ).start()

    def process_pipeline(self):
        while True:
            try:
                frame = self.frame_queue.get(timeout=1)
            except queue.Empty:
                continue

            render_data = []
            results_vehicles = self.vehicle_model(frame, verbose=False, conf=Config.CONF_VEHICLE, classes=[2, 3, 5, 7])[0]
            target_vehicle = self._select_target_vehicle(results_vehicles, render_data)

            if target_vehicle is None:
                self.stable_count = 0
                self.last_centroid = None
                with self.detection_lock:
                    self.current_detections = render_data
                continue

            self._update_stability(target_vehicle)
            locked = self.validator.is_locked()

            if locked:
                render_data.append({
                    "type": "text", "bbox": target_vehicle,
                    "text": f"PROCESADO: {self.validator.get_locked_plate()}"
                })
            elif self.stable_count < Config.STABILITY_FRAMES:
                render_data.append({
                    "type": "text", "bbox": target_vehicle, "text": "ESPERANDO ESTABILIZACION..."
                })
            else:
                self._scan_plate(frame, target_vehicle, render_data)

            with self.detection_lock:
                self.current_detections = render_data

    def _open_capture(self):
        return cv2.VideoCapture(Config.VIDEO_SOURCE)

    def start(self):
        global output_frame, frame_lock
        print("[SISTEMA] Iniciando pipeline Productor-Consumidor...")
        threading.Thread(target=self.process_pipeline, daemon=True).start()

        threading.Thread(
            target=lambda: serve(flask_app, host='0.0.0.0', port=Config.STREAM_PORT, threads=4),
            daemon=True
        ).start()
        print(f"[STREAM] Emisión Web activa en: http://localhost:{Config.STREAM_PORT}/video_feed")

        cap = self._open_capture()
        reconnect_attempts = 0

        while True:
            if not cap.isOpened():
                reconnect_attempts += 1
                if reconnect_attempts > Config.RECONNECT_ATTEMPTS: break
                time.sleep(Config.RECONNECT_DELAY)
                cap = self._open_capture()
                continue

            ret, frame = cap.read()
            if not ret:
                reconnect_attempts += 1
                if reconnect_attempts > Config.RECONNECT_ATTEMPTS: break
                cap.release()
                time.sleep(Config.RECONNECT_DELAY)
                cap = self._open_capture()
                continue

            reconnect_attempts = 0

            # Optimización de cola
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
                if item["type"] == "vehicle":
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                elif item["type"] == "vehicle_ignored":
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (128, 128, 128), 1)
                elif item["type"] == "plate":
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                elif item["type"] == "text":
                    color = (0, 255, 255) if "PROCESADO" in item["text"] else (0, 165, 255) if "ESPERANDO" in item["text"] else (255, 255, 0)
                    cv2.putText(frame, item["text"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            is_sys_locked = self.validator.is_locked()
            status_text = "ESTADO: BARRERA ABIERTA (ESPERANDO)" if is_sys_locked else "ESTADO: ESCANEANDO MATRICULAS"
            status_color = (0, 0, 255) if is_sys_locked else (0, 255, 0)
            cv2.putText(frame, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)

            with frame_lock:
                output_frame = frame.copy()

            # cv2.imshow("Sistema ALPR - Control de Acceso", frame)
            # if cv2.waitKey(1) & 0xFF == ord('q'):
            #     break

        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    app = ALPRSystem()
    app.start()
