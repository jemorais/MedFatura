import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import sgMail from '@sendgrid/mail';
// import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs';
import type { Context, Next } from 'hono';
import sqlite3 from 'sqlite3';
import { existsSync } from 'fs';

// SQLite adapter para Node.js
class SQLiteAdapter {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  prepare(query: string) {
    const statement = {
      bind: (...values: any[]) => {
        return {
          first: async <T = any>(): Promise<T | null> => {
            return new Promise((resolve, reject) => {
              this.db.get(query, values, (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row as T || null);
              });
            });
          },
          all: async (): Promise<{ results: any[] }> => {
            return new Promise((resolve, reject) => {
              this.db.all(query, values, (err: any, rows: any) => {
                if (err) reject(err);
                else resolve({ results: rows || [] });
              });
            });
          },
          run: async (): Promise<{ meta: { last_row_id?: number } }> => {
            return new Promise((resolve, reject) => {
              this.db.run(query, values, function(this: any, err: any) {
                if (err) reject(err);
                else resolve({ meta: { last_row_id: this.lastID } });
              });
            });
          }
        };
      },
      first: async <T = any>(): Promise<T | null> => {
        return new Promise((resolve, reject) => {
          this.db.get(query, [], (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row as T || null);
          });
        });
      },
      all: async (): Promise<{ results: any[] }> => {
        return new Promise((resolve, reject) => {
          this.db.all(query, [], (err: any, rows: any) => {
            if (err) reject(err);
            else resolve({ results: rows || [] });
          });
        });
      },
      run: async (): Promise<{ meta: { last_row_id?: number } }> => {
        return new Promise((resolve, reject) => {
          this.db.run(query, [], function(this: any, err: any) {
            if (err) reject(err);
            else resolve({ meta: { last_row_id: this.lastID } });
          });
        });
      }
    };
    return statement;
  }
}

// Interface genérica para banco de dados
interface DatabaseResult {
  success?: boolean;
  meta?: {
    last_row_id?: number;
    [key: string]: any;
  } | null;
  results?: any[];
  [key: string]: any;
}

interface DatabaseStatement {
  bind(...values: any[]): DatabaseStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  run(): Promise<DatabaseResult>;
  all(): Promise<DatabaseResult>;
}

interface Database {
  prepare(query: string): DatabaseStatement;
  [key: string]: any;
}

interface Env {
  DB: Database;
  JWT_SECRET?: string;
  SENDGRID_API_KEY?: string;
  FROM_EMAIL?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

// interface User {
//   id: number;
//   email: string;
//   password_hash: string;
//   name: string;
//   cpf_crm?: string;
//   user_type: string;
//   is_active: number;
//   email_verified: number;
//   created_at: string;
//   updated_at: string;
// }

// Inicializar banco SQLite para desenvolvimento
const initDatabase = () => {
  const dbPath = './database.sqlite';
  
  if (!existsSync(dbPath)) {
    console.log('Criando banco de dados SQLite...');
  }
  
  return new SQLiteAdapter(dbPath);
}

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Middleware para injetar o banco de dados
app.use('*', async (c, next) => {
  if (!c.env) {
    (c as any).env = {} as Env;
  }
  
  if (!c.env.DB) {
    (c.env as any).DB = initDatabase() as any;
  }
  
  // Carregar variáveis de ambiente do process.env
  (c.env as any).JWT_SECRET = process.env.JWT_SECRET;
  (c.env as any).SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  (c.env as any).FROM_EMAIL = process.env.FROM_EMAIL;
  (c.env as any).ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  (c.env as any).ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  (c.env as any).SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  (c.env as any).SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  await next();
});

// CORS middleware
app.use("*", cors({
  origin: (origin) => {
    return origin || "*";
  },
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposeHeaders: ["Set-Cookie"],
}));

// Sistema de autenticação: Supabase JWT com fallback para sessão (cookie)
const authMiddleware = async (c: Context<{ Bindings: Env; Variables: { user: any } }>, next: Next) => {
  // Modo de desenvolvimento - bypass de autenticação
  if (process.env.NODE_ENV === 'development' && c.req.header('x-dev-bypass-auth') === 'true') {
    const devUser = {
      id: 1,
      email: 'dev@medfatura.com',
      name: 'Desenvolvedor',
      user_type: 'admin',
      cpf_crm: 'DEV123'
    };
    c.set('user', devUser);
    await next();
    return;
  }

  // 1) Tentar validar via Supabase JWT (Authorization: Bearer <token>)
  try {
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (token) {
      const supabaseUrl = (c.env as any).SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = (c.env as any).SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        });

        if (resp.ok) {
          const supaUser: any = await resp.json();
          const email = supaUser?.email;

          if (email) {
            // Mapear usuário do Supabase para usuário local
            const localUser = await c.env.DB.prepare(
              'SELECT id, email, name, user_type, cpf_crm FROM users WHERE email = ? AND is_active = 1'
            ).bind(email).first();

            if (localUser) {
              c.set('user', localUser);
              await next();
              return;
            } else {
              return c.json({ error: 'Usuário não autorizado' }, 401);
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignorar e seguir para fallback
  }

  // 2) Fallback para sessão via cookie (mecanismo legado)
  const sessionId = getCookie(c, 'session_id');
  
  if (!sessionId) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  try {
    // Verificar sessão no banco de dados
    const session = await c.env.DB.prepare(
      'SELECT user_id FROM user_sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(sessionId).first();

    if (!session) {
      return c.json({ error: 'Sessão inválida ou expirada' }, 401);
    }

    // Buscar dados do usuário
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, user_type, cpf_crm FROM users WHERE id = ? AND is_active = 1'
    ).bind(session.user_id).first();

    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 401);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ error: 'Erro de autenticação' }, 401);
  }
};

// Schemas de validação simplificados
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf_crm: z.string().optional(),
  user_type: z.enum(['medico', 'admin', 'prestador']).default('medico'),
});

// Rotas de autenticação simplificadas
app.post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  try {
    // Buscar usuário no banco
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, user_type, cpf_crm, password_hash FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first() as any;

    if (!user) {
      return c.json({ error: 'Email ou senha incorretos' }, 401);
    }

    // Verificar senha (sem bcrypt - senha simples)
    if (password !== user.password_hash) {
      return c.json({ error: 'Email ou senha incorretos' }, 401);
    }

    // Gerar session ID simples
    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Criar sessão no banco (expira em 7 dias)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      'INSERT INTO user_sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, user.id, expiresAt).run();

    // Set cookie simples
    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return c.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        cpf_crm: user.cpf_crm,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

app.post('/api/auth/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name, cpf_crm, user_type } = c.req.valid('json');

  try {
    // Verificar se email já existe
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'Email já está em uso' }, 400);
    }

    // Inserir usuário com senha simples (sem hash)
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, cpf_crm, user_type, email_verified) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(email, password, name, cpf_crm || null, user_type, 1).run();

    return c.json({ 
      success: true, 
      message: 'Usuário criado com sucesso',
      userId: result.meta?.last_row_id || null
    });
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ error: 'Erro ao criar usuário' }, 500);
  }
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  return c.json(user);
});

// Get all users (admin only)
app.get('/api/users', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserRecord = await c.env.DB.prepare(
    "SELECT user_type FROM users WHERE id = ?"
  ).bind(user.id).first();
  
  if (!currentUserRecord || currentUserRecord.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem listar usuários' }, 403);
  }
  
  try {
    const result = await c.env.DB.prepare(
      "SELECT id, email, name, user_type, cpf_crm, is_active, created_at, updated_at FROM users ORDER BY name"
    ).bind().all();
    const results = result.results || [];
    return c.json(results);
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Erro ao buscar usuários' }, 500);
  }
});

