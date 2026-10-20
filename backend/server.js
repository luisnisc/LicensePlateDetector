const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'access_control.sqlite');
const db = new Database(dbPath);

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'clave-secreta-lpr'
const API_TOKEN = process.env.LPR_API_TOKEN || 'puL04ku10jfrSfVES22gBSYGAxZHsESIizgAqw2oGZQupLys5iWJ71hH27cI3eimeg3VS1vyDf';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token !== API_TOKEN) {
    console.warn(`[SEGURIDAD] Intento de acceso no autorizado desde IP: ${req.ip}`);
    return res.status(401).json({ error: 'No autorizado: Token inválido o ausente' });
  }
  next();
};

const authenticateHybrid = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  if (token === API_TOKEN) {
    req.user = { username: 'sistema_externo', role: 'admin' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión caducada, token JWT inválido o API_TOKEN incorrecto' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    console.warn(`[SEGURIDAD] Usuario '${req.user.username}' intentó una acción de administrador.`);
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
}

const app = express();
const server = createServer(app);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LPR Access Control API',
      version: '1.0.0',
      description: 'API REST para la gestión de control de acceso por matrículas (ALPR) y monitorización en tiempo real.',
    },
    servers: [
      { url: 'http://fsccv:3000', description: 'Servidor Producción' },
      { url: 'http://localhost:3000', description: 'Servidor Local' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT para el panel web. Requiere iniciar sesión.',
        },
        apiTokenAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'Token estático exclusivo para hardware. Enviar como: Bearer <TOKEN>',
        }
      }
    }
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Cliente conectado: ${socket.id}`);
  socket.on('video_frame', (data) => {
    if (data && data.cam_id && data.image) {
      socket.broadcast.emit(`video_frame_${data.cam_id}`, data.image);
    }
  });
});

app.use(cors({ origin: true, methods: ['GET', 'POST', 'DELETE'], credentials: true }));
app.use(express.json());

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
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'");
} catch (e) {
  // Ignorar si ya existe
}

const checkUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
if (!checkUserStmt.get('admin')) {
  const hash = bcrypt.hashSync('Filip@2807', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('[SISTEMA] Usuario por defecto creado: admin ');
}

const checkPlateStmt = db.prepare(`
    SELECT plate, owner_name FROM whitelist
    WHERE plate = ? AND (valid_until IS NULL OR datetime(valid_until) > datetime('now'))
`);
const insertLogStmt = db.prepare('INSERT INTO access_logs (plate, confidence, camera_id, status, timestamp) VALUES (?, ?, ?, ?, ?)');

const insertPlateStmt = db.prepare(`
    INSERT INTO whitelist (plate, owner_name, valid_until) VALUES (?, ?, ?)
    ON CONFLICT(plate) DO UPDATE SET owner_name = excluded.owner_name, valid_until = excluded.valid_until
