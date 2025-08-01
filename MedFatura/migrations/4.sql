
CREATE TABLE user_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cpf_crm TEXT NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('medico', 'admin')),
  invitation_token TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  is_used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
