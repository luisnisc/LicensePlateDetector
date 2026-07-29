const express = require('express');
const app = express();
app.use(express.json());

const WHITELIST = new Set(['1234ABC', '5678XYZ', '9999BBB', '3456CXT', '5730LNP', '7750HTW']);

const lastAccessLog = new Map();
const COOLDOWN_MS = 10000;

app.post('/api/v1/access', (req, res) => {
    const { plate, confidence, camera_id } = req.body;

    if (!plate) {
        return res.status(400).json({ error: 'Matrícula no proporcionada' });
    }

    const now = Date.now();
    const lastTime = lastAccessLog.get(plate) || 0;

    if (now - lastTime < COOLDOWN_MS) {
        console.log(`[DEBOUNCE] Matrícula ${plate} detectada de nuevo. Ignorando.`);
        return res.status(429).json({ status: 'IGNORED', message: 'Cooldown activo' });
    }

    if (WHITELIST.has(plate)) {
        lastAccessLog.set(plate, now);

        triggerRelayHardware();

        console.log(`\n========================================`);
        console.log(`[ACCESO CONCEDIDO] Matrícula: ${plate} (Confianza: ${confidence})`);
        console.log(`[BARRERA] Enviando señal de apertura desde Cámara ${camera_id}...`);
        console.log(`========================================\n`);

        return res.status(200).json({ status: 'ALLOWED', plate });
    } else {
        console.log(`[ACCESO DENEGADO] Matrícula no autorizada: ${plate}`);
        return res.status(403).json({ status: 'DENIED', plate });
    }
});

function triggerRelayHardware() {
  console.log("Abriendo puerta")
}

app.listen(3000, () => {
    console.log('Backend escuchando en http://localhost:3000');
});
