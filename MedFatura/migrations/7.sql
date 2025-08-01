-- Migration 7: Sistema de login simplificado
-- Adicionar tabela de sessões e simplificar autenticação

-- Criar tabela de sessões de usuário
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Atualizar senha do admin para algo simples
UPDATE users SET password_hash = 'admin123' WHERE email = 'admin@medfatura.com';

-- Adicionar campo para senha simples (já existe como password_hash, vamos manter)
-- Remover senhas antigas complexas e definir senhas simples para teste
UPDATE users SET password_hash = 'medico123' WHERE user_type = 'medico' AND email != 'admin@medfatura.com';