// Toggle user active status (admin only)
app.patch('/api/users/:id/toggle-status', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserRecord = await c.env.DB.prepare(
    "SELECT user_type FROM users WHERE id = ?"
  ).bind(user.id).first();
  
  if (!currentUserRecord || currentUserRecord.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem alterar status de usuários' }, 403);
  }
  
  const userId = c.req.param('id');
  
  try {
    // Get current user status
    const targetUser = await c.env.DB.prepare(
      "SELECT id, is_active, user_type FROM users WHERE id = ?"
    ).bind(userId).first();
    
    if (!targetUser) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Prevent admin from deactivating themselves
    if (targetUser.id === user.id) {
      return c.json({ error: 'Você não pode desativar sua própria conta' }, 400);
    }
    
    // Toggle the status
    const newStatus = targetUser.is_active ? 0 : 1;
    
    await c.env.DB.prepare(
      "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(newStatus, userId).run();
    
    // If deactivating user, remove all their sessions
    if (newStatus === 0) {
      await c.env.DB.prepare(
        "DELETE FROM user_sessions WHERE user_id = ?"
      ).bind(userId).run();
    }
    
    return c.json({ 
      success: true, 
      message: newStatus ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso',
      is_active: newStatus
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    return c.json({ error: 'Erro ao alterar status do usuário' }, 500);
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserRecord = await c.env.DB.prepare(
    "SELECT user_type FROM users WHERE id = ?"
  ).bind(user.id).first();
  
  if (!currentUserRecord || currentUserRecord.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem deletar usuários' }, 403);
  }
  
  const userId = c.req.param('id');
  
  try {
    // Get target user
    const targetUser = await c.env.DB.prepare(
      "SELECT id, user_type, email FROM users WHERE id = ?"
    ).bind(userId).first();
    
    if (!targetUser) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Prevent admin from deleting themselves
    if (targetUser.id === user.id) {
      return c.json({ error: 'Você não pode deletar sua própria conta' }, 400);
    }
    
    // Delete user sessions first
    await c.env.DB.prepare(
      "DELETE FROM user_sessions WHERE user_id = ?"
    ).bind(userId).run();
    
    // Delete user profiles
    await c.env.DB.prepare(
      "DELETE FROM user_profiles WHERE user_id = ?"
    ).bind(userId).run();
    
    // Delete user invitations
    await c.env.DB.prepare(
      "DELETE FROM user_invitations WHERE invited_by_user_id = ?"
    ).bind(userId).run();
    
    // Delete user invoices
    await c.env.DB.prepare(
      "DELETE FROM invoices WHERE user_id = ?"
    ).bind(userId).run();
    
    // Finally delete the user
    await c.env.DB.prepare(
      "DELETE FROM users WHERE id = ?"
    ).bind(userId).run();
    
    return c.json({ 
      success: true, 
      message: `Usuário ${targetUser.email} deletado com sucesso`
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Erro ao deletar usuário' }, 500);
  }
});

app.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  
  if (sessionId) {
    // Remover sessão do banco
    await c.env.DB.prepare(
      'DELETE FROM user_sessions WHERE session_id = ?'
    ).bind(sessionId).run();
  }

  // Limpar cookie
  setCookie(c, 'session_id', '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  return c.json({ success: true });
});



// Generate a random token for invitations
function generateInvitationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Send invitation email with improved error handling
async function sendInvitationEmail(
  env: Env,
  recipientEmail: string, 
  recipientName: string, 
  inviteLink: string,
  userType: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'Chave API do SendGrid não configurada' };
  }

  if (!env.FROM_EMAIL) {
    console.error('FROM_EMAIL not configured');
    return { success: false, error: 'Email remetente não configurado' };
  }

  // Validate API key format
  if (!env.SENDGRID_API_KEY.startsWith('SG.')) {
    console.error('Invalid SendGrid API key format');
    return { success: false, error: 'Formato inválido da chave API do SendGrid' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(env.FROM_EMAIL)) {
    console.error('Invalid FROM_EMAIL format:', env.FROM_EMAIL);
    return { success: false, error: 'Formato inválido do email remetente' };
  }

  if (!emailRegex.test(recipientEmail)) {
    console.error('Invalid recipient email format:', recipientEmail);
    return { success: false, error: 'Formato inválido do email destinatário' };
  }

  sgMail.setApiKey(env.SENDGRID_API_KEY);
  
  console.log('Attempting to send email to:', recipientEmail, 'from:', env.FROM_EMAIL);

  const msg = {
    to: [{ email: recipientEmail, name: recipientName }],
    from: { 
      email: env.FROM_EMAIL,
      name: 'MedFatura - Sistema de Gestão'
    },
    subject: 'Convite para MedFatura - Sistema de Gestão de Faturas Médicas',
    reply_to: { email: env.FROM_EMAIL },
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite MedFatura</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">MedFatura</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Sistema de Gestão de Faturas Médicas</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937; margin-top: 0;">Olá, ${recipientName}!</h2>
          
          <p>Você foi convidado para usar o <strong>MedFatura</strong>, nosso sistema de gestão de faturas médicas.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalhes do seu acesso:</h3>
            <p><strong>Email:</strong> ${recipientEmail}</p>
            <p><strong>Tipo de usuário:</strong> ${userType === 'medico' ? 'Médico' : 'Administrador'}</p>
          </div>
          
          <p>Para ativar sua conta e começar a usar o sistema, clique no botão abaixo:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background: linear-gradient(135deg, #2563eb 0%, #16a34a 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: bold; 
                      display: inline-block;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              Aceitar Convite e Acessar Sistema
            </a>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>⚠️ Importante:</strong> Este convite expira em 7 dias. Não é necessário ter conta Google para acessar.</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #6b7280;">
            Se você não conseguir clicar no botão, copie e cole este link no seu navegador:<br>
            <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Se você não solicitou este convite, pode ignorar este email com segurança.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
          <p>© 2024 MedFatura. Todos os direitos reservados.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Olá, ${recipientName}!
      
      Você foi convidado para usar o MedFatura, nosso sistema de gestão de faturas médicas.
      
      Detalhes do seu acesso:
      - Email: ${recipientEmail}
      - Tipo de usuário: ${userType === 'medico' ? 'Médico' : 'Administrador'}
      
      Para ativar sua conta, acesse este link: ${inviteLink}
      
      IMPORTANTE: Este convite expira em 7 dias. Não é necessário ter conta Google para acessar.
      
      Se você não solicitou este convite, pode ignorar este email com segurança.
      
      © 2024 MedFatura. Todos os direitos reservados.
    `
  };

  try {
    console.log('Sending email with SendGrid...');
    const response = await sgMail.send(msg);
    console.log('SendGrid response status:', response[0]?.statusCode);
    console.log('Invitation email sent successfully to:', recipientEmail);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending invitation email:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      response: error?.response?.body
    });
    
    let errorMessage = 'Erro ao enviar email de convite';
    
    if (error?.code === 403) {
      errorMessage = 'Chave de API do SendGrid inválida ou sem permissões. Verifique se a chave tem permissão "Mail Send".';
    } else if (error?.code === 401) {
      errorMessage = 'Chave de API do SendGrid não autorizada. Verifique se a chave está correta.';
    } else if (error?.code === 400) {
      errorMessage = 'Dados do email inválidos. Verifique o email remetente e destinatário.';
    } else if (error?.response?.body?.errors) {
      const sendGridErrors = error.response.body.errors;
      if (Array.isArray(sendGridErrors) && sendGridErrors.length > 0) {
        const firstError = sendGridErrors[0];
        errorMessage = `SendGrid: ${(firstError as any)?.message || firstError}`;
        if (firstError.field) {
          errorMessage += ` (campo: ${firstError.field})`;
        }
      }
    } else if (error?.message) {
      errorMessage = `Erro de rede: ${(error as any)?.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

// Invitations routes
app.get('/api/invitations/validate', async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.json({ error: 'Token é obrigatório' }, 400);
  }
  
  try {
    const invitation = await c.env.DB.prepare(
      "SELECT * FROM user_invitations WHERE invitation_token = ?"
    ).bind(token).first();
    
    if (!invitation) {
      return c.json({ error: 'Convite não encontrado' }, 404);
    }
    
    return c.json(invitation);
  } catch (error) {
    console.error('Error validating invitation:', error);
    return c.json({ error: 'Erro ao validar convite' }, 500);
  }
});

app.post('/api/invitations/accept', async (c) => {
  const { token } = await c.req.json();
  
  if (!token) {
    return c.json({ error: 'Token é obrigatório' }, 400);
  }
  
  try {
    const invitation = await c.env.DB.prepare(
      "SELECT * FROM user_invitations WHERE invitation_token = ?"
    ).bind(token).first();
    
    if (!invitation) {
      return c.json({ error: 'Convite não encontrado' }, 404);
    }
    
    if (invitation.is_used) {
      return c.json({ error: 'Convite já foi utilizado' }, 400);
    }
    
    if (new Date(invitation.expires_at as string) < new Date()) {
      return c.json({ error: 'Convite expirado' }, 400);
    }
    
    // Check if profile already exists
    const existingProfile = await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE cpf_crm = ?"
    ).bind(invitation.cpf_crm).first();
    
    if (existingProfile) {
      return c.json({ error: 'Usuário já existe com este CPF/CRM' }, 400);
    }
    
    // Create user profile with a temporary user_id (will be updated when user logs in with Google)
    const tempUserId = `temp_${invitation.invitation_token}`;
    
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (user_id, name, cpf_crm, user_type) VALUES (?, ?, ?, ?)"
    ).bind(tempUserId, invitation.name, invitation.cpf_crm, invitation.user_type).run();
    
    // Mark invitation as used
    await c.env.DB.prepare(
      "UPDATE user_invitations SET is_used = 1, updated_at = CURRENT_TIMESTAMP WHERE invitation_token = ?"
    ).bind(token).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: 'Erro ao aceitar convite' }, 500);
  }
});

const InvitationSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
  cpf_crm: z.string().min(1, "CPF/CRM é obrigatório"),
  user_type: z.enum(['medico', 'admin', 'prestador'], {
    errorMap: () => ({ message: "Tipo deve ser 'medico', 'admin' ou 'prestador'" })
  }),
});

