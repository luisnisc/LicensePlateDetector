# Crea un archivo llamado download_weights.py y ejecútalo
import requests

# URL pública a un modelo YOLOv8n especializado en matrículas europeas
url = "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n-license-plate.pt"
filename = "eu_lpr_detector.pt"

print(f"Descargando modelo LPR especializado...")
response = requests.get(url, stream=True)
with open(filename, 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
print(f"Modelo descargado correctamente como '{filename}'")
