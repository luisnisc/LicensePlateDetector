# ALPR Backend: Servidor Node.js + WebSockets ⚙️

Este es el núcleo lógico del sistema de Reconocimiento Automático de Matrículas (ALPR). Desarrollado en Node.js y Express, actúa como puente de comunicación en tiempo real entre el nodo de visión artificial (Python) y el panel de control web (React).

## 🚀 Características Principales

*   **Base de Datos Ligera y Rápida:** Utiliza `better-sqlite3` para gestionar las tablas de `whitelist` (matrículas autorizadas) y `access_logs` (registro histórico) de forma síncrona y sin latencia.
*   **WebSockets en Tiempo Real:** Integración nativa con `socket.io`. Emite eventos instantáneos (`new_log`, `plate_added`, `plate_removed`, `logs_cleared`) a todos los clientes conectados para mantener la UI sincronizada sin necesidad de recargar (sin *polling*).
*   **Sistema Anti-Spam (Debounce):** Implementa una caché en memoria mediante `Map` con 10 segundos de *cooldown*. Evita que múltiples lecturas consecutivas del mismo vehículo inunden la base de datos de accesos.
*   **Control de Hardware (Relés):** Incluye la función estructurada `triggerRelayHardware()` diseñada para integrarse con controladores GPIO y accionar la apertura mecánica de la barrera al registrar un estado "ALLOWED".
*   **Topología de Red Abierta (CORS dinámico):** Configurado para aceptar peticiones desde cualquier origen (IP), permitiendo que la cámara, el servidor y los monitores web residan en máquinas o dispositivos móviles separados dentro de la misma red local.

## 🛠️ Stack Tecnológico

*   **Entorno:** Node.js
*   **Framework HTTP:** Express.js
*   **Sockets Bidireccionales:** Socket.io
*   **Persistencia:** SQLite3 (`better-sqlite3`)
*   **Middleware:** CORS

## 📦 Rutas API REST

### Control de Acceso (Para el Nodo de Visión)
*   `POST /api/v1/access`: Consumido por el script de Python. Recibe `plate`, `confidence` y `camera_id`. Comprueba la matrícula contra la DB, registra el log, emite por WebSocket y devuelve 200 (Permitido) o 403 (Denegado).

### Gestión de la Whitelist (Para el Panel Web)
*   `GET /api/v1/whitelist`: Retorna la lista completa de matrículas autorizadas.
*   `POST /api/v1/whitelist`: Registra una nueva matrícula validando el formato alfanumérico (4 a 9 caracteres). Evita duplicados.
*   `DELETE /api/v1/whitelist/:plate`: Elimina y revoca el acceso a la matrícula especificada.

### Gestión del Histórico (Logs)
*   `GET /api/v1/logs`: Retorna el registro de actividad ordenado de más reciente a más antiguo.
*   `DELETE /api/v1/logs`: Realiza un borrado masivo (TRUNCATE equivalente) de todos los registros del sistema.

## 🚀 Instalación y Despliegue

1. Instala las dependencias del servidor:
   ```bash
   npm install express better-sqlite3 cors socket.io
   ```

2. Arranca el servicio. Al iniciarse por primera vez, creará automáticamente el archivo de base de datos `access_control.sqlite`:
   ```bash
   node server.js
   ```

El servidor quedará a la escucha en el **puerto 3000**.