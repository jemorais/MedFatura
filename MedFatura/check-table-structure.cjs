const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando estrutura da tabela users...');

db.all('PRAGMA table_info(users)', (err, rows) => {
  if (err) {
    console.error('❌ Erro:', err.message);
  } else {
    console.log('📋 Colunas da tabela users:');
    rows.forEach(row => {
      console.log(`- ${row.name}: ${row.type} (${row.notnull ? 'NOT NULL' : 'NULL'})`);
    });
  }
  
  // Verificar dados do admin
  db.get('SELECT * FROM users WHERE email = ?', ['admin@medfatura.com'], (err, row) => {
    if (err) {
      console.error('❌ Erro ao buscar admin:', err.message);
    } else if (row) {
      console.log('\n👤 Dados do admin:');
      Object.keys(row).forEach(key => {
        console.log(`- ${key}: ${row[key]}`);
      });
    } else {
      console.log('❌ Admin não encontrado');
    }
    
    db.close();
  });
});