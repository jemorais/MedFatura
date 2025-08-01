const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔄 Aplicando correção final para prestador...');

db.serialize(() => {
  // Primeiro verificar a estrutura atual
  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.log('❌ Erro ao verificar estrutura:', err.message);
      db.close();
      return;
    }
    
    console.log('📊 Colunas atuais da tabela users:');
    const columnNames = columns.map(col => col.name);
    console.log(columnNames.join(', '));
    
    // Limpar tabelas temporárias
    db.run(`DROP TABLE IF EXISTS users_new`, (err) => {
      // Criar nova tabela com constraint atualizada
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
        
        // Copiar apenas as colunas que existem
        const existingColumns = columnNames.filter(col => 
          ['id', 'email', 'password_hash', 'name', 'user_type', 'is_active', 'email_verified', 'created_at', 'updated_at', 'google_id', 'avatar_url', 'phone', 'address'].includes(col)
        );
        
        const selectColumns = existingColumns.join(', ');
        const insertColumns = existingColumns.join(', ');
        
        console.log('📋 Copiando colunas:', selectColumns);
        
        db.run(`INSERT INTO users_new (${insertColumns}) SELECT ${selectColumns} FROM users`, (err) => {
          if (err) {
            console.log('❌ Erro ao copiar dados:', err.message);
            db.close();
            return;
          }
          
          console.log('✅ Dados copiados');
          
          // Substituir tabela
          db.run(`DROP TABLE users`, (err) => {
            if (err) {
              console.log('❌ Erro ao remover tabela antiga:', err.message);
              db.close();
              return;
            }
            
            db.run(`ALTER TABLE users_new RENAME TO users`, (err) => {
              if (err) {
                console.log('❌ Erro ao renomear tabela:', err.message);
                db.close();
                return;
              }
              
              console.log('✅ Tabela users atualizada com suporte a prestador');
              
              // Criar usuário prestador
              db.run(`INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
                      VALUES (?, ?, ?, ?, ?, ?)`, 
                ['prestador@medfatura.com', 'prestador123', 'Prestador de Serviços', 'prestador', 1, 1], 
                function(err) {
                  if (err) {
                    console.log('❌ Erro ao criar usuário prestador:', err.message);
                  } else {
                    console.log('✅ Usuário prestador criado com ID:', this.lastID);
                  }
                  
                  // Verificar resultado
                  db.all("SELECT id, email, name, user_type FROM users ORDER BY id", (err, rows) => {
                    if (err) {
                      console.error('❌ Erro ao consultar usuários:', err.message);
                    } else {
                      console.log('📊 Usuários no sistema:');
                      console.table(rows);
                      
                      // Verificar distribuição por tipo
                      db.all("SELECT user_type, COUNT(*) as count FROM users GROUP BY user_type", (err, types) => {
                        if (err) {
                          console.error('❌ Erro ao consultar tipos:', err.message);
                        } else {
                          console.log('📈 Distribuição por tipo:');
                          console.table(types);
                        }
                        db.close();
                      });
                    }
                  });
                }
              );
            });
          });
        });
      });
    });
  });
});