app.post('/api/invitations', authMiddleware, zValidator('json', InvitationSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserProfile = await c.env.DB.prepare(
    "SELECT user_type FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first();
  
  if (!currentUserProfile || currentUserProfile.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem enviar convites' }, 403);
  }
  
  const { email, name, cpf_crm, user_type } = c.req.valid('json');
  
  try {
    // Check if user already exists
    const existingProfile = await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE cpf_crm = ?"
    ).bind(cpf_crm).first();
    
    if (existingProfile) {
      return c.json({ error: 'Usuário já existe com este CPF/CRM' }, 400);
    }
    
    // Check if there's already a pending invitation
    const existingInvitation = await c.env.DB.prepare(
      "SELECT id FROM user_invitations WHERE (email = ? OR cpf_crm = ?) AND is_used = 0 AND expires_at > datetime('now')"
    ).bind(email, cpf_crm).first();
    
    if (existingInvitation) {
      return c.json({ error: 'Já existe um convite pendente para este email ou CPF/CRM' }, 400);
    }
    
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
    
    const result = await c.env.DB.prepare(
      "INSERT INTO user_invitations (email, name, cpf_crm, user_type, invitation_token, invited_by_user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(email, name, cpf_crm, user_type, token, user.id, expiresAt.toISOString()).run();
    
    const newInvitation = await c.env.DB.prepare(
      "SELECT * FROM user_invitations WHERE id = ?"
    ).bind(result.meta?.last_row_id).first();
    
    // Build proper invite link using request headers to get the correct domain
    const protocol = c.req.header('X-Forwarded-Proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const host = c.req.header('Host') || c.req.header('X-Forwarded-Host') || (process.env.NODE_ENV === 'production' ? 'your-domain.com' : 'localhost:3000');
    const inviteLink = `${protocol}://${host}/invite?token=${token}`;
    
    // Send invitation email
    const emailResult = await sendInvitationEmail(
      c.env,
      email,
      name,
      inviteLink,
      user_type
    );
    
    const response: any = {
      ...newInvitation,
      invitation_link: inviteLink,
      email_sent: emailResult.success
    };
    
    if (!emailResult.success) {
      response.email_error = emailResult.error;
      console.log('Email sending failed for:', email, 'Error:', emailResult.error);
    } else {
      console.log('Email invitation sent successfully to:', email);
    }
    
    return c.json(response, 201);
  } catch (error) {
    console.error('Error creating invitation:', error);
    return c.json({ error: 'Erro ao criar convite' }, 500);
  }
});

app.get('/api/invitations', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserProfile = await c.env.DB.prepare(
    "SELECT user_type FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first();
  
  if (!currentUserProfile || currentUserProfile.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem ver convites' }, 403);
  }
  
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM user_invitations ORDER BY created_at DESC"
    ).all();
    const results = result.results || [];
    
    return c.json(results);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return c.json({ error: 'Erro ao buscar convites' }, 500);
  }
});

app.post('/api/invitations/:id/resend', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  // Check if current user is admin
  const currentUserProfile = await c.env.DB.prepare(
    "SELECT user_type FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).first();
  
  if (!currentUserProfile || currentUserProfile.user_type !== 'admin') {
    return c.json({ error: 'Apenas administradores podem reenviar convites' }, 403);
  }
  
  const invitationId = c.req.param('id');
  
  try {
    const invitation = await c.env.DB.prepare(
      "SELECT * FROM user_invitations WHERE id = ?"
    ).bind(invitationId).first();
    
    if (!invitation) {
      return c.json({ error: 'Convite não encontrado' }, 404);
    }
    
    if (invitation.is_used) {
      return c.json({ error: 'Convite já foi utilizado' }, 400);
    }
    
    if (new Date(invitation.expires_at as string) < new Date()) {
      return c.json({ error: 'Convite expirado. Crie um novo convite.' }, 400);
    }
    
    // Build proper invite link using request headers to get the correct domain
    const protocol = c.req.header('X-Forwarded-Proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const host = c.req.header('Host') || c.req.header('X-Forwarded-Host') || (process.env.NODE_ENV === 'production' ? 'your-domain.com' : 'localhost:3000');
    const inviteLink = `${protocol}://${host}/invite?token=${invitation.invitation_token}`;
    
    // Resend invitation email
    const emailResult = await sendInvitationEmail(
      c.env,
      invitation.email as string,
      invitation.name as string,
      inviteLink,
      invitation.user_type as string
    );
    
    if (emailResult.success) {
      console.log('Invitation email resent successfully to:', invitation.email);
      return c.json({ 
        success: true, 
        message: 'Convite reenviado com sucesso!',
        invitation_link: inviteLink,
        email_sent: true
      });
    } else {
      console.error('Error resending invitation email:', emailResult.error);
      return c.json({ 
        success: true,
        message: 'Convite criado, mas email não pôde ser enviado. Use o link abaixo:',
        invitation_link: inviteLink,
        email_sent: false,
        email_error: emailResult.error
      });
    }
  } catch (error) {
    console.error('Error resending invitation:', error);
    return c.json({ error: 'Erro ao reenviar convite' }, 500);
  }
});

// User profiles routes
app.get('/api/profiles', authMiddleware, async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "SELECT * FROM user_profiles ORDER BY created_at DESC"
    ).all();
    const results = result.results || [];
    
    return c.json(results);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return c.json({ error: 'Failed to fetch profiles' }, 500);
  }
});

