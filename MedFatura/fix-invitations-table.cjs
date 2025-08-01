const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔄 Atualizando tabela user_invitations para incluir prestador...');

db.serialize(() => {
  // Criar nova tabela com constraint atualizada
  db.run(`CREATE TABLE user_invitations_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cpf_crm TEXT NOT NULL UNIQUE,
    user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
    invitation_token TEXT NOT NULL UNIQUE,
    invited_by_user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.log('❌ Erro ao criar user_invitations_new:', err.message);
      db.close();
      return;
    }
    
    console.log('✅ Tabela user_invitations_new criada');
    
    // Copiar dados existentes
    db.run(`INSERT INTO user_invitations_new SELECT * FROM user_invitations`, (err) => {
      if (err) {
        console.log('❌ Erro ao copiar dados:', err.message);
        db.close();
        return;
      }
      
      console.log('✅ Dados copiados');
      
      // Remover tabela antiga e renomear
      db.run(`DROP TABLE user_invitations`, (err) => {
        if (err) {
          console.log('❌ Erro ao remover tabela antiga:', err.message);
          db.close();
          return;
        }
        
        db.run(`ALTER TABLE user_invitations_new RENAME TO user_invitations`, (err) => {
          if (err) {
            console.log('❌ Erro ao renomear tabela:', err.message);
            db.close();
            return;
          }
          
          console.log('✅ Tabela user_invitations atualizada com sucesso!');
          
          // Verificar a estrutura da nova tabela
          db.all("PRAGMA table_info(user_invitations)", (err, columns) => {
            if (err) {
              console.log('❌ Erro ao verificar estrutura:', err.message);
            } else {
              console.log('📊 Nova estrutura da tabela user_invitations:');
              console.table(columns);
              
              // Verificar convites existentes
              db.all("SELECT id, email, name, user_type FROM user_invitations ORDER BY created_at DESC", (err, invites) => {
                if (err) {
                  console.log('❌ Erro ao consultar convites:', err.message);
                } else {
                  console.log('📋 Convites existentes:');
                  console.table(invites);
                }
                db.close();
              });
            }
          });
        });
      });
    });
  });
});