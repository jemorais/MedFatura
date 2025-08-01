const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    return;
  }
  
  console.log('Verificando tabelas...');
  
  // Verificar se a tabela user_sessions existe
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'", (err, row) => {
    if (err) {
      console.error('Erro ao verificar user_sessions:', err.message);
    } else if (row) {
      console.log('Tabela user_sessions existe');
    } else {
      console.log('Tabela user_sessions NÃO existe - criando...');
      
      // Criar tabela user_sessions
      db.run(`CREATE TABLE user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`, (err) => {
        if (err) {
          console.error('Erro ao criar user_sessions:', err.message);
        } else {
          console.log('Tabela user_sessions criada com sucesso!');
        }
      });
    }
    
    // Verificar estrutura da tabela users
    db.all("PRAGMA table_info(users)", (err, rows) => {
      if (err) {
        console.error('Erro ao verificar estrutura users:', err.message);
      } else {
        console.log('\nEstrutura da tabela users:');
        rows.forEach(row => {
          console.log(`- ${row.name}: ${row.type}`);
        });
        
        // Verificar se existe password_hash ou password
        const hasPasswordHash = rows.some(row => row.name === 'password_hash');
        const hasPassword = rows.some(row => row.name === 'password');
        
        console.log(`\nCampo password_hash existe: ${hasPasswordHash}`);
        console.log(`Campo password existe: ${hasPassword}`);
        
        if (!hasPasswordHash && hasPassword) {
          console.log('\nRenomeando coluna password para password_hash...');
          db.run('ALTER TABLE users RENAME COLUMN password TO password_hash', (err) => {
            if (err) {
              console.error('Erro ao renomear coluna:', err.message);
            } else {
              console.log('Coluna renomeada com sucesso!');
            }
            db.close();
          });
        } else {
          db.close();
        }
      }
    });
  });
});