app.get('/api/profiles/me', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  try {
    const profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first();
    
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    
    return c.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

const ProfileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cpf_crm: z.string().min(1, "CPF/CRM é obrigatório"),
  user_type: z.enum(['medico', 'admin', 'prestador'], {
    errorMap: () => ({ message: "Tipo deve ser 'medico', 'admin' ou 'prestador'" })
  }),
});

app.post('/api/profiles', authMiddleware, zValidator('json', ProfileSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const { name, cpf_crm, user_type } = c.req.valid('json');
  
  try {
    // Check if profile already exists
    const existingProfile = await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first();
    
    if (existingProfile) {
      return c.json({ error: 'Perfil já existe para este usuário' }, 400);
    }
    
    const result = await c.env.DB.prepare(
      "INSERT INTO user_profiles (user_id, name, cpf_crm, user_type) VALUES (?, ?, ?, ?)"
    ).bind(user.id, name, cpf_crm, user_type).run();
    
    const newProfile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE id = ?"
    ).bind(result.meta?.last_row_id).first();
    
    return c.json(newProfile, 201);
  } catch (error) {
    console.error('Error creating profile:', error);
    return c.json({ error: 'Failed to create profile' }, 500);
  }
});

app.put('/api/profiles/:id', authMiddleware, zValidator('json', ProfileSchema.partial()), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const profileId = c.req.param('id');
  const updates = c.req.valid('json');
  
  try {
    // Check if profile belongs to user or user is admin
    const profile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE id = ?"
    ).bind(profileId).first();
    
    if (!profile) {
      return c.json({ error: 'Perfil não encontrado' }, 404);
    }
    
    if (profile.user_id !== user.id) {
      // Check if current user is admin
      const currentUserProfile = await c.env.DB.prepare(
        "SELECT user_type FROM user_profiles WHERE user_id = ?"
      ).bind(user.id).first();
      
      if (!currentUserProfile || currentUserProfile.user_type !== 'admin') {
        return c.json({ error: 'Não autorizado' }, 403);
      }
    }
    
    const updateFields = [];
    const values = [];
    
    if (updates.name) {
      updateFields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.cpf_crm) {
      updateFields.push("cpf_crm = ?");
      values.push(updates.cpf_crm);
    }
    if (updates.user_type) {
      updateFields.push("user_type = ?");
      values.push(updates.user_type);
    }
    
    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(profileId);
    
    await c.env.DB.prepare(
      `UPDATE user_profiles SET ${updateFields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    
    const updatedProfile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE id = ?"
    ).bind(profileId).first();
    
    return c.json(updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Invoices routes
app.get('/api/invoices', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = !!userRecord && userRecord.user_type === 'admin';
    
    let query = "SELECT id, user_id, month, year, original_filename, stored_filename, file_size, status, created_at, updated_at FROM invoices WHERE 1=1";
    const params: any[] = [];

    // Filtro de visibilidade por papel
    if (isAdmin) {
      query += " AND (deleted_by_admin = 0 OR deleted_by_admin IS NULL)";
    } else {
      query += " AND user_id = ? AND (deleted_by_user = 0 OR deleted_by_user IS NULL)";
      params.push(user.id);
    }
    
    query += " ORDER BY created_at DESC";
    const result = await c.env.DB.prepare(query).bind(...params).all();
    const results = result.results || [];
    return c.json(results);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return c.json({ error: 'Failed to fetch invoices' }, 500);
  }
});

// Download invoice endpoint
app.get('/api/invoices/:id/download', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const invoiceId = c.req.param('id');
  try {
    const invoice = await c.env.DB.prepare(
      "SELECT * FROM invoices WHERE id = ?"
    ).bind(invoiceId).first();

    if (!invoice) {
      return c.json({ error: 'Fatura não encontrada' }, 404);
    }

    // Determinar papel do usuário de forma consistente (usar tabela users, igual à listagem)
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = !!userRecord && userRecord.user_type === 'admin';

    // Logs de diagnóstico de autorização
    try {
      console.log('Auth check download', { invoiceUserId: invoice.user_id, requestUserId: user.id, isAdmin });
    } catch {}

    // Visibilidade respeitando soft-delete
    if (isAdmin) {
      if (invoice.deleted_by_admin) return c.json({ error: 'Fatura removida pelo administrador' }, 404);
    } else {
      if (Number(invoice.user_id) !== Number(user.id)) return c.json({ error: 'Não autorizado' }, 403);
      if (invoice.deleted_by_user) return c.json({ error: 'Fatura removida pelo usuário' }, 404);
    }

    if (!invoice.file_data) {
      return c.json({ error: 'Arquivo não encontrado no banco de dados' }, 404);
    }

    // Normalizar base64 (remover prefixo data URL, espaços e quebras de linha)
    let base64Data = String(invoice.file_data);
    if (base64Data.startsWith('data:')) {
      const idx = base64Data.indexOf(',');
      if (idx !== -1) base64Data = base64Data.slice(idx + 1);
    }
    base64Data = base64Data.replace(/\s+/g, '');

    // Converte o base64 de volta para um buffer binário de forma segura
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Logs diagnósticos
    try {
      const signatureAscii = fileBuffer.subarray(0, 5).toString('ascii');
      console.log('Download diagnostics', {
        invoiceId,
        base64Length: base64Data.length,
        bufferLength: fileBuffer.length,
        storedSize: invoice.file_size,
        signatureAscii,
      });
    } catch {}
    
    // Usar Response diretamente para melhor compatibilidade
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.stored_filename}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error downloading invoice:', error);
    return c.json({ error: 'Erro ao baixar arquivo' }, 500);
  }
});

const InvoiceSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
  original_filename: z.string().min(1, "Nome do arquivo é obrigatório"),
  stored_filename: z.string().min(1, "Nome armazenado é obrigatório"),
  file_size: z.number().int().positive(),
  status: z.enum(['recebido', 'pendente']).optional(),
});

app.post('/api/invoices', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  try {
    // Get user profile to validate user type
    const userProfile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).first();
    
    if (!userProfile) {
      return c.json({ error: 'Perfil do usuário não encontrado' }, 404);
    }
    
    if (userProfile.user_type !== 'medico') {
      return c.json({ error: 'Apenas médicos podem enviar faturas' }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const month = parseInt(formData.get('month') as string);
    const year = parseInt(formData.get('year') as string);
    const original_filename = formData.get('original_filename') as string;
    const stored_filename = formData.get('stored_filename') as string;

    if (!file) {
      return c.json({ error: 'Arquivo é obrigatório' }, 400);
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return c.json({ error: 'Apenas arquivos PDF são permitidos' }, 400);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'Arquivo deve ter no máximo 10MB' }, 400);
    }

    // Check for duplicate invoice for same month/year (ignora faturas deletadas pelo usuário)
    const existingInvoice = await c.env.DB.prepare(
      "SELECT id FROM invoices WHERE user_id = ? AND month = ? AND year = ? AND (deleted_by_user = 0 OR deleted_by_user IS NULL) AND (deleted_by_admin = 0 OR deleted_by_admin IS NULL)"
    ).bind(user.id, month, year).first();
    
    if (existingInvoice) {
      return c.json({ error: 'Já existe uma fatura para este mês/ano' }, 400);
    }

    // Store file data as base64 for now (in production would use R2 or similar)
    const fileBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to base64 using Web APIs (compatible with Cloudflare Workers)
    const bytes = new Uint8Array(fileBuffer);
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const fileData = btoa(binaryString);

    const result = await c.env.DB.prepare(
      "INSERT INTO invoices (user_id, month, year, original_filename, stored_filename, file_size, file_data, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(user.id, month, year, original_filename, stored_filename, file.size, fileData, 'recebido').run();
    
    const newInvoice = await c.env.DB.prepare(
      "SELECT id, user_id, month, year, original_filename, stored_filename, file_size, status, created_at, updated_at FROM invoices WHERE id = ?"
    ).bind(result.meta?.last_row_id).first();
    
    return c.json(newInvoice, 201);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return c.json({ error: 'Failed to create invoice' }, 500);
  }
});

app.put('/api/invoices/:id', authMiddleware, zValidator('json', InvoiceSchema.partial()), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const invoiceId = c.req.param('id');
  const updates = c.req.valid('json');
  
  try {
    // Check if invoice belongs to user or user is admin
    const invoice = await c.env.DB.prepare(
      "SELECT * FROM invoices WHERE id = ?"
    ).bind(invoiceId).first();
    
    if (!invoice) {
      return c.json({ error: 'Fatura não encontrada' }, 404);
    }
    
    if (Number(invoice.user_id) !== Number(user.id)) {
      // Check if current user is admin
      const currentUserRecord = await c.env.DB.prepare(
        "SELECT user_type FROM users WHERE id = ?"
      ).bind(user.id).first();
      
      if (!currentUserRecord || currentUserRecord.user_type !== 'admin') {
        return c.json({ error: 'Não autorizado' }, 403);
      }
    }
    
    const updateFields: string[] = [];
    const values: any[] = [];
    
    const allowedFields = ['month', 'year', 'original_filename', 'stored_filename', 'file_size', 'status'];
    allowedFields.forEach(key => {
      if (key in updates && updates[key as keyof typeof updates] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key as keyof typeof updates]);
      }
    });
    
    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(invoiceId);
    
    await c.env.DB.prepare(
      `UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    
    const updatedInvoice = await c.env.DB.prepare(
      "SELECT * FROM invoices WHERE id = ?"
    ).bind(invoiceId).first();
    
    return c.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return c.json({ error: 'Failed to update invoice' }, 500);
  }
});

