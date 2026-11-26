const Database = require('better-sqlite3')
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'access_control.sqlite');
const db = new Database(dbPath);

const args = process.argv.slice(2);
const username = args[0];
const newPass = args[1];


if (!username || !newPass) {
  console.error('\n❌ Error: Faltan argumentos.');
  console.log('💡 Uso correcto: node editPass.js <usuario> <nueva contraseña> \n');
  process.exit(1);
}
try {
  const cleanUsername = username.trim().toLowerCase();

  const checkUserStmt = db.prepare(' SELECT * FROM users WHERE username = ?')
  if (!checkUserStmt.get(cleanUsername)) {
    console.error(`\n⚠️  El usuario '${cleanUsername}' no existe en la base de datos.\n`);
    process.exit(1);
  }

  const updateStmt = db.prepare('UPDATE users SET password = ? where username = ?')
  updateStmt.run(newPass, cleanUsername);

  console.log(`\n✅ ÉXITO: Usuario '${cleanUsername}' actualizado correctamente. \n`)
} catch (error) {
  console.error('\n❌ ERROR FATAL en la base de datos:', error.message, '\n')
  process.exit(1);
}
