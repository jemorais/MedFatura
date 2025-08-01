const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('🔄 Atualizando tabela user_profiles para incluir prestador...');

db.serialize(() => {
  // Criar nova tabela com constraint atualizada
  db.run(`CREATE TABLE user_profiles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    cpf_crm TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin', 'prestador')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.log('❌ Erro ao criar user_profiles_new:', err.message);
      db.close();
      return;
    }
    
    console.log('✅ Tabela user_profiles_new criada');
    
    // Copiar dados existentes
    db.run(`INSERT INTO user_profiles_new SELECT * FROM user_profiles`, (err) => {
      if (err) {
        console.log('❌ Erro ao copiar dados:', err.message);
        db.close();
        return;
      }
      
      console.log('✅ Dados copiados');
      
      // Remover tabela antiga e renomear
      db.run(`DROP TABLE user_profiles`, (err) => {
        if (err) {
          console.log('❌ Erro ao remover tabela antiga:', err.message);
          db.close();
          return;
        }
        
        db.run(`ALTER TABLE user_profiles_new RENAME TO user_profiles`, (err) => {
          if (err) {
            console.log('❌ Erro ao renomear tabela:', err.message);
            db.close();
            return;
          }
          
          console.log('✅ Tabela user_profiles atualizada com sucesso!');
          
          // Verificar a nova estrutura
          db.all("PRAGMA table_info(user_profiles)", (err, columns) => {
            if (err) {
              console.log('❌ Erro ao verificar estrutura:', err.message);
            } else {
              console.log('📋 Nova estrutura da tabela user_profiles:');
              console.table(columns);
            }
            
            // Verificar dados existentes
            db.all("SELECT * FROM user_profiles", (err, rows) => {
              if (err) {
                console.log('❌ Erro ao consultar dados:', err.message);
              } else {
                console.log('📊 Dados na tabela user_profiles:');
                console.table(rows);
              }
              db.close();
            });
          });
        });
      });
    });
  });
});