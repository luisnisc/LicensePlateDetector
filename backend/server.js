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

const checkPlateStmt = db.prepare('SELECT plate FROM whitelist WHERE plate = ?');
const insertLogStmt = db.prepare('INSERT INTO access_logs (plate, confidence, camera_id, status) VALUES (?, ?, ?, ?)');
const insertPlateStmt = db.prepare('INSERT OR IGNORE INTO whitelist (plate) VALUES (?)');
const deletePlateStmt = db.prepare('DELETE FROM whitelist WHERE plate = ?');
const getAllPlatesStmt = db.prepare('SELECT plate, added_at FROM whitelist');
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

    const isWhitelisted = checkPlateStmt.get(plate);
    const status = isWhitelisted ? 'ALLOWED' : 'DENIED';

    if (isWhitelisted) {
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

    console.log(`[ACCESO ${status}] Matrícula: ${plate}`);
    return res.status(isWhitelisted ? 200 : 403).json({ status, plate });
});

function triggerRelayHardware() {}

app.get('/api/v1/whitelist', (req, res) => res.status(200).json(getAllPlatesStmt.all()));

app.post('/api/v1/whitelist', (req, res) => {
    const { plate } = req.body;
    
    if (!plate || !/^[A-Z0-9]{4,9}$/.test(plate)) {
        return res.status(400).json({ error: 'Formato inválido. Debe contener entre 4 y 9 caracteres.' });
    }

    const info = insertPlateStmt.run(plate);
    if (info.changes > 0) {
        io.emit('plate_added', { plate });
        res.status(201).json({ message: 'Matrícula añadida', plate });
    } else {
        res.status(409).json({ error: 'La matrícula ya existe' });
    }
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