app.delete('/api/invoices/:id', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const invoiceId = c.req.param('id');
  
  try {
    // Check if invoice belongs to user or user is admin
    const invoice = await c.env.DB.prepare(
      "SELECT * FROM invoices WHERE id = ?"
    ).bind(invoiceId).first();
    
    if (!invoice) {
      return c.json({ error: 'Fatura não encontrada' }, 404);
    }
    
    const currentUserRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = currentUserRecord && currentUserRecord.user_type === 'admin';

    // Aplicar soft-delete consistente para ambos os papéis
    if (isAdmin) {
      await c.env.DB.prepare(
        "UPDATE invoices SET deleted_by_admin = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(invoiceId).run();
    } else {
      try { console.log('Auth check delete', { invoiceUserId: invoice.user_id, requestUserId: user.id, isAdmin }); } catch {}
      if (Number(invoice.user_id) !== Number(user.id)) return c.json({ error: 'Não autorizado' }, 403);
      // Usar soft-delete também para usuários (médico/prestador)
      await c.env.DB.prepare(
        "UPDATE invoices SET deleted_by_user = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
      ).bind(invoiceId, user.id).run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return c.json({ error: 'Failed to delete invoice' }, 500);
  }
});

// Pending doctors endpoint
app.get('/api/pending-doctors', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    
    const isAdmin = userRecord && userRecord.user_type === 'admin';
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const dayOfMonth = currentDate.getDate();
    
    // Só mostrar como pendente após o dia 11 (ou seja, a partir do dia 11)
    // Médicos têm até o dia 10 para enviar
    if (dayOfMonth <= 10) {
      // Se ainda não passou do dia 10, não há pendentes para este mês
      return c.json([]);
    }
    
    let query = `
      SELECT u.id, u.name, u.user_type, u.cpf_crm, u.is_active, u.created_at, u.updated_at
      FROM users u 
      WHERE (u.user_type = 'medico' OR u.user_type = 'prestador') AND u.is_active = 1 
      AND u.id NOT IN (
        SELECT DISTINCT i.user_id FROM invoices i 
        WHERE i.month = ? AND i.year = ?
      )
    `;
    let params: (string | number)[] = [currentMonth, currentYear];
    
    if (!isAdmin) {
      query += " AND u.id = ?";
      params.push(user.id);
    }
    
    query += " ORDER BY u.name";
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    const results = result.results || [];
    return c.json(results);
  } catch (error) {
    console.error('Error fetching pending doctors:', error);
    return c.json({ error: 'Failed to fetch pending doctors' }, 500);
  }
});

// Endpoint para buscar faturas pendentes (para o modal)
app.get('/api/pending-invoices', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    
    const isAdmin = userRecord && userRecord.user_type === 'admin';
    const url = new URL(c.req.url);
    const currentParam = url.searchParams.get('current');
    const isCurrentPeriod = currentParam === 'true';
    
    let monthFilter: number | null = null;
    let yearFilter: number | null = null;
    
    if (isCurrentPeriod) {
      const currentDate = new Date();
      monthFilter = currentDate.getMonth() + 1;
      yearFilter = currentDate.getFullYear();
    }

    const pendingInvoices = [];

    // 1. Buscar faturas com status 'pendente'
    let invoiceQuery = `
      SELECT i.id, i.month, i.year, i.original_filename, i.stored_filename, 
             i.status, i.created_at, i.user_id, u.name as user_name,
             'direct' as type
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      WHERE i.status = 'pendente' AND i.deleted_at IS NULL
    `;
    let invoiceParams: any[] = [];

    if (monthFilter && yearFilter) {
      invoiceQuery += " AND i.month = ? AND i.year = ?";
      invoiceParams.push(monthFilter, yearFilter);
    }

    if (!isAdmin) {
      invoiceQuery += " AND i.user_id = ?";
      invoiceParams.push(user.id);
    }

    invoiceQuery += " ORDER BY i.created_at DESC";

    const invoiceResult = await c.env.DB.prepare(invoiceQuery).bind(...invoiceParams).all();
    if (invoiceResult.results) {
      pendingInvoices.push(...invoiceResult.results);
    }

    // 2. Buscar cobranças pendentes
    let pendingQuery = `
      SELECT pp.id, pp.month, pp.year, pp.description as original_filename,
             pp.invoice_stored_filename as stored_filename, pp.status,
             pp.created_at, pp.user_id, u.name as user_name, pp.amount,
             pp.description, pp.notes, pp.invoice_filename,
             'pending' as type
      FROM pending_payments pp
      JOIN users u ON pp.user_id = u.id
      WHERE pp.status = 'pending'
    `;
    let pendingParams: any[] = [];

    if (monthFilter && yearFilter) {
      pendingQuery += " AND pp.month = ? AND pp.year = ?";
      pendingParams.push(monthFilter, yearFilter);
    }

    if (!isAdmin) {
      pendingQuery += " AND pp.user_id = ?";
      pendingParams.push(user.id);
    }

    pendingQuery += " ORDER BY pp.created_at DESC";

    const pendingResult = await c.env.DB.prepare(pendingQuery).bind(...pendingParams).all();
    if (pendingResult.results) {
      pendingInvoices.push(...pendingResult.results);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    pendingInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json(pendingInvoices);
  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    return c.json({ error: 'Failed to fetch pending invoices' }, 500);
  }
});

