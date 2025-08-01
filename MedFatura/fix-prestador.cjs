const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔄 Atualizando tabelas para incluir prestador...');

db.serialize(() => {
  // 1. Atualizar tabela users
  console.log('📝 Atualizando tabela users...');
  
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
    } else {
      console.log('✅ Tabela users_new criada');
      
      // Copiar dados existentes (apenas as colunas que existem em ambas)
      db.run(`INSERT INTO users_new (id, email, password_hash, name, user_type, is_active, email_verified, created_at, updated_at, google_id, avatar_url, phone, address)
              SELECT id, email, password_hash, name, user_type, is_active, email_verified, created_at, updated_at, google_id, avatar_url, phone, address FROM users`, (err) => {
        if (err) {
          console.log('❌ Erro ao copiar dados users:', err.message);
        } else {
          console.log('✅ Dados users copiados');
          
          // Remover tabela antiga e renomear
          db.run(`DROP TABLE users`, (err) => {
            if (err) {
              console.log('❌ Erro ao remover users antiga:', err.message);
            } else {
              db.run(`ALTER TABLE users_new RENAME TO users`, (err) => {
                if (err) {
                  console.log('❌ Erro ao renomear users:', err.message);
                } else {
                  console.log('✅ Tabela users atualizada');
                  
                  // 2. Atualizar tabela user_profiles
                  console.log('📝 Atualizando tabela user_profiles...');
                  
                  db.run(`CREATE TABLE user_profiles_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    cpf_crm TEXT NOT NULL,
                    user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                  )`, (err) => {
                    if (err) {
                      console.log('❌ Erro ao criar user_profiles_new:', err.message);
                    } else {
                      console.log('✅ Tabela user_profiles_new criada');
                      
                      // Copiar dados existentes
                      db.run(`INSERT INTO user_profiles_new SELECT * FROM user_profiles`, (err) => {
                        if (err) {
                          console.log('❌ Erro ao copiar dados user_profiles:', err.message);
                        } else {
                          console.log('✅ Dados user_profiles copiados');
                          
                          // Remover tabela antiga e renomear
                          db.run(`DROP TABLE user_profiles`, (err) => {
                            if (err) {
                              console.log('❌ Erro ao remover user_profiles antiga:', err.message);
                            } else {
                              db.run(`ALTER TABLE user_profiles_new RENAME TO user_profiles`, (err) => {
                                if (err) {
                                  console.log('❌ Erro ao renomear user_profiles:', err.message);
                                } else {
                                  console.log('✅ Tabela user_profiles atualizada');
                                  
                                  // 3. Atualizar tabela user_invitations
                                  console.log('📝 Atualizando tabela user_invitations...');
                                  
                                  db.run(`CREATE TABLE user_invitations_new (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    email TEXT NOT NULL,
                                    name TEXT NOT NULL,
                                    cpf_crm TEXT NOT NULL,
                                    user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
                                    invitation_token TEXT NOT NULL,
                                    invited_by_user_id TEXT NOT NULL,
                                    expires_at DATETIME NOT NULL,
                                    is_used BOOLEAN DEFAULT 0,
                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                  )`, (err) => {
                                    if (err) {
                                      console.log('❌ Erro ao criar user_invitations_new:', err.message);
                                    } else {
                                      console.log('✅ Tabela user_invitations_new criada');
                                      
                                      // Copiar dados existentes
                                      db.run(`INSERT INTO user_invitations_new SELECT * FROM user_invitations`, (err) => {
                                        if (err) {
                                          console.log('❌ Erro ao copiar dados user_invitations:', err.message);
                                        } else {
                                          console.log('✅ Dados user_invitations copiados');
                                          
                                          // Remover tabela antiga e renomear
                                          db.run(`DROP TABLE user_invitations`, (err) => {
                                            if (err) {
                                              console.log('❌ Erro ao remover user_invitations antiga:', err.message);
                                            } else {
                                              db.run(`ALTER TABLE user_invitations_new RENAME TO user_invitations`, (err) => {
                                                if (err) {
                                                  console.log('❌ Erro ao renomear user_invitations:', err.message);
                                                } else {
                                                  console.log('✅ Tabela user_invitations atualizada');
                                                  
                                                  // 4. Criar usuário prestador
                                                  console.log('👤 Criando usuário prestador...');
                                                  
                                                  db.run(`INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
                                                          VALUES (?, ?, ?, ?, ?, ?)`, 
                                                    ['prestador@medfatura.com', 'prestador123', 'Prestador de Serviços', 'prestador', 1, 1], 
                                                    function(err) {
                                                      if (err) {
                                                        console.log('❌ Erro ao inserir usuário prestador:', err.message);
                                                      } else {
                                                        console.log('✅ Usuário prestador criado com ID:', this.lastID);
                                                      }
                                                      
                                                      // Verificar resultado final
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
                                }
                              });
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
});