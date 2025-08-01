-- Tabela de usuários com autenticação por email/senha
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  cpf_crm TEXT UNIQUE,
  user_type TEXT NOT NULL DEFAULT 'medico' CHECK (user_type IN ('medico', 'admin')),
  is_active BOOLEAN DEFAULT 1,
  email_verified BOOLEAN DEFAULT 0,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir usuário admin padrão (senha: Admin123!)
INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
VALUES (
  'admin@medfatura.com', 
  '$2b$10$rQJ8vQZ9Xm5K2L3N4P6Q8uYvWxZaBcDeFgHiJkLmNoPqRsTuVwXyZ', 
  'Administrador', 
  'admin', 
  1, 
  1
);