// Statistics endpoint
app.get('/api/stats', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  
  try {
    console.log('Stats endpoint called for user:', user.id, user.email);
    
    // Check if user is admin using the SQLite adapter
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    
    console.log('User record:', userRecord);
    
    const isAdmin = userRecord && userRecord.user_type === 'admin';
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const dayOfMonth = currentDate.getDate();
    
    // Parse optional month/year filters from query params
    const filterMonth = c.req.query('month') ? parseInt(c.req.query('month')!) : null;
    const filterYear = c.req.query('year') ? parseInt(c.req.query('year')!) : null;
    const useCurrentPeriod = c.req.query('current') === 'true';
    
    // If current=true, use current month/year; otherwise use provided filters or no filter
    let targetMonth = null;
    let targetYear = null;
    
    if (useCurrentPeriod) {
      targetMonth = currentMonth;
      targetYear = currentYear;
    } else if (filterMonth && filterYear) {
      targetMonth = filterMonth;
      targetYear = filterYear;
    }
    
    console.log('Current month/year/day:', currentMonth, currentYear, dayOfMonth);
    console.log('Filter month/year:', targetMonth, targetYear);
    console.log('Is admin:', isAdmin);
    
    // Get total invoices (respeitando soft-delete e o papel do usuário)
    let invoiceQuery = "SELECT COUNT(*) as total FROM invoices WHERE 1=1";
    let invoiceParams: any[] = [];
    
    if (isAdmin) {
      invoiceQuery += " AND (deleted_by_admin = 0 OR deleted_by_admin IS NULL)";
    } else {
      invoiceQuery += " AND user_id = ? AND (deleted_by_user = 0 OR deleted_by_user IS NULL)";
      invoiceParams.push(user.id);
    }
    
    // Apply month/year filter if specified
    if (targetMonth && targetYear) {
      invoiceQuery += " AND month = ? AND year = ?";
      invoiceParams.push(targetMonth, targetYear);
    }
    
    console.log('Invoice query:', invoiceQuery, invoiceParams);
    const invoiceStats = await c.env.DB.prepare(invoiceQuery)
      .bind(...invoiceParams).first();
    console.log('Invoice stats:', invoiceStats);
    
    // Get total active users
    const userStats = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM users WHERE is_active = 1"
    ).bind().first();
    console.log('User stats:', userStats);
    
    // Calculate pending invoices (faturas com status pendente)
    let pendingInvoicesQuery = "SELECT COUNT(*) as total FROM invoices WHERE status = 'pendente'";
    let pendingInvoicesParams: any[] = [];
    
    if (isAdmin) {
      pendingInvoicesQuery += " AND (deleted_by_admin = 0 OR deleted_by_admin IS NULL)";
    } else {
      pendingInvoicesQuery += " AND user_id = ? AND (deleted_by_user = 0 OR deleted_by_user IS NULL)";
      pendingInvoicesParams.push(user.id);
    }
    
    if (targetMonth && targetYear) {
      pendingInvoicesQuery += " AND month = ? AND year = ?";
      pendingInvoicesParams.push(targetMonth, targetYear);
    }
    
    // Calculate pending payments (cobranças pendentes)
    let pendingPaymentsQuery = "SELECT COUNT(*) as total FROM pending_payments WHERE status = 'pending'";
    let pendingPaymentsParams = [];
    
    if (!isAdmin) {
      pendingPaymentsQuery += " AND user_id = ?";
      pendingPaymentsParams.push(user.id);
    }
    
    if (targetMonth && targetYear) {
      pendingPaymentsQuery += " AND month = ? AND year = ?";
      pendingPaymentsParams.push(targetMonth, targetYear);
    }
    
    console.log('Pending invoices query:', pendingInvoicesQuery, pendingInvoicesParams);
    console.log('Pending payments query:', pendingPaymentsQuery, pendingPaymentsParams);
    
    const [pendingInvoicesStats, pendingPaymentsStats] = await Promise.all([
      c.env.DB.prepare(pendingInvoicesQuery).bind(...pendingInvoicesParams).first(),
      c.env.DB.prepare(pendingPaymentsQuery).bind(...pendingPaymentsParams).first()
    ]);
    
    console.log('Pending invoices stats:', pendingInvoicesStats);
    console.log('Pending payments stats:', pendingPaymentsStats);
    
    let pendingInvoices = Number(pendingInvoicesStats?.total || 0) + Number(pendingPaymentsStats?.total || 0);
    
    const totalInvoices = Number(invoiceStats?.total || 0);
    const activeUsers = isAdmin ? Number(userStats?.total || 0) : 1;
    
    const result = {
      totalInvoices,
      pendingInvoices,
      activeUsers
    };
    
    console.log('Final result:', result);
    return c.json(result);
  } catch (error) {
    console.error('Detailed error in stats endpoint:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Admin-only: audit invoices file_data integrity
app.get('/api/admin/invoices-audit', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = !!userRecord && userRecord.user_type === 'admin';
    if (!isAdmin) {
      return c.json({ error: 'Não autorizado' }, 403);
    }

    const rs = await c.env.DB.prepare(
      "SELECT id, stored_filename, file_size, file_data FROM invoices WHERE file_data IS NOT NULL"
    ).bind().all();

    const rows = (rs.results || []) as Array<any>;

    const items = rows.map((row) => {
      const original: string = String(row.file_data ?? '');
      const hasDataUrlPrefix = original.startsWith('data:');
      const hasWhitespace = /\s/.test(original);

      // normalize base64 (remove data url prefix and whitespace)
      let base64 = original;
      if (hasDataUrlPrefix) {
        const idx = base64.indexOf(',');
        if (idx !== -1) base64 = base64.slice(idx + 1);
      }
      base64 = base64.replace(/\s+/g, '');

      let bufferLength = 0;
      let signatureAscii = '';
      let validBase64 = true;
      try {
        const buf = Buffer.from(base64, 'base64');
        bufferLength = buf.length;
        signatureAscii = buf.subarray(0, 5).toString('ascii');
      } catch (e) {
        validBase64 = false;
      }

      const hasSizeMismatch = typeof row.file_size === 'number' && bufferLength !== Number(row.file_size);

      return {
        id: row.id,
        stored_filename: row.stored_filename,
        file_size: row.file_size,
        base64Length: base64.length,
        bufferLength,
        signatureAscii,
        hasDataUrlPrefix,
        hasWhitespace,
        hasSizeMismatch,
        validBase64
      };
    });

    const summary = {
      total: items.length,
      invalidCount: items.filter(i => !i.validBase64).length,
      mismatchedSizeCount: items.filter(i => i.hasSizeMismatch).length,
      hasPrefixCount: items.filter(i => i.hasDataUrlPrefix).length,
      hasWhitespaceCount: items.filter(i => i.hasWhitespace).length,
    };

    return c.json({ summary, items });
  } catch (error) {
    console.error('Error auditing invoices:', error);
    return c.json({ error: 'Failed to audit invoices' }, 500);
  }
});

