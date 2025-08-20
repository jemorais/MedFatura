import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import { authFetch } from "@/react-app/utils/supabase";

// Instala um wrapper global para fetch que injeta Authorization das sessões do Supabase
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  // Expor o fetch original para evitar recursão no authFetch
  (window as any).__original_fetch = originalFetch;
  (window as any).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      // Apenas delega para authFetch para lidar com /api/*; para demais, chama o original
      if (url.startsWith('/api/')) {
        return authFetch(url, init);
      }
      // Garante credentials para outros endpoints se não definido
      const opts: RequestInit = { ...init };
      if (!opts.credentials) opts.credentials = 'include';
      return originalFetch(input as any, opts);
    } catch (_e) {
      // Em caso de erro no wrapper, faz fallback ao fetch original
      return originalFetch(input as any, init);
    }
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
