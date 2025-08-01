const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    return;
  }
  
  console.log('=== DEBUG LOGIN ===\n');
  
  // Verificar usuários existentes
  db.all('SELECT id, email, name, user_type, password_hash, is_active FROM users', (err, users) => {
    if (err) {
      console.error('Erro ao buscar usuários:', err.message);
    } else {
      console.log('Usuários no banco:');
      users.forEach(user => {
        console.log(`- ID: ${user.id}, Email: ${user.email}, Nome: ${user.name}`);
        console.log(`  Tipo: ${user.user_type}, Ativo: ${user.is_active}`);
        console.log(`  Senha: ${user.password_hash}\n`);
      });
    }
    
    // Verificar sessões ativas
    db.all('SELECT * FROM user_sessions WHERE expires_at > CURRENT_TIMESTAMP', (err, sessions) => {
      if (err) {
        console.error('Erro ao buscar sessões:', err.message);
      } else {
        console.log('Sessões ativas:');
        if (sessions.length === 0) {
          console.log('- Nenhuma sessão ativa\n');
        } else {
          sessions.forEach(session => {
            console.log(`- Session ID: ${session.session_id}`);
            console.log(`  User ID: ${session.user_id}`);
            console.log(`  Expira em: ${session.expires_at}\n`);
          });
        }
      }
      
      // Testar credenciais específicas
      const testEmail = 'solange.gomes@medfatura.com';
      const testPassword = 'senha123';
      
      console.log(`Testando login com: ${testEmail} / ${testPassword}`);
      
      db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [testEmail], (err, user) => {
        if (err) {
          console.error('Erro na consulta:', err.message);
        } else if (!user) {
          console.log('❌ Usuário não encontrado ou inativo');
          
          // Criar usuário de teste se não existir
          console.log('\nCriando usuário de teste...');
          db.run(`INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, 
                 [testEmail, testPassword, 'Solange Gomes', 'prestador', 1, 1], 
                 function(err) {
            if (err) {
              console.error('Erro ao criar usuário:', err.message);
            } else {
              console.log('✅ Usuário de teste criado com sucesso!');
            }
            db.close();
          });
        } else {
          console.log('✅ Usuário encontrado:');
          console.log(`   Senha no banco: ${user.password_hash}`);
          console.log(`   Senha testada: ${testPassword}`);
          console.log(`   Senhas coincidem: ${user.password_hash === testPassword ? '✅' : '❌'}`);
          db.close();
        }
      });
    });
  });
});