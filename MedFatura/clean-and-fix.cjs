const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🧹 Limpando tabelas temporárias...');

db.serialize(() => {
  // Limpar tabelas temporárias se existirem
  db.run(`DROP TABLE IF EXISTS users_new`, (err) => {
    if (err) console.log('Info: users_new não existia');
    else console.log('✅ users_new removida');
  });
  
  db.run(`DROP TABLE IF EXISTS user_profiles_new`, (err) => {
    if (err) console.log('Info: user_profiles_new não existia');
    else console.log('✅ user_profiles_new removida');
  });
  
  db.run(`DROP TABLE IF EXISTS user_invitations_new`, (err) => {
    if (err) console.log('Info: user_invitations_new não existia');
    else console.log('✅ user_invitations_new removida');
    
    // Agora aplicar as mudanças
    console.log('🔄 Aplicando mudanças...');
    
    // 1. Atualizar tabela users
    db.run(`CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
      is_active BOOLEAN DEFAULT 1,
      email_verified BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      google_id TEXT,
      avatar_url TEXT,
      phone TEXT,
      address TEXT
    )`, (err) => {
      if (err) {
        console.log('❌ Erro ao criar users_new:', err.message);
        db.close();
        return;
      }
      
      console.log('✅ Tabela users_new criada');
      
      // Copiar dados existentes
      db.run(`INSERT INTO users_new (id, email, password_hash, name, user_type, is_active, email_verified, created_at, updated_at, google_id, avatar_url, phone, address)
              SELECT id, email, password_hash, name, user_type, is_active, email_verified, created_at, updated_at, google_id, avatar_url, phone, address FROM users`, (err) => {
        if (err) {
          console.log('❌ Erro ao copiar dados users:', err.message);
          db.close();
          return;
        }
        
        console.log('✅ Dados users copiados');
        
        // Substituir tabela
        db.run(`DROP TABLE users`, (err) => {
          if (err) {
            console.log('❌ Erro ao remover users antiga:', err.message);
            db.close();
            return;
          }
          
          db.run(`ALTER TABLE users_new RENAME TO users`, (err) => {
            if (err) {
              console.log('❌ Erro ao renomear users:', err.message);
              db.close();
              return;
            }
            
            console.log('✅ Tabela users atualizada');
            
            // Agora criar o usuário prestador
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
          });
        });
      });
    });
  });
});