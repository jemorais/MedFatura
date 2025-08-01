const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Corrigindo senha do admin...');

// Definir a senha do admin como Admin123!
db.run('UPDATE users SET password = ? WHERE email = ?', ['Admin123!', 'admin@medfatura.com'], function(err) {
  if (err) {
    console.error('❌ Erro ao atualizar senha:', err.message);
  } else {
    console.log('✅ Senha do admin atualizada com sucesso!');
    console.log('📧 Email: admin@medfatura.com');
    console.log('🔑 Nova senha: Admin123!');
    console.log('📊 Linhas afetadas:', this.changes);
  }
  
  db.close();
});