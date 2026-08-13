const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log(`[SOCKET] Cliente conectado: ${socket.id}`);
});

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true
}));

app.use(express.json());

const db = new Database('access_control.sqlite');

db.exec(`
    CREATE TABLE IF NOT EXISTS whitelist (
        plate TEXT PRIMARY KEY,
        owner_name TEXT NOT NULL,
        valid_until DATETIME,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate TEXT,
        confidence REAL,
        camera_id TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

const checkPlateStmt = db.prepare(`
    SELECT plate, owner_name
    FROM whitelist
    WHERE plate = ?
      AND (valid_until IS NULL OR datetime(valid_until) > datetime('now'))
`);
const insertLogStmt = db.prepare('INSERT INTO access_logs (plate, confidence, camera_id, status) VALUES (?, ?, ?, ?)');

const insertPlateStmt = db.prepare(`
    INSERT INTO whitelist (plate, owner_name, valid_until)
    VALUES (?, ?, ?)
    ON CONFLICT(plate) DO UPDATE SET
        owner_name = excluded.owner_name,
        valid_until = excluded.valid_until
`);
const deletePlateStmt = db.prepare('DELETE FROM whitelist WHERE plate = ?');
const getAllPlatesStmt = db.prepare('SELECT plate, owner_name, valid_until, added_at FROM whitelist ORDER BY added_at DESC');
const getAllLogsStmt = db.prepare('SELECT * FROM access_logs ORDER BY id DESC');
const cleanLogsStmt = db.prepare('DELETE FROM access_logs');

const lastAccessLog = new Map();
const COOLDOWN_MS = 10000;

app.post('/api/v1/access', (req, res) => {
    const { plate, confidence, camera_id } = req.body;

    if (!plate) return res.status(400).json({ error: 'Matrícula no proporcionada' });

    const now = Date.now();
    const lastTime = lastAccessLog.get(plate) || 0;

    if (now - lastTime < COOLDOWN_MS) {
        console.log(`[DEBOUNCE] Matrícula ${plate} ignorada (Cooldown).`);
        return res.status(429).json({ status: 'IGNORED', message: 'Cooldown activo' });
    }

    const validRecord = checkPlateStmt.get(plate);
    const status = validRecord ? 'ALLOWED' : 'DENIED';

    if (validRecord) {
        lastAccessLog.set(plate, now);
        triggerRelayHardware();
    }

    const info = insertLogStmt.run(plate, confidence, camera_id, status);

    const newLog = {
        id: info.lastInsertRowid,
        plate,
        confidence,
        camera_id,
        status,
        timestamp: new Date().toISOString()
    };

    io.emit('new_log', newLog);

    console.log(`[ACCESO ${status}] Matrícula: ${plate} ${validRecord ? `(${validRecord.owner_name})` : ''}`);
    return res.status(validRecord ? 200 : 403).json({ status, plate });
});

function triggerRelayHardware() {}

app.get('/api/v1/whitelist', (req, res) => res.status(200).json(getAllPlatesStmt.all()));

app.post('/api/v1/whitelist', (req, res) => {
    const { plate, owner_name, valid_until } = req.body;

    if (!plate || !/^[A-Z0-9]{4,9}$/.test(plate)) {
        return res.status(400).json({ error: 'Formato de matrícula inválido.' });
    }
    if (!owner_name || owner_name.trim().length === 0) {
        return res.status(400).json({ error: 'El nombre del titular es obligatorio.' });
    }

    const expiryDate = valid_until ? new Date(valid_until).toISOString() : null;

    insertPlateStmt.run(plate, owner_name.trim(), expiryDate);

    const newPlateRecord = { plate, owner_name: owner_name.trim(), valid_until: expiryDate };

    io.emit('plate_added', newPlateRecord);
    res.status(201).json({ message: 'Matrícula guardada/actualizada', record: newPlateRecord });
});

app.delete('/api/v1/whitelist/:plate', (req, res) => {
    const info = deletePlateStmt.run(req.params.plate);
    if (info.changes > 0) {
        io.emit('plate_removed', { plate: req.params.plate });
        res.status(200).json({ message: 'Matrícula eliminada' });
    } else {
        res.status(404).json({ error: 'No encontrada' });
    }
});

app.get('/api/v1/logs', (req, res) => res.status(200).json(getAllLogsStmt.all()));

app.delete('/api/v1/logs', (req, res) => {
    try {
        const info = cleanLogsStmt.run();
        io.emit('logs_cleared');
        return res.status(200).json({ message: 'Logs eliminados correctamente', rowsDeleted: info.changes });
    } catch (error) {
        console.error('[DATABASE ERROR]', error);
        return res.status(500).json({ error: 'Error interno' });
    }
});

server.listen(3000, () => {
    console.log('Backend LPR activo en puerto 3000 con SQLite y WebSockets');
});
