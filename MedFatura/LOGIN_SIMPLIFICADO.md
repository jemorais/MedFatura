# 🔧 Sistema de Login Simplificado - MedFatura

## ✅ Mudanças Aplicadas

O sistema de login foi completamente simplificado para eliminar problemas com:
- JWT tokens expirados
- Cookies complexos
- Hash de senhas com bcrypt
- Erros de autenticação

### 🔑 Novo Sistema

#### **Autenticação por Sessão Simples**
- **Sem JWT**: Sistema baseado em session ID armazenado no banco
- **Senhas Simples**: Sem criptografia complexa (apenas texto simples)
- **Cookies Leves**: Apenas um session_id simples
- **Expiração Automática**: Sessões expiram após 7 dias

#### **Credenciais Padrão**

| Tipo | Email | Senha |
|------|--------|--------|
| **Admin** | admin@medfatura.com | **admin123** |
| **Médico** | qualquer email cadastrado | **medico123** |

#### **Como Usar**

1. **Login Simples**: Use email e senha diretamente
2. **Sem Complicações**: Não precisa se preocupar com tokens
3. **Logout Limpo**: Remove a sessão do banco automaticamente

### 📋 Banco de Dados Atualizado

#### **Nova Tabela: user_sessions**
```sql
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### **Senhas Atualizadas**
- Admin: `admin123`
- Todos médicos: `medico123`

### 🚀 Testando o Sistema

#### **Login Admin**
- **Email**: admin@medfatura.com
- **Senha**: admin123

#### **Login Médico**
- Use qualquer email cadastrado
- **Senha**: medico123

### 🔄 API Endpoints Simplificados

- `POST /api/auth/login` - Login com email e senha simples
- `POST /api/auth/register` - Registro com senha simples
- `POST /api/auth/logout` - Remove sessão do banco
- `GET /api/users/me` - Retorna dados do usuário logado

### 🎯 Vantagens

1. **Sem Erros de Token**: Não há mais JWT para expirar
2. **Login Instantâneo**: Sem delays de criptografia
3. **Fácil Debug**: Sessões visíveis no banco de dados
4. **Reset Simples**: Apague sessões para fazer logout forçado
5. **Desenvolvimento Rápido**: Bypass de autenticação disponível

### 🛠️ Debug

Para ver sessões ativas:
```sql
SELECT us.session_id, u.email, us.expires_at 
FROM user_sessions us 
JOIN users u ON us.user_id = u.id 
WHERE us.expires_at > datetime('now');
```

Para limpar todas as sessões:
```sql
DELETE FROM user_sessions;
```

### 🎉 Pronto para Uso!

O sistema está funcionando com autenticação simplificada. Use as credenciais acima para fazer login sem complicações!