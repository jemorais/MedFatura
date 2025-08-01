const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando credenciais do admin...');

db.get('SELECT * FROM users WHERE email = ?', ['admin@medfatura.com'], (err, row) => {
  if (err) {
    console.error('❌ Erro:', err.message);
  } else if (row) {
    console.log('✅ Admin encontrado:');
    console.log('📧 Email:', row.email);
    console.log('🔑 Senha:', row.password);
    console.log('👤 Nome:', row.name);
    console.log('🏷️ Tipo:', row.user_type);
    console.log('✅ Ativo:', row.is_active);
  } else {
    console.log('❌ Admin não encontrado');
  }
  
  db.close();
});