import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/react-app/utils/supabase';

interface User {
  id: string;
  email: string;
  name?: string;
  user_type?: 'medico' | 'admin' | 'prestador';
  cpf_crm?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isPending: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isPending, setIsPending] = useState(true);

  // Busca dados de profile do usuário autenticado
  const fetchProfile = async (): Promise<Partial<User> | null> => {
    try {
      const res = await fetch('/api/profiles/me', { credentials: 'include' });
      if (!res.ok) return null;
      const p = await res.json();
      return { name: p.name, user_type: p.user_type, cpf_crm: p.cpf_crm } as Partial<User>;
    } catch {
      return null;
    }
  };

  // Verificar se usuário está logado via API me
  const checkUserSession = async (): Promise<User | null> => {
    try {
      const res = await fetch('/api/users/me', { credentials: 'include' });
      if (!res.ok) return null;
      const userData = await res.json();
      return {
        id: userData.id?.toString() || '',
        email: userData.email || '',
        name: userData.name,
        user_type: userData.user_type,
        cpf_crm: userData.cpf_crm,
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        if (supabase) {
          // Modo Supabase: Verificar autenticação via Supabase
          const { data: { user: sUser } } = await supabase.auth.getUser();
          if (!mounted) return;
          if (sUser) {
            const profile = await fetchProfile();
            const base = mapSupabaseUser(sUser);
            setUser(profile ? { ...base, ...profile } : base);
          } else {
            setUser(null);
          }
        } else {
          // Modo legacy: Verificar sessão via API /users/me
          const sessionUser = await checkUserSession();
          if (mounted) setUser(sessionUser);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        if (mounted) setIsPending(false);
      }
    };

    loadUser();

    // Configurar listener apenas se Supabase estiver disponível
    let subscription: any = null;
    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        const sUser = session?.user ?? null;
        if (sUser) {
          (async () => {
            const profile = await fetchProfile();
            const base = mapSupabaseUser(sUser);
            setUser(profile ? { ...base, ...profile } : base);
            setIsPending(false);
          })();
        } else {
          setUser(null);
          setIsPending(false);
        }
      });
      subscription = sub;
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsPending(true);
    try {
      if (supabase) {
        // Login via Supabase
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Login via API legacy
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro de login');
        }
        const userData = await res.json();
        setUser({
          id: userData.user?.id?.toString() || '',
          email: userData.user?.email || email,
          name: userData.user?.name,
          user_type: userData.user?.user_type,
          cpf_crm: userData.user?.cpf_crm,
        });
      }
    } finally {
      setIsPending(false);
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Also call backend to clear cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isPending,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function mapSupabaseUser(sUser: SupabaseUser): User {
  return {
    id: sUser.id,
    email: sUser.email || '',
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}