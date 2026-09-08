const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'access_control.sqlite');
const db = new Database(dbPath);

const args = process.argv.slice(2);
const username = args[0];
const password = args[1];

if (!username || !password) {
  console.error('\n❌ Error: Faltan argumentos.');
  console.log('💡 Uso correcto: node createUser.js <nombre_usuario> <contraseña>\n');
  process.exit(1);
}

try {
  const cleanUsername = username.trim().toLowerCase();

  const checkUserStmt = db.prepare('SELECT * FROM users WHERE username = ?');
  if (checkUserStmt.get(cleanUsername)) {
    console.error(`\n⚠️  El usuario '${cleanUsername}' ya existe en la base de datos.\n`);
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  const insertStmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  insertStmt.run(cleanUsername, hash);

  console.log(`\n✅ ÉXITO: Usuario '${cleanUsername}' creado correctamente en la BD local.\n`);

} catch (error) {
  console.error('\n❌ ERROR FATAL en la base de datos:', error.message, '\n');
  process.exit(1);
}