`);
const deletePlateStmt = db.prepare('DELETE FROM whitelist WHERE plate = ?');
const getAllPlatesStmt = db.prepare('SELECT plate, owner_name, valid_until, added_at FROM whitelist ORDER BY added_at DESC');
const getAllLogsStmt = db.prepare('SELECT * FROM access_logs ORDER BY id DESC');
const cleanAllLogsStmt = db.prepare('DELETE FROM access_logs');
const cleanLogsByCameraStmt = db.prepare('DELETE FROM access_logs WHERE camera_id = ?');

const lastAccessLog = new Map();
const COOLDOWN_MS = 600000;


app.post('/api/v1/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || password === undefined || password === null) {
      return res.status(400).json({ error: 'El usuario y contraseña son obligatorios' });
    }

    const user = checkUserStmt.get(username);
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (bcrypt.compareSync(password, user.password)) {
      const tokenExpiresIn = user.role === 'admin' ? '8h' : '3650d';
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: tokenExpiresIn }
      );
      return res.json({ token, role: user.role });
    } else {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    console.error('[LOGIN FATAL ERROR]', error.message);
    return res.status(500).json({ error: 'Error interno del servidor en el login' });
  }
});


app.post('/api/v1/access', authenticateToken, (req, res) => {
  const { plate, confidence, camera_id } = req.body;

  if (!plate) return res.status(400).json({ error: 'Matrícula no proporcionada' });
  if (!camera_id) return res.status(400).json({ error: 'Origen (camera_id) no proporcionado' });

  if (!/\d/.test(plate)) {
    console.log(`[ALERTA OCR] Descartada lectura sin números: ${plate}`);
    return res.status(400).json({ error: 'Lectura inválida: carece de números' });
  }

  const now = Date.now();
  const debounceKey = plate;
  const lastTime = lastAccessLog.get(debounceKey) || 0;

  if (now - lastTime < COOLDOWN_MS) {
    console.log(`[DEBOUNCE GLOBAL] Matrícula ${plate} ignorada en ${camera_id} (Cooldown cruzado activo).`);
    return res.status(429).json({ status: 'IGNORED', message: `Cooldown global activo para esta matrícula a ${now}` });

  }

  const validRecord = checkPlateStmt.get(plate);
  const status = validRecord ? 'PERMITIDO' : 'DENEGADO';
  const timestamp = new Date().toISOString();

  lastAccessLog.set(debounceKey, now);

  if (validRecord) {
    triggerRelayHardware(camera_id);
  }

  const info = insertLogStmt.run(plate, confidence, camera_id, status, timestamp);
  const newLog = { id: info.lastInsertRowid, plate, confidence, camera_id, status, timestamp };

  io.emit('new_log', newLog);
  console.log(`[ACCESO ${status}] Matrícula: ${plate} en ${camera_id} ${validRecord ? `(${validRecord.owner_name})` : ''} a ${now}`);

  return res.status(validRecord ? 200 : 403).json({ status, plate, camera_id });
});

function triggerRelayHardware(cameraId) {
  if (cameraId === 'BARRERA_ACCESO_01') {
    console.log('[HARDWARE] 🟢 Abriendo barrera de ENTRADA');
  } else if (cameraId === 'BARRERA_SALIDA_01') {
    console.log('[HARDWARE] 🔴 Abriendo barrera de SALIDA');
  } else {
    console.warn(`[HARDWARE] ⚠️ Origen desconocido: ${cameraId}. No se accionó ningún relé.`);
  }
}


app.get('/api/v1/whitelist', authenticateHybrid, (req, res) => res.status(200).json(getAllPlatesStmt.all()));

app.post('/api/v1/whitelist', authenticateHybrid, requireAdmin, (req, res) => {
  const { plate, owner_name, valid_until } = req.body;

  if (!plate || !/^[A-Z0-9]{4,10}$/.test(plate) || !/\d/.test(plate)) {
    return res.status(400).json({ error: 'Formato inválido. Debe ser alfanumérico y contener números.' });
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

app.delete('/api/v1/whitelist/:plate', authenticateHybrid, requireAdmin, (req, res) => {
  const info = deletePlateStmt.run(req.params.plate);
  if (info.changes > 0) {
    io.emit('plate_removed', { plate: req.params.plate });
    res.status(200).json({ message: 'Matrícula eliminada' });
  } else {
    res.status(404).json({ error: 'No encontrada' });
  }
});

app.get('/api/v1/logs', authenticateHybrid, (req, res) => res.status(200).json(getAllLogsStmt.all()));

app.delete('/api/v1/logs', authenticateHybrid, requireAdmin, (req, res) => {
  try {
    const { camera_id } = req.query;
    let info;
    if (camera_id) {
      info = cleanLogsByCameraStmt.run(camera_id);
      io.emit('logs_cleared', { camera_id });
    } else {
      info = cleanAllLogsStmt.run();
      io.emit('logs_cleared', { camera_id: null });
    }
    return res.status(200).json({ message: 'Logs eliminados', rowsDeleted: info.changes });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno al borrar logs' });
  }
});

server.listen(3000, () => {
  console.log('Backend LPR activo en puerto 3000 con SQLite y WebSockets');
});
