const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔍 Verificando estrutura da tabela users...');

db.all("PRAGMA table_info(users)", (err, rows) => {
  if (err) {
    console.error('❌ Erro ao consultar estrutura:', err.message);
  } else {
    console.log('📊 Estrutura da tabela users:');
    console.table(rows);
  }
  
  // Verificar também user_profiles
  db.all("PRAGMA table_info(user_profiles)", (err, rows) => {
    if (err) {
      console.error('❌ Erro ao consultar user_profiles:', err.message);
    } else {
      console.log('📊 Estrutura da tabela user_profiles:');
      console.table(rows);
    }
    
    // Verificar user_invitations
    db.all("PRAGMA table_info(user_invitations)", (err, rows) => {
      if (err) {
        console.error('❌ Erro ao consultar user_invitations:', err.message);
      } else {
        console.log('📊 Estrutura da tabela user_invitations:');
        console.table(rows);
      }
      db.close();
    });
  });
});