const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

console.log('Verificando banco de dados...');
console.log('Caminho do banco:', dbPath);
console.log('Arquivo existe:', fs.existsSync(dbPath));

if (!fs.existsSync(dbPath)) {
  console.log('Banco de dados não encontrado. Criando...');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao criar banco:', err.message);
      return;
    }
    console.log('Banco de dados criado com sucesso!');
    
    // Criar tabelas básicas
    db.serialize(() => {
      // Tabela users
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Tabela user_profiles
      db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        cpf_crm TEXT NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);
      
      // Inserir usuário admin padrão
      db.run(`INSERT OR IGNORE INTO users (email, password, name, user_type) 
              VALUES ('admin@medfatura.com', '$2b$10$8K1p/a0dqailSYkiHPPyLOeZCcNWpDSTfEGdGzg8.vJuFZjXvqgHy', 'Administrador', 'admin')`, 
        function(err) {
          if (err) {
            console.error('Erro ao inserir admin:', err.message);
          } else {
            console.log('Usuário admin criado/verificado');
          }
        });
    });
    
    db.close((err) => {
      if (err) {
        console.error('Erro ao fechar banco:', err.message);
      } else {
        console.log('Banco configurado com sucesso!');
      }
    });
  });
} else {
  console.log('Banco de dados já existe.');
  
  // Verificar se as tabelas existem
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao conectar:', err.message);
      return;
    }
    
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
      if (err) {
        console.error('Erro ao verificar tabelas:', err.message);
      } else if (row) {
        console.log('Tabela users existe');
      } else {
        console.log('Tabela users NÃO existe');
      }
      
      db.close();
    });
  });
}