// Admin-only: normalize a single invoice file_data and fix file_size if needed
app.post('/api/admin/invoices/:id/normalize', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401);
  }
  const invoiceId = c.req.param('id');
  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = !!userRecord && userRecord.user_type === 'admin';
    if (!isAdmin) {
      return c.json({ error: 'Não autorizado' }, 403);
    }

    const invoice = await c.env.DB.prepare(
      "SELECT id, file_size, file_data FROM invoices WHERE id = ?"
    ).bind(invoiceId).first();

    if (!invoice || !invoice.file_data) {
      return c.json({ error: 'Fatura não encontrada ou sem dados de arquivo' }, 404);
    }

    let original: string = String(invoice.file_data);
    const hadPrefix = original.startsWith('data:');
    const hadWhitespace = /\s/.test(original);

    // normalize base64
    if (hadPrefix) {
      const idx = original.indexOf(',');
      if (idx !== -1) original = original.slice(idx + 1);
    }
    let normalized = original.replace(/\s+/g, '');

    // ensure canonical base64 (re-encode)
    const buf = Buffer.from(normalized, 'base64');
    normalized = Buffer.from(buf).toString('base64');

    const newSize = buf.length;
    const signatureAscii = buf.subarray(0, 5).toString('ascii');

    await c.env.DB.prepare(
      "UPDATE invoices SET file_data = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(normalized, newSize, invoiceId).run();

    return c.json({ id: invoiceId, updated: true, hadPrefix, hadWhitespace, newSize, signatureAscii });
  } catch (error) {
    console.error('Error normalizing invoice file_data:', error);
    return c.json({ error: 'Failed to normalize invoice' }, 500);
  }
});

// Admin-only: normalize all invoices with anomalies (optional bulk fix)
app.post('/api/admin/invoices/normalize-all', authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: 'User not authenticated' }, 401);
  try {
    const userRecord = await c.env.DB.prepare(
      "SELECT user_type FROM users WHERE id = ?"
    ).bind(user.id).first();
    const isAdmin = !!userRecord && userRecord.user_type === 'admin';
    if (!isAdmin) return c.json({ error: 'Não autorizado' }, 403);

    const rs = await c.env.DB.prepare(
      "SELECT id, file_size, file_data FROM invoices WHERE file_data IS NOT NULL"
    ).bind().all();
    const rows = (rs.results || []) as Array<any>;

    let processed = 0;
    let updated = 0;

    for (const row of rows) {
      processed++;
      let data: string = String(row.file_data ?? '');
      const hadPrefix = data.startsWith('data:');
      const hadWhitespace = /\s/.test(data);

      let base64 = data;
      if (hadPrefix) {
        const idx = base64.indexOf(',');
        if (idx !== -1) base64 = base64.slice(idx + 1);
      }
      base64 = base64.replace(/\s+/g, '');

      let buf: Buffer;
      try {
        buf = Buffer.from(base64, 'base64');
      } catch {
        continue;
      }

      const canonical = Buffer.from(buf).toString('base64');
      const newSize = buf.length;

      const needsUpdate = hadPrefix || hadWhitespace || Number(row.file_size) !== newSize || canonical !== base64;

      if (needsUpdate) {
        await c.env.DB.prepare(
          "UPDATE invoices SET file_data = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(canonical, newSize, row.id).run();
        updated++;
      }
    }

    return c.json({ processed, updated });
  } catch (error) {
    console.error('Error normalizing all invoices:', error);
    return c.json({ error: 'Failed to normalize all invoices' }, 500);
  }
});

// ===== SISTEMA DE PENDÊNCIAS FINANCEIRAS =====

// Schema para validação de pendências
const PendingPaymentSchema = z.object({
  user_id: z.number(),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  notes: z.string().optional()
});

