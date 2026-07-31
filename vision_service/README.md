# ALPR Pipeline: Ultra-Agile European License Plate Detector 🚘⚡

Este proyecto implementa un sistema de Reconocimiento Automático de Matrículas (ALPR) de dos etapas utilizando visión por computadora de última generación. Está optimizado para barreras de acceso, procesando el flujo de video en tiempo real, filtrando falsos positivos mediante algoritmos geométricos y ópticos, y enviando las lecturas validadas a un backend API REST.

## 🚀 Características Principales

*   **Pipeline de 2 Etapas (YOLOv8 + PaddleOCR):** Primero detecta el vehículo, luego localiza la matrícula dentro del recorte, y finalmente extrae el texto.
*   **Filtros de Calidad Óptica en Tiempo Real:**
    *   *Resolución:* Descarta detecciones lejanas o pequeñas (< 40x10 px).
    *   *Relación de Aspecto:* Verifica proporciones físicas de placas europeas (ratio entre 2.0 y 6.0).
    *   *Desenfoque por Movimiento:* Analiza la varianza de Laplacian para descartar frames borrosos antes del OCR.
*   **Validación Multinacional:** Acepta matrículas europeas genéricas (5-9 caracteres alfanuméricos) exigiendo siempre la presencia de letras y números para evitar alucinaciones.
*   **Envío Instantáneo con Cooldown:** Remite la placa validada en el Frame 1 y la bloquea en caché durante 10 segundos para evitar inundar el servidor (Debouncing).
*   **Arquitectura Multihilo:** Separa la captura y renderizado del frame (hilo principal) de la inferencia pesada de IA (hilo secundario), limitando el procesamiento a 2 FPS (500ms) para ahorrar recursos de hardware.

## 🛠️ Requisitos Previos

Asegúrate de tener Python 3.8+ y las siguientes dependencias instaladas en tu entorno virtual:

```bash
pip install opencv-python ultralytics paddleocr paddlepaddle requests
```
*(Nota: Si dispones de una GPU de NVIDIA compatible, instala `paddlepaddle-gpu` en lugar de `paddlepaddle` para máxima velocidad).*

### Modelos de IA Necesarios
El script requiere dos pesos de YOLO en el directorio raíz:
1.  `yolov8n.pt`: Modelo preentrenado de Ultralytics para detectar vehículos.
2.  `license_plate_detector.pt`: Modelo entrenado a medida para la detección de cajas delimitadoras de matrículas.

## ⚙️ Configuración

Las variables principales del entorno de producción se pueden ajustar en la cabecera del archivo `detector.py`:

```python
BACKEND_URL = "http://localhost:3000/api/v1/access" # Endpoint de tu API
CAMERA_ID = "BARRERA_ACCESO_01"                       # Identificador para logs multisucursal
COOLDOWN_SECONDS = 10                                 # Tiempo de bloqueo por vehículo
```

## 🧠 Flujo de Procesamiento de la Imagen (CLAHE)

Antes de pasar la imagen por PaddleOCR, el sistema aplica técnicas clásicas de OpenCV para potenciar el contraste de los caracteres, incluso de noche o con contraluz:
1. Conversión a escala de grises.
2. Escalado `fx=2, fy=2` (Interpolación Lanczos4).
3. `bilateralFilter` para reducir el ruido manteniendo los bordes afilados.
4. Ecualización adaptativa de histograma (`CLAHE`).

## 💻 Uso

Para arrancar el nodo de visión, simplemente ejecuta:

```bash
python detector.py
```

El sistema abrirá una ventana de monitorización (Live Monitor) donde dibujará:
*   **Verde:** Cajas delimitadoras de vehículos (Coches, Motos, Camiones, Autobuses).
*   **Rojo:** Cajas delimitadoras de la matrícula.
*   **Amarillo:** Texto final extraído vía OCR sobre la placa.

Para detener el proceso de forma segura y liberar la cámara, presiona la tecla **`q`** sobre la ventana de previsualización.