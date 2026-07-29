import cv2
from ultralytics import YOLO

# 1. Cargar modelo preentrenado (se descarga solo la primera vez)
model = YOLO("yolov8n.pt")

# 2. Abrir la webcam (0 suele ser la cámara integrada)
cap = cv2.VideoCapture(0)

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # 3. Pasar la imagen al modelo
    results = model(frame)

    # 4. Dibujar los resultados sobre la imagen
    annotated_frame = results[0].plot()

    # 5. Mostrar en ventana
    cv2.imshow("Deteccion en Tiempo Real", annotated_frame)

    # Salir si se pulsa la tecla 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