// Criar nova pendência (Admin apenas)
app.post('/api/pending-payments', authMiddleware, zValidator('json', PendingPaymentSchema), async (c) => {
  const user = c.get('user');
  if (!user || user.user_type !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  const { user_id, amount, description, month, year, notes } = c.req.valid('json');

  try {
    // Verificar se o usuário existe e é médico
    const targetUser = await c.env.DB.prepare(
      'SELECT id, name, email FROM users WHERE id = ? AND user_type = "medico" AND is_active = 1'
    ).bind(user_id).first();

    if (!targetUser) {
      return c.json({ error: 'Médico não encontrado' }, 404);
    }

    // Criar pendência
    const result = await c.env.DB.prepare(
      `INSERT INTO pending_payments (user_id, admin_id, amount, description, month, year, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(user_id, user.id, amount, description, month, year, notes || null).run();

    const pendingId = result.meta?.last_row_id;

    // Criar notificação para o médico
    await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id)
       VALUES (?, ?, 'pending_payment', ?, ?, ?)`
    ).bind(
      user_id,
      user.id,
      'Nova Cobrança Pendente',
      `Você tem uma nova cobrança de R$ ${amount.toFixed(2)} para ${description}`,
      pendingId
    ).run();

    return c.json({ 
      success: true, 
      id: pendingId,
      message: 'Cobrança criada e notificação enviada' 
    });
  } catch (error) {
    console.error('Erro ao criar pendência:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Listar pendências
app.get('/api/pending-payments', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  try {
    let query: string;
    let params: any[];

    if (user.user_type === 'admin') {
      // Admin vê todas as pendências
      query = `
        SELECT pp.*, u.name as user_name, u.email as user_email,
               a.name as admin_name
        FROM pending_payments pp
        JOIN users u ON pp.user_id = u.id
        JOIN users a ON pp.admin_id = a.id
        ORDER BY pp.created_at DESC
      `;
      params = [];
    } else {
      // Médico vê apenas suas pendências
      query = `
        SELECT pp.*, a.name as admin_name
        FROM pending_payments pp
        JOIN users a ON pp.admin_id = a.id
        WHERE pp.user_id = ?
        ORDER BY pp.created_at DESC
      `;
      params = [user.id];
    }

    const result = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ pending_payments: result.results || [] });
  } catch (error) {
    console.error('Erro ao listar pendências:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Marcar pendência como enviada (Médico apenas)
app.put('/api/pending-payments/:id/send', authMiddleware, async (c) => {
  const user = c.get('user');
  const pendingId = parseInt(c.req.param('id'));

  if (!user || (user.user_type !== 'medico' && user.user_type !== 'prestador')) {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Verificar se a pendência existe e pertence ao médico
    const pending = await c.env.DB.prepare(
      'SELECT * FROM pending_payments WHERE id = ? AND user_id = ?'
    ).bind(pendingId, user.id).first();

    if (!pending) {
      return c.json({ error: 'Pendência não encontrada' }, 404);
    }

    if (pending.status !== 'pending') {
      return c.json({ error: 'Pendência já foi processada' }, 400);
    }

    // Processar FormData se houver arquivo
    let invoiceFilename = null;
    let invoiceStoredFilename = null;
    let invoiceFileSize = null;
    let additionalNotes = null;

    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const notes = formData.get('notes') as string;
      
      if (file && file.size > 0) {
        // Validar tipo de arquivo
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
          return c.json({ error: 'Tipo de arquivo não permitido. Use PDF, JPEG ou PNG.' }, 400);
        }
        
        // Validar tamanho (máximo 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return c.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, 400);
        }
        
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        invoiceFilename = file.name;
        invoiceStoredFilename = `invoice_${pendingId}_${timestamp}.${extension}`;
        invoiceFileSize = file.size;
        
        // Em um ambiente real, você salvaria o arquivo no R2 ou outro storage
        // Por enquanto, apenas salvamos as informações no banco
        console.log(`Arquivo recebido: ${file.name}, tamanho: ${file.size} bytes`);
      }
      
      if (notes) {
        additionalNotes = notes;
      }
    } catch (formError) {
      console.log('Nenhum arquivo enviado, processando como marcação simples');
    }

    // Atualizar status para 'sent' com informações do arquivo
    let updateQuery = 'UPDATE pending_payments SET status = "sent", sent_at = CURRENT_TIMESTAMP';
    let updateParams = [];
    
    if (invoiceFilename) {
      updateQuery += ', invoice_filename = ?, invoice_stored_filename = ?, invoice_file_size = ?';
      updateParams.push(invoiceFilename, invoiceStoredFilename, invoiceFileSize);
    }
    
    if (additionalNotes) {
      updateQuery += ', notes = ?';
      updateParams.push(additionalNotes);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(pendingId);
    
    await c.env.DB.prepare(updateQuery).bind(...updateParams).run();

    // Criar notificação para o admin
    const notificationMessage = invoiceFilename 
      ? `${user.name} enviou a nota fiscal (${invoiceFilename}) para: ${pending.description}`
      : `${user.name} marcou como enviada a pendência: ${pending.description}`;
      
    await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id)
       VALUES (?, ?, 'payment_sent', ?, ?, ?)`
    ).bind(
      pending.admin_id,
      user.id,
      'Nota Fiscal Enviada',
      notificationMessage,
      pendingId
    ).run();

    const successMessage = invoiceFilename 
      ? 'Nota fiscal enviada com sucesso'
      : 'Pendência marcada como enviada';
      
    return c.json({ success: true, message: successMessage });
  } catch (error) {
    console.error('Erro ao processar envio:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});



// Download da nota fiscal de um pagamento pendente (Admin apenas)
app.get('/api/pending-payments/:id/download', authMiddleware, async (c) => {
  const user = c.get('user');
  const pendingId = parseInt(c.req.param('id'));

  if (!user || user.user_type !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Buscar o pagamento pendente com a nota fiscal
    const pending = await c.env.DB.prepare(
      'SELECT * FROM pending_payments WHERE id = ? AND invoice_stored_filename IS NOT NULL'
    ).bind(pendingId).first();

    if (!pending) {
      return c.json({ error: 'Pagamento pendente ou nota fiscal não encontrada' }, 404);
    }

    // Buscar o arquivo no sistema de arquivos ou storage
    const filePath = `uploads/${pending.invoice_stored_filename}`;
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const fullPath = path.resolve(filePath);
      
      if (!fs.existsSync(fullPath)) {
        return c.json({ error: 'Arquivo não encontrado no servidor' }, 404);
      }

      const fileBuffer = fs.readFileSync(fullPath);
      const mimeType = pending.invoice_filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

      return new Response(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${pending.invoice_filename}"`,
          'Content-Length': fileBuffer.length.toString()
        }
      });
    } catch (fileError) {
      console.error('Erro ao ler arquivo:', fileError);
      return c.json({ error: 'Erro ao acessar o arquivo' }, 500);
    }
  } catch (error) {
    console.error('Erro ao baixar nota fiscal:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Cancelar pendência (Admin apenas)
app.delete('/api/pending-payments/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const pendingId = parseInt(c.req.param('id'));

  if (!user || user.user_type !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Verificar se a pendência existe
    const pending = await c.env.DB.prepare(
      'SELECT * FROM pending_payments WHERE id = ?'
    ).bind(pendingId).first();

    if (!pending) {
      return c.json({ error: 'Pendência não encontrada' }, 404);
    }

    // Deletar notificações relacionadas primeiro
    await c.env.DB.prepare(
      'DELETE FROM notifications WHERE related_id = ? AND type IN ("pending_payment", "payment_sent", "payment_confirmed")'
    ).bind(pendingId).run();

    // Deletar a pendência permanentemente
    await c.env.DB.prepare(
      'DELETE FROM pending_payments WHERE id = ?'
    ).bind(pendingId).run();

    return c.json({ success: true, message: 'Cobrança deletada permanentemente' });
  } catch (error) {
    console.error('Erro ao deletar pendência:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Confirmar recebimento de nota fiscal (Admin apenas)
app.put('/api/pending-payments/:id/confirm', authMiddleware, async (c) => {
  const user = c.get('user');
  const pendingId = parseInt(c.req.param('id'));

  if (!user || user.user_type !== 'admin') {
    return c.json({ error: 'Acesso negado' }, 403);
  }

  try {
    // Verificar se a pendência existe e está no status 'sent'
    const pending = await c.env.DB.prepare(
      'SELECT pp.*, u.name as user_name FROM pending_payments pp JOIN users u ON pp.user_id = u.id WHERE pp.id = ?'
    ).bind(pendingId).first();

    if (!pending) {
      return c.json({ error: 'Pendência não encontrada' }, 404);
    }

    if (pending.status !== 'sent') {
      return c.json({ error: 'Apenas pendências enviadas podem ser confirmadas' }, 400);
    }

    // Atualizar status para 'confirmed'
    await c.env.DB.prepare(
      'UPDATE pending_payments SET status = "confirmed", confirmed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(pendingId).run();

    // Criar notificação para o usuário
    const notificationMessage = `Sua nota fiscal para "${pending.description}" foi confirmada como recebida`;
      
    await c.env.DB.prepare(
      `INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id)
       VALUES (?, ?, 'payment_confirmed', ?, ?, ?)`
    ).bind(
      pending.user_id,
      user.id,
      'Nota Fiscal Confirmada',
      notificationMessage,
      pendingId
    ).run();

    return c.json({ success: true, message: 'Recebimento confirmado com sucesso' });
  } catch (error) {
    console.error('Erro ao confirmar recebimento:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// ===== SISTEMA DE NOTIFICAÇÕES =====

// Listar notificações do usuário
app.get('/api/notifications', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  try {
    const result = await c.env.DB.prepare(
      `SELECT n.*, u.name as from_user_name
       FROM notifications n
       JOIN users u ON n.from_user_id = u.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`
    ).bind(user.id).all();

    return c.json({ notifications: result.results || [] });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Marcar notificação como lida
app.put('/api/notifications/:id/read', authMiddleware, async (c) => {
  const user = c.get('user');
  const notificationId = parseInt(c.req.param('id'));

  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  try {
    // Verificar se a notificação pertence ao usuário
    const notification = await c.env.DB.prepare(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
    ).bind(notificationId, user.id).first();

    if (!notification) {
      return c.json({ error: 'Notificação não encontrada' }, 404);
    }

    // Marcar como lida
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(notificationId).run();

    return c.json({ success: true, message: 'Notificação marcada como lida' });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

// Contar notificações não lidas
app.get('/api/notifications/unread-count', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Não autorizado' }, 401);
  }

  try {
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE'
    ).bind(user.id).first();

    return c.json({ unread_count: result?.count || 0 });
  } catch (error) {
    console.error('Erro ao contar notificações não lidas:', error);
    return c.json({ error: 'Erro interno do servidor' }, 500);
  }
});

export default app;
