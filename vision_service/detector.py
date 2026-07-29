import cv2
import re
import requests
import threading
import time
from ultralytics import YOLO
import easyocr

BACKEND_URL = "http://localhost:3000/api/v1/access"
CAMERA_ID = "BARRERA_ACCESO_01"
PLATE_REGEX = re.compile(r'\b\d{4}[B-DF-HJ-NP-TV-Z]{3}\b')
COOLDOWN_SECONDS = 10
processed_plates = {}

vehicle_model = YOLO('yolov8n.pt')
plate_model = YOLO('license_plate_detector.pt')
reader = easyocr.Reader(['es'], gpu=False)

latest_frame = None
frame_lock = threading.Lock()

current_detections = []
detection_lock = threading.Lock()

def send_to_backend(plate_text, confidence):
    payload = {"plate": plate_text, "confidence": round(confidence, 2), "camera_id": CAMERA_ID}
    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=2.0)
        print(f" -> [API HTTP {response.status_code}] Respuesta: {response.json()}")
    except Exception as e:
        print(f" -> [API ERROR] Fallo de conexión: {e}")
        if plate_text in processed_plates:
            del processed_plates[plate_text]

def clean_expired_cache():
    current_time = time.time()
    for plate in list(processed_plates.keys()):
        if current_time - processed_plates[plate] > COOLDOWN_SECONDS:
            del processed_plates[plate]

def ocr_worker():
    global latest_frame, current_detections
    last_car_count = 0
    allowed_chars = '0123456789BCDFGHJKLMNPRSTVWXYZ'

    while True:
        with frame_lock:
            if latest_frame is None:
                frame_to_process = None
            else:
                frame_to_process = latest_frame.copy()

        if frame_to_process is None:
            time.sleep(0.1)
            continue

        clean_expired_cache()
        frame_render_data = []

        results_vehicles = vehicle_model(frame_to_process, verbose=False, conf=0.5, classes=[2, 3, 5, 7])[0]

        current_car_count = len(results_vehicles.boxes)
        if current_car_count != last_car_count:
            if current_car_count > 0:
                print(f"[PIPELINE] -> Vehículo detectado. Ejecutando Etapa 2 (LPR)...")
            last_car_count = current_car_count

        for vehicle_box in results_vehicles.boxes:
            vx1, vy1, vx2, vy2 = map(int, vehicle_box.xyxy[0])
            frame_render_data.append({"type": "vehicle", "bbox": (vx1, vy1, vx2, vy2)})

            car_crop = frame_to_process[vy1:vy2, vx1:vx2]

            if car_crop.size == 0:
                continue

            results_plates = plate_model(car_crop, verbose=False, conf=0.2)[0]

            for plate_box in results_plates.boxes:
                px1, py1, px2, py2 = map(int, plate_box.xyxy[0])

                abs_px1, abs_py1 = vx1 + px1, vy1 + py1
                abs_px2, abs_py2 = vx1 + px2, vy1 + py2
                frame_render_data.append({"type": "plate", "bbox": (abs_px1, abs_py1, abs_px2, abs_py2)})

                plate_only_crop = car_crop[py1:py2 + 4, px1:px2 + 43]

                cv2.imwrite("debug_plate_only.jpg", plate_only_crop)
                cv2.imwrite("debug_car_crop.jpg", car_crop)

                if plate_only_crop.size == 0:
                    continue

                gray_plate = cv2.cvtColor(plate_only_crop, cv2.COLOR_BGR2GRAY)
                gray_plate = cv2.resize(gray_plate, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
                filtered_plate = cv2.bilateralFilter(gray_plate, d=11, sigmaColor=17, sigmaSpace=17)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced_plate = clahe.apply(filtered_plate)

                binary_plate = cv2.adaptiveThreshold(
                    enhanced_plate, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY,
                    11, 2
                )

                cv2.imwrite("debug_gray_plate.jpg", binary_plate)

                ocr_results = reader.readtext(binary_plate, allowlist=allowed_chars)

                for bbox, text, prob in ocr_results:
                    clean_text = re.sub(r'[^A-Z0-9]', '', text.upper())

                    if len(clean_text) < 4:
                        continue

                    if PLATE_REGEX.match(clean_text) and prob > 0.35:
                        frame_render_data.append({
                            "type": "text",
                            "bbox": (abs_px1, abs_py1, abs_px2, abs_py2),
                            "text": f"{clean_text} ({prob:.2f})"
                        })

                        current_time = time.time()
                        if clean_text in processed_plates:
                            if (current_time - processed_plates[clean_text]) < COOLDOWN_SECONDS:
                                continue

                        print(f"\n========================================")
                        print(f"[ACCESO VERIFICADO] MATRÍCULA: {clean_text} (OCR: {prob:.2f})")
                        print(f"========================================\n")

                        processed_plates[clean_text] = current_time
                        threading.Thread(target=send_to_backend, args=(clean_text, float(prob)), daemon=True).start()
                        break

        with detection_lock:
            current_detections = frame_render_data

        time.sleep(0.3)

def main():
    global latest_frame, current_detections
    cap = cv2.VideoCapture(0)

    print("\n[SISTEMA LISTO] Inferencia local activa con renderizado en tiempo real.")
    threading.Thread(target=ocr_worker, daemon=True).start()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        with frame_lock:
            latest_frame = frame

        with detection_lock:
            render_data = list(current_detections)

        for item in render_data:
            x1, y1, x2, y2 = item["bbox"]
            if item["type"] == "vehicle":
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            elif item["type"] == "plate":
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            elif item["type"] == "text":
                cv2.putText(frame, item["text"], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

        cv2.putText(frame, "ALPR Pipeline (2 Etapas)", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Control de Barrera", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
