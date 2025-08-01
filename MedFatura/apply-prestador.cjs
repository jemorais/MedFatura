const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔄 Aplicando migração para prestador de serviços...');

// Primeiro, vamos verificar as constraints atuais
db.serialize(() => {
  // Inserir o usuário prestador
  db.run(`INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
          VALUES (?, ?, ?, ?, ?, ?)`, 
    ['prestador@medfatura.com', 'prestador123', 'Prestador de Serviços', 'prestador', 1, 1], 
    function(err) {
      if (err) {
        console.log('❌ Erro ao inserir usuário prestador:', err.message);
        // Pode ser que o tipo 'prestador' não seja aceito ainda
        console.log('🔧 Tentando recriar a tabela users...');
        
        // Vamos recriar a tabela users com os novos tipos
        db.run(`CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
          is_active BOOLEAN DEFAULT 1,
          email_verified BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.log('❌ Erro ao criar nova tabela:', err.message);
          } else {
            console.log('✅ Nova tabela users criada');
            
            // Copiar dados existentes
            db.run(`INSERT INTO users_new SELECT * FROM users`, (err) => {
              if (err) {
                console.log('❌ Erro ao copiar dados:', err.message);
              } else {
                console.log('✅ Dados copiados');
                
                // Remover tabela antiga e renomear
                db.run(`DROP TABLE users`, (err) => {
                  if (err) {
                    console.log('❌ Erro ao remover tabela antiga:', err.message);
                  } else {
                    db.run(`ALTER TABLE users_new RENAME TO users`, (err) => {
                      if (err) {
                        console.log('❌ Erro ao renomear tabela:', err.message);
                      } else {
                        console.log('✅ Tabela renomeada');
                        
                        // Agora inserir o usuário prestador
                        db.run(`INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
                                VALUES (?, ?, ?, ?, ?, ?)`, 
                          ['prestador@medfatura.com', 'prestador123', 'Prestador de Serviços', 'prestador', 1, 1], 
                          function(err) {
                            if (err) {
                              console.log('❌ Erro ao inserir usuário prestador:', err.message);
                            } else {
                              console.log('✅ Usuário prestador criado com ID:', this.lastID);
                            }
                            
                            // Verificar resultado
                            db.all("SELECT id, email, name, user_type FROM users", (err, rows) => {
                              if (err) {
                                console.error('❌ Erro ao consultar usuários:', err.message);
                              } else {
                                console.log('📊 Todos os usuários:');
                                console.table(rows);
                              }
                              db.close();
                            });
                          }
                        );
                      }
                    });
                  }
                });
              }
            });
          }
        });
      } else {
        console.log('✅ Usuário prestador criado com ID:', this.lastID);
        
        // Verificar resultado
        db.all("SELECT id, email, name, user_type FROM users", (err, rows) => {
          if (err) {
            console.error('❌ Erro ao consultar usuários:', err.message);
          } else {
            console.log('📊 Todos os usuários:');
            console.table(rows);
          }
          db.close();
        });
      }
    }
  );
});