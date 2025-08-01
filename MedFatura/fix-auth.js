import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Aplicando mudanças de autenticação simplificada...');

db.serialize(() => {
  // Criar tabela de sessões
  db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Erro ao criar tabela user_sessions:', err.message);
    else console.log('✅ Tabela user_sessions criada');
  });

  // Criar índices
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)`);

  // Atualizar senhas para versão simplificada
  db.run(`UPDATE users SET password_hash = 'admin123' WHERE email = 'admin@medfatura.com'`, (err) => {
    if (err) console.error('Erro ao atualizar senha admin:', err.message);
    else console.log('✅ Senha admin atualizada para: admin123');
  });

  db.run(`UPDATE users SET password_hash = 'medico123' WHERE user_type = 'medico'`, (err) => {
    if (err) console.error('Erro ao atualizar senhas médicos:', err.message);
    else console.log('✅ Senhas médicos atualizadas para: medico123');
  });
});

db.close((err) => {
  if (err) {
    console.error('Erro ao fechar banco:', err.message);
  } else {
    console.log('✅ Todas as mudanças aplicadas com sucesso!');
    console.log('📧 Login admin: admin@medfatura.com / admin123');
    console.log('📧 Login médico: email@qualquer.com / medico123');
  }
});