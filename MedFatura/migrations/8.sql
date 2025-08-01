-- Migration 8: Adicionar tipo de usuário 'prestador'
-- Expandir sistema para incluir prestadores de serviços

-- Atualizar tabela users para incluir 'prestador'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check CHECK (user_type IN ('medico', 'admin', 'prestador'));

-- Atualizar tabela user_profiles para incluir 'prestador'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_type_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_type_check CHECK (user_type IN ('medico', 'admin', 'prestador'));

-- Atualizar tabela user_invitations para incluir 'prestador'
ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_user_type_check;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_user_type_check CHECK (user_type IN ('medico', 'admin', 'prestador'));

-- Criar usuário prestador padrão para teste
INSERT INTO users (email, password_hash, name, user_type, is_active, email_verified) 
VALUES (
  'prestador@medfatura.com', 
  'prestador123', 
  'Prestador de Serviços', 
  'prestador', 
  1, 
  1
);