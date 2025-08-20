import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : undefined as unknown as ReturnType<typeof createClient>;

/**
 * Wrapper para fetch que automaticamente adiciona o token de autorização do Supabase
 * para chamadas da API local (/api/*) e mantém credentials: 'include' para cookies de sessão
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const isApi = typeof url === 'string' ? url.startsWith('/api/') : false;

  // Para APIs locais (/api/*), incluir token do Supabase se disponível
  if (isApi && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        } as Record<string, string>;
      }
    } catch (error) {
      console.warn('Erro ao obter token do Supabase:', error);
    }
  }

  // Em desenvolvimento, quando Supabase não está configurado, habilitar bypass de auth no backend
  if (isApi && !supabase && import.meta.env.DEV) {
    options.headers = {
      ...options.headers,
      'x-dev-bypass-auth': 'true',
    } as Record<string, string>;
  }

  // Sempre incluir credentials para cookies de sessão (compatibilidade)
  options.credentials = options.credentials || 'include';

  // Usar o fetch original para evitar recursão com o wrapper global
  const baseFetch: typeof fetch = (typeof window !== 'undefined' && (window as any).__original_fetch)
    ? (window as any).__original_fetch
    : fetch;

  return baseFetch(url, options);
};

export default supabase;