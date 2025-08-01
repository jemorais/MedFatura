const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔍 Verificando usuários prestadores...');

db.all("SELECT id, email, name, user_type FROM users WHERE user_type = 'prestador'", (err, rows) => {
  if (err) {
    console.error('❌ Erro ao consultar usuários:', err.message);
  } else {
    console.log('📊 Usuários prestadores encontrados:');
    console.table(rows);
  }
  
  // Verificar todos os tipos de usuário
  db.all("SELECT user_type, COUNT(*) as count FROM users GROUP BY user_type", (err, rows) => {
    if (err) {
      console.error('❌ Erro ao consultar tipos:', err.message);
    } else {
      console.log('📈 Distribuição por tipo de usuário:');
      console.table(rows);
    }
    db.close();
  });
});