const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    return;
  }
  
  // Verificar se user_sessions existe
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'", (err, row) => {
    if (err) {
      console.error('Erro:', err.message);
    } else if (row) {
      console.log('✓ Tabela user_sessions existe');
    } else {
      console.log('✗ Tabela user_sessions NÃO existe - criando...');
      
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
          console.log('✓ Tabela user_sessions criada!');
        }
        db.close();
      });
      return;
    }
    db.close();
  });
});