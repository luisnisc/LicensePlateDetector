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
      {
        url: 'http://fsccv:3000',
        description: 'Servidor Producción'
      },
      {
        url: 'http://localhost:3000',
        description: 'Servidor Local',
      }
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
          description: 'Token estático (API_TOKEN) exclusivo para el hardware/cámaras. Enviar como: Bearer <TOKEN>',
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

  socket.on('video_frame', (frameBuffer) => {
    socket.broadcast.emit('video_frame', frameBuffer);
  });
});

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

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
  console.log("[SISTEMA] Columna 'role' añadida a los usuarios existentes.");
} catch (e) {
}
const checkUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
if (!checkUserStmt.get('admin')) {
  const hash = bcrypt.hashSync('Filip@2807', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('[SISTEMA] Usuario por defecto creado: admin ');
}

const checkPlateStmt = db.prepare(`
    SELECT plate, owner_name
    FROM whitelist
    WHERE plate = ?
      AND (valid_until IS NULL OR datetime(valid_until) > datetime('now'))
`);
const insertLogStmt = db.prepare('INSERT INTO access_logs (plate, confidence, camera_id, status, timestamp) VALUES (?, ?, ?, ?, ?)');

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


/**
 * @openapi
 * /api/v1/login:
 *   post:
 *     summary: Inicia sesión en el panel web
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "Filip@2807"
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve el token JWT
 *       400:
 *         description: Petición mal formada (faltan credenciales)
 *       401:
 *         description: Usuario o contraseña incorrectos
 */
app.post('/api/v1/login', (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(`[LOGIN] Intento de acceso. Usuario recibido: '${username}'`);

    if (!username || password === undefined || password === null) {
      console.log('[LOGIN] Rechazado: Falta usuario o contraseña en la petición.');
      return res.status(400).json({ error: 'El usuario y contraseña son obligatorios' });
    }

    const user = checkUserStmt.get(username);

    if (!user) {
      console.log('[LOGIN] Rechazado: El usuario no existe en la base de datos.');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (!user.password) {
      console.log('[LOGIN] Rechazado: El usuario existe pero su hash de contraseña está vacío.');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const isValid = bcrypt.compareSync(password, user.password);

    if (isValid) {
      console.log('[LOGIN] Acceso concedido. Generando JWT.');
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token });
    } else {
      console.log('[LOGIN] Rechazado: La contraseña no coincide.');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

  } catch (error) {
    console.error('[LOGIN FATAL ERROR]', error.message);
    return res.status(500).json({ error: 'Error interno del servidor en el login' });
  }
});



const authenticateWeb = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Sesión caducada o token inválido' });
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


/**
 * @openapi
 * /api/v1/access:
 *   post:
 *     summary: Procesa una detección de matrícula enviada por una cámara LPR
 *     tags:
 *       - Access Control (Hardware)
 *     security:
 *       - apiTokenAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plate
 *             properties:
 *               plate:
 *                 type: string
 *                 example: "1234ABC"
 *               confidence:
 *                 type: number
 *                 example: 0.95
 *               camera_id:
 *                 type: string
 *                 example: "CAM_ENTRADA_01"
 *     responses:
 *       200:
 *         description: Acceso permitido.
 *       401:
 *         description: Token de API inválido o ausente.
 *       403:
 *         description: Acceso denegado (matrícula no en whitelist o caducada).
 *       429:
 *         description: Solicitud ignorada por Cooldown activo.
 */

app.post('/api/v1/access', authenticateToken, (req, res) => {
  const { plate, confidence, camera_id } = req.body;

  if (!plate) return res.status(400).json({ error: 'Matrícula no proporcionada' });

  const now = Date.now();
  const lastTime = lastAccessLog.get(plate) || 0;

  if (now - lastTime < COOLDOWN_MS) {
    console.log(`[DEBOUNCE] Matrícula ${plate} ignorada (Cooldown).`);
    return res.status(429).json({ status: 'IGNORED', message: 'Cooldown activo' });
  }

  const validRecord = checkPlateStmt.get(plate);
  const status = validRecord ? 'PERMITIDO' : 'DENEGADO';


  const timestamp = new Date().toISOString();



  if (validRecord) {
    lastAccessLog.set(plate, now);
    triggerRelayHardware();
  }

  const info = insertLogStmt.run(
    plate,
    confidence,
    camera_id,
    status,
    timestamp
  );

  const savedLog = db.prepare(`
    SELECT id, plate, timestamp
    FROM access_logs
    WHERE id = ?
  `).get(info.lastInsertRowid);


  const newLog = {
    id: info.lastInsertRowid,
    plate,
    confidence,
    camera_id,
    status,
    timestamp
  };

  io.emit('new_log', newLog);

  console.log(`[ACCESO ${status}] Matrícula: ${plate} ${validRecord ? `(${validRecord.owner_name})` : ''}`);
  return res.status(validRecord ? 200 : 403).json({ status, plate });
});

function triggerRelayHardware() { }

/**
 * @openapi
 * /api/v1/whitelist:
 *   get:
 *     summary: Obtiene la lista completa de matrículas autorizadas
 *     tags:
 *       - Whitelist (Web Panel)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista devuelta correctamente.
 *       401:
 *         description: Token JWT inválido o ausente.
 *
 *   post:
 *     summary: Añade o actualiza una matrícula en la whitelist (Solo Admins)
 *     tags:
 *       - Whitelist (Web Panel)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plate
 *               - owner_name
 *             properties:
 *               plate:
 *                 type: string
 *                 example: "5678DEF"
 *               owner_name:
 *                 type: string
 *                 example: "Juan Pérez"
 *               valid_until:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: "Fecha de caducidad opcional. Si es null, el acceso es permanente."
 *                 example: "2026-12-31T23:59:59.000Z"
 *     responses:
 *       201:
 *         description: Matrícula guardada correctamente.
 *       400:
 *         description: Datos de entrada no válidos.
 *       403:
 *         description: Permisos insuficientes (requiere rol admin).
 */

app.get('/api/v1/whitelist', authenticateWeb, (req, res) => res.status(200).json(getAllPlatesStmt.all()));

app.post('/api/v1/whitelist', authenticateWeb, requireAdmin, (req, res) => {
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

/**
 * @openapi
 * /api/v1/whitelist/{plate}:
 *   delete:
 *     summary: Elimina una matrícula de la whitelist (Solo Admins)
 *     tags:
 *       - Whitelist (Web Panel)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: plate
 *         required: true
 *         schema:
 *           type: string
 *         description: Matrícula a eliminar
 *     responses:
 *       200:
 *         description: Matrícula eliminada correctamente.
 *       403:
 *         description: Permisos insuficientes (requiere rol admin).
 *       404:
 *         description: Matrícula no encontrada.
 */

app.delete('/api/v1/whitelist/:plate', authenticateWeb, requireAdmin, (req, res) => {
  const info = deletePlateStmt.run(req.params.plate);
  if (info.changes > 0) {
    io.emit('plate_removed', { plate: req.params.plate });
    res.status(200).json({ message: 'Matrícula eliminada' });
  } else {
    res.status(404).json({ error: 'No encontrada' });
  }
});

/**
 * @openapi
 * /api/v1/logs:
 *   get:
 *     summary: Obtiene el historial de accesos
 *     tags:
 *       - Logs (Web Panel)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial de registros devuelto.
 *
 *   delete:
 *     summary: Purga todo el historial de accesos (Solo Admins)
 *     tags:
 *       - Logs (Web Panel)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial eliminado correctamente.
 *       403:
 *         description: Permisos insuficientes (requiere rol admin).
 *       500:
 *         description: Error interno de base de datos.
 */

app.get('/api/v1/logs', authenticateWeb, (req, res) => res.status(200).json(getAllLogsStmt.all()));

app.delete('/api/v1/logs', authenticateWeb, requireAdmin, (req, res) => {
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
