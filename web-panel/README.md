# ALPR Web Dashboard: Panel de Control de Accesos 🛡️

Interfaz de usuario en React diseñada para gestionar y monitorizar un sistema de Reconocimiento Automático de Matrículas (ALPR). Permite el control en vivo del flujo de vehículos, la administración de listas de acceso y la visualización de métricas de seguridad en tiempo real.

## 🚀 Características Principales

*   **Sincronización en Tiempo Real:** Integración bidireccional con WebSockets (`socket.io-client`). Múltiples operadores pueden tener el panel abierto y ver los cambios en la *whitelist* o los nuevos accesos instantáneamente sin recargar la página.
*   **Gestión de Whitelist Restrictiva:** Formulario de alta y baja de matrículas con validación preventiva (Regex). Exige el formato europeo estándar (5-9 caracteres, obligando al menos a una letra y un número) antes de enviar la petición al servidor.
*   **Live Monitor:** Registro de inferencias en vivo que muestra la matrícula, el nivel de confianza del OCR y el estado de acceso (Permitido/Denegado) con indicadores visuales claros.
*   **Estadísticas de Acceso (ApexCharts):** Generación dinámica de métricas sobre la relación de accesos permitidos frente a denegados, renderizadas en un gráfico *Donut* que se recalcula de forma reactiva (`useMemo`).
*   **UI/UX Reactiva y Oscura:** Construido con Tailwind CSS (estética Zinc/Dark mode) y alertas no intrusivas (*toast notifications*) mediante SweetAlert2.

## 🛠️ Stack Tecnológico

*   **Framework:** React 18+ (Hooks: `useState`, `useEffect`, `useMemo`).
*   **Estilos:** Tailwind CSS.
*   **Peticiones HTTP:** Axios.
*   **WebSockets:** Socket.io-client.
*   **Gráficos:** React ApexCharts.
*   **Alertas:** SweetAlert2.

## 📦 Instalación y Despliegue

1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```

2. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. **Nota sobre la Red Local:** Si deseas acceder al panel desde otro dispositivo en la misma red Wi-Fi/LAN (ej. desde un móvil o tablet), expón el host al arrancar:
   ```bash
   npm run dev -- --host
   ```

## ⚙️ Arquitectura de Comunicación

El panel resuelve automáticamente la dirección del backend basándose en el hostname del cliente que lo ejecuta:
```javascript
const API_URL = `http://${window.location.hostname}:3000`;
```
Esto permite que el dashboard funcione sin configuración adicional tanto en `localhost` como cuando es accedido mediante IPs de red local (ej. `http://192.168.1.50:5173`), apuntando siempre al puerto `3000` de la máquina host.

## 🔒 Control de Estado y Single Source of Truth

Para evitar desincronizaciones, las mutaciones de datos en la UI (añadir/borrar matrículas, limpiar logs) no alteran el estado local de React inmediatamente. La petición se envía al backend vía `axios` y el panel espera a que el servidor confirme el cambio y emita el evento correspondiente vía WebSocket (`plate_added`, `logs_cleared`) para actualizar el DOM. Esto garantiza una consistencia total de los datos.