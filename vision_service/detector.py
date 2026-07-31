import cv2
import re
import requests
import threading
import time
from ultralytics import YOLO
from paddleocr import PaddleOCR
import logging

BACKEND_URL = "http://localhost:3000/api/v1/access"
CAMERA_ID = "BARRERA_ACCESO_01"
COOLDOWN_SECONDS = 10

processed_plates = {}

vehicle_model = YOLO('yolov8n.pt')
plate_model = YOLO('license_plate_detector.pt')

logging.getLogger('ppocr').setLevel(logging.ERROR)
reader = PaddleOCR(use_angle_cls=False, lang='en', use_gpu=True, show_log=False)

latest_frame = None
frame_lock = threading.Lock()
current_detections = []
detection_lock = threading.Lock()

def is_blur(image, threshold=60.0):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold, variance

def is_valid_european_plate(text):
    if not (5 <= len(text) <= 9):
        return False

    has_letter = bool(re.search(r'[A-Z]', text))
    has_number = bool(re.search(r'[0-9]', text))

    if not (has_letter and has_number):
        return False

    if len(set(text)) == 1:
        return False

    return True

def send_to_backend(plate_text, confidence):
    payload = {
        "plate": plate_text,
        "confidence": round(confidence, 2),
        "camera_id": CAMERA_ID
    }
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

    while True:
        with frame_lock:
            if latest_frame is None:
                frame_to_process = None
            else:
                frame_to_process = latest_frame.copy()

        if frame_to_process is None:
            time.sleep(0.05)
            continue

        clean_expired_cache()
        frame_render_data = []

        results_vehicles = vehicle_model(frame_to_process, verbose=False, conf=0.5, classes=[2, 3, 5, 7])[0]

        for vehicle_box in results_vehicles.boxes:
            vx1, vy1, vx2, vy2 = map(int, vehicle_box.xyxy[0])
            frame_render_data.append({"type": "vehicle", "bbox": (vx1, vy1, vx2, vy2)})

            car_crop = frame_to_process[vy1:vy2, vx1:vx2]
            if car_crop.size == 0:
                continue

            car_h, car_w = car_crop.shape[:2]
            results_plates = plate_model(car_crop, verbose=False, conf=0.35)[0]

            for plate_box in results_plates.boxes:
                px1, py1, px2, py2 = map(int, plate_box.xyxy[0])
                pw = px2 - px1
                ph = py2 - py1

                if pw < 40 or ph < 10:
                    continue

                aspect_ratio = pw / float(ph)
                if aspect_ratio < 2.0 or aspect_ratio > 6.0:
                    continue

                abs_px1, abs_py1 = vx1 + px1, vy1 + py1
                abs_px2, abs_py2 = vx1 + px2, vy1 + py2
                frame_render_data.append({"type": "plate", "bbox": (abs_px1, abs_py1, abs_px2, abs_py2)})

                pad_w, pad_h = int(pw * 0.05), int(ph * 0.05)
                c_y1, c_y2 = max(0, py1 - pad_h), min(car_h, py2 + pad_h)
                c_x1, c_x2 = max(0, px1 - pad_w), min(car_w, px2 + pad_w)

                plate_only_crop = car_crop[c_y1:c_y2, c_x1:c_x2]
                if plate_only_crop.size == 0:
                    continue

                blur_flag, sharpness_val = is_blur(plate_only_crop, threshold=60.0)
                if blur_flag:
                    continue

                gray_plate = cv2.cvtColor(plate_only_crop, cv2.COLOR_BGR2GRAY)
                gray_plate = cv2.resize(gray_plate, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
                filtered_plate = cv2.bilateralFilter(gray_plate, d=11, sigmaColor=17, sigmaSpace=17)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced_plate = clahe.apply(filtered_plate)

                cv2.imwrite("debug_car_crop.jpg", car_crop)
                cv2.imwrite("debug_plate_only.jpg", plate_only_crop)
                cv2.imwrite("debug_plate_final.jpg", enhanced_plate)

                ocr_results = reader.ocr(enhanced_plate, cls=False)

                if ocr_results and ocr_results[0]:
                    for line in ocr_results[0]:
                        text = line[1][0]
                        prob = line[1][1]

                        clean_text = re.sub(r'[^A-Z0-9]', '', text.upper())

                        if is_valid_european_plate(clean_text) and prob >= 0.75:

                            frame_render_data.append({
                                "type": "text",
                                "bbox": (abs_px1, abs_py1, abs_px2, abs_py2),
                                "text": f"{clean_text} ({prob:.2f}) ⚡"
                            })

                            current_time = time.time()
                            if clean_text in processed_plates and (current_time - processed_plates[clean_text]) < COOLDOWN_SECONDS:
                                continue

                            print(f"\n========================================")
                            print(f"[ACCESO INSTANTÁNEO] MATRÍCULA: {clean_text} (OCR: {prob:.2f} | Nitidez: {sharpness_val:.1f})")
                            print(f"========================================\n")

                            processed_plates[clean_text] = current_time
                            threading.Thread(target=send_to_backend, args=(clean_text, float(prob)), daemon=True).start()
                            break

        with detection_lock:
            current_detections = frame_render_data

        time.sleep(1)

def main():
    global latest_frame, current_detections
    cap = cv2.VideoCapture(0)

    print("\n[SISTEMA LISTO] Inferencia ultra-ágil activa (Envío instantáneo con control de calidad).")
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

        cv2.putText(frame, "ALPR Pipeline (Filtros de Calidad)", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Control de Barrera", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
