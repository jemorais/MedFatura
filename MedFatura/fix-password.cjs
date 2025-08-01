const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    return;
  }
  
  console.log('=== CORRIGINDO SENHAS ===\n');
  
  // Atualizar senha do usuário solange.gomes@medfatura.com para corresponder ao formulário
  const email = 'solange.gomes@medfatura.com';
  const newPassword = 'senha123'; // Senha que está sendo usada no formulário
  
  db.run('UPDATE users SET password_hash = ? WHERE email = ?', [newPassword, email], function(err) {
    if (err) {
      console.error('Erro ao atualizar senha:', err.message);
    } else {
      console.log(`✅ Senha atualizada para ${email}`);
      console.log(`   Nova senha: ${newPassword}`);
      console.log(`   Linhas afetadas: ${this.changes}`);
    }
    
    // Verificar a atualização
    db.get('SELECT email, password_hash FROM users WHERE email = ?', [email], (err, user) => {
      if (err) {
        console.error('Erro na verificação:', err.message);
      } else if (user) {
        console.log(`\n✅ Verificação: ${user.email} -> ${user.password_hash}`);
      }
      db.close();
    